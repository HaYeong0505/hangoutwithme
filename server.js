const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 팀채팅 첨부 파일 저장 폴더 (인터넷에 직접 공개되지 않고, /api/files/:id 로 팀원만 열 수 있어요)
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_UPLOAD_MB = 50;
// 올릴 수 있는 파일: 확장자로 형식을 정해요 (브라우저가 보낸 형식은 믿지 않아요)
const FILE_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf", ".mp4": "video/mp4" };

// ===== 정책 값 (여기서 숫자만 바꾸면 돼요) =====
const DORMANT_DAYS = 90;        // 마지막 로그인 후 이 기간이 지나면 휴면
const PURGE_DAYS = 30;          // 탈퇴 후 이 기간이 지나면 개인정보 파기(익명화)
const SUSPEND_DAYS = [1, 3, 7, 30]; // 관리자가 고를 수 있는 일시 정지 기간
const REPORT_REASONS = ["스팸·홍보", "욕설·비방", "허위 정보", "부적절한 내용", "기타"];

const now = () => new Date().toISOString();
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString();
const daysLater = n => new Date(Date.now() + n * 864e5).toISOString();

// ===== DB 준비 (data.db 파일이 없으면 자동으로 만들어져요) =====
const db = new Database(path.join(__dirname, "data.db")); // 어느 폴더에서 실행해도 server.js 옆의 data.db를 써요
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT, email TEXT, hash TEXT
)`);
// 기존 users 테이블에 없는 칸만 추가해요 (기존 회원 정보는 그대로 유지)
const addCol = (table, col, def) => {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
};
addCol("users", "role", "TEXT DEFAULT 'user'");
addCol("users", "status", "TEXT DEFAULT 'active'"); // active | suspended | banned | dormant | withdrawn | purged
addCol("users", "reason", "TEXT");                  // 정지·차단·휴면·탈퇴 사유
addCol("users", "until", "TEXT");                   // 일시 정지 해제 시각
addCol("users", "last_login", "TEXT");
addCol("users", "created_at", "TEXT");
addCol("users", "withdrawn_at", "TEXT");
addCol("users", "chat_status", "TEXT DEFAULT 'ok'"); // 전체 채팅 권한(관리자가 회원 관리에서 직접 설정): ok | banned 모든 팀채팅에서 박탈
addCol("users", "chat_reason", "TEXT");
// 기존 회원은 기록이 없으니 지금 시각으로 채워서 바로 휴면이 되지 않게 해요
db.prepare("UPDATE users SET last_login=? WHERE last_login IS NULL").run(now());
db.prepare("UPDATE users SET created_at=? WHERE created_at IS NULL").run(now());
db.prepare("UPDATE users SET status='active' WHERE status IS NULL").run();

// ===== 관리자 계정 자동 생성 =====
// 새로 받은 사람(빈 data.db)도 바로 관리자 화면을 쓸 수 있게, 관리자가 한 명도 없으면 admin 계정을 만들어요
// 비밀번호: 환경변수 ADMIN_PW가 있으면 그 값, 없으면 1 (관리자 로그인은 이 PC의 localhost에서만 돼요)
if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  if (db.prepare("SELECT 1 FROM users WHERE id='admin'").get()) {
    console.warn("[주의] 'admin' ID를 일반 회원이 쓰고 있어서 관리자 계정을 자동으로 만들지 못했어요.");
  } else {
    const t = new Date().toISOString();
    db.prepare("INSERT INTO users (id,name,email,hash,role,status,last_login,created_at) VALUES ('admin','admin','admin@example.com',?,'admin','active',?,?)")
      .run(bcrypt.hashSync(process.env.ADMIN_PW || "1", 10), t, t);
    console.log(`관리자 계정을 만들었어요. ID: admin / 비밀번호: ${process.env.ADMIN_PW ? "(ADMIN_PW에 적은 값)" : "1"} — http://localhost 에서만 로그인돼요.`);
  }
}

// ===== 세션 비밀 키 =====
// 코드에 적어 두면 GitHub에 그대로 공개되니까, 환경변수 SESSION_SECRET을 쓰거나
// 없으면 처음 실행할 때 무작위로 만들어 data.db에 보관해요 (PC마다 다른 키가 생겨요)
db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)");
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key='session_secret'").get();
  if (row) return row.value;
  const v = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('session_secret', ?)").run(v);
  return v;
})();

db.exec(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT, owner_name TEXT,          -- owner가 NULL이면 예시 모집글
  ctitle TEXT, name TEXT, lv INTEGER, cond TEXT, max INTEGER,
  need TEXT,                            -- JSON 배열: ["기획","디자인"]
  mem TEXT,                             -- JSON 배열: [{uid,n,r}]
  status TEXT DEFAULT 'open',           -- open(모집 중) | closed(모집 마감)
  blinded INTEGER DEFAULT 0, blind_reason TEXT,
  created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pid INTEGER, uid TEXT, uname TEXT, role TEXT, intro TEXT,
  st TEXT DEFAULT 'w',                  -- w 대기 | p 합격(확인 전) | r 불합격(확인 전) | a 참여 중 | rc 불합격 확인 | x 불참여·취소
  created_at TEXT, updated_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ttype TEXT, tid TEXT,                 -- 신고 대상: post(모집글 id) | user(회원 id)
  reporter TEXT, reason TEXT, detail TEXT,
  status TEXT DEFAULT 'open',           -- open 접수 | done 처리 완료 | rejected 반려
  note TEXT, created_at TEXT, handled_at TEXT
)`);
addCol("reports", "snap", "TEXT"); // 채팅 신고: 신고 당시 메시지 사본(JSON) — 나중에 메시지가 지워져도 관리자가 확인할 수 있게

// ----- 팀채팅 (모집글 id = 팀 id) -----
db.exec(`CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, pid INTEGER, uid TEXT, name TEXT, mime TEXT, size INTEGER, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_nt (       -- 공지사항
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER, uid TEXT, uname TEXT,
  title TEXT, body TEXT, url TEXT, fid TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_msgs (     -- 채팅
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER, uid TEXT, uname TEXT, text TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_msg_ck (   -- 채팅 '확인' 체크
  mid INTEGER, uid TEXT, PRIMARY KEY (mid, uid)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_lib (      -- 자료 라이브러리 (파일 또는 링크)
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER, uid TEXT, kind TEXT, name TEXT, url TEXT, fid TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_vt (       -- 투표 (opts: 선택지 JSON 배열)
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER, uid TEXT, q TEXT, opts TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_vt_pick (  -- 누가 몇 번째 선택지를 골랐는지
  vid INTEGER, uid TEXT, opt INTEGER, PRIMARY KEY (vid, uid)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_ev (       -- 일정 / 해야할 일
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid INTEGER, uid TEXT, d TEXT, title TEXT, todo INTEGER, done INTEGER, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_editors ( -- 팀장이 '수정 권한'을 준 팀원 (공지 작성, 투표·일정 수정/삭제)
  pid INTEGER, uid TEXT, PRIMARY KEY (pid, uid)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_chat_block ( -- 팀별 채팅 제한: 신고가 일어난 그 팀채팅에서만 적용
  pid INTEGER, uid TEXT, status TEXT,               -- muted 신고 접수(관리자 확인 전) | banned 이 팀에서 영구 박탈
  reason TEXT, created_at TEXT, PRIMARY KEY (pid, uid)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS team_av (       -- 시간 조율: 이 사람은 d 날짜 h시(0~23)에 가능
  pid INTEGER, uid TEXT, d TEXT, h INTEGER, PRIMARY KEY (pid, uid, d, h)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS profiles (      -- [마이페이지] 개인 프로필 (목록은 JSON 배열 글자로 저장)
  uid TEXT PRIMARY KEY,
  aff TEXT DEFAULT '',                  -- 소속
  aw TEXT DEFAULT '[]',                 -- 수상내역: ["2025 교내 해커톤 대상"]
  car TEXT DEFAULT '[]',                -- 경력·자격증: ["정보처리기사 (2025.06)"]
  pf TEXT DEFAULT '[]',                 -- 포폴: [{"t":"제목","u":"https://..."}]
  updated_at TEXT
)`);

// 이전 버전에서 신고로 '전체 채팅'이 정지된 회원은 신고가 일어난 팀에만 정지를 남기고 전체 정지는 풀어요
for (const u of db.prepare("SELECT id FROM users WHERE chat_status='muted'").all()) {
  for (const r of db.prepare("SELECT snap FROM reports WHERE ttype='msg' AND status='open'").all()) {
    const s = JSON.parse(r.snap || "{}");
    if (s.uid === u.id && s.pid) db.prepare("INSERT OR IGNORE INTO team_chat_block (pid,uid,status,reason,created_at) VALUES (?,?,'muted','채팅 신고 접수 (관리자 확인 대기)',?)").run(s.pid, u.id, now());
  }
  db.prepare("UPDATE users SET chat_status='ok', chat_reason=NULL WHERE id=?").run(u.id);
}

// 처음 실행할 때만 예시 모집글을 넣어요
if (!db.prepare("SELECT COUNT(*) n FROM posts").get().n) {
  const m = s => s.map(x => { const [, n, r] = x.match(/^(.+)\((.+)\)$/); return { uid: null, n, r }; });
  const seed = [
    ["밤산책 필름", "서울 영상 공모전 밤로그", 1, "촬영·편집 둘 다 처음이어도 괜찮아요", 3, ["영상", "기획"], ["강민서(기획)"]],
    ["로고 연구소", "연구재단 50주년 엠블럼 디자인", 2, "시안 3개 이상 제작 가능한 분", 3, ["디자인"], ["윤서아(디자인)"]],
    ["AI 에듀팀", "AI 융합교육 플랫폼 챌린지", 3, "Git 사용 가능, 주 2회 회의", 4, ["백엔드", "기획"], ["한지우(프론트)"]],
    ["숏폼 메이커스", "서울 영상 공모전 밤로그", 1, "초보 환영, 주말 촬영 가능한 분", 4, ["영상"], ["김하늘(기획)", "최유나(기획)", "정민호(영상)"]],
    ["광고쟁이들", "MTN 중소기업 광고 공모전", 2, "주 1회 온라인 회의, 11월 안에 시안 완성", 4, ["카피", "디자인"], ["이도윤(기획)", "박서준(영상)"]],
  ];
  const ins = db.prepare("INSERT INTO posts (owner,owner_name,ctitle,name,lv,cond,max,need,mem,created_at) VALUES (NULL,'예시',?,?,?,?,?,?,?,?)");
  for (const [name, ct, lv, cond, max, need, mem] of seed) ins.run(ct, name, lv, cond, max, JSON.stringify(need), JSON.stringify(m(mem)), now());
}

const findUser = id => db.prepare("SELECT * FROM users WHERE id=?").get(id);
const findPost = id => db.prepare("SELECT * FROM posts WHERE id=?").get(id);
const findApp = id => db.prepare("SELECT * FROM apps WHERE id=?").get(id);
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role || "user" }); // 해시는 응답에 넣지 않기

// 탈퇴 회원 개인정보 파기: 이름·이메일·비밀번호를 지우고 기록에는 '탈퇴한 회원'으로 남겨요
const GONE = "탈퇴한 회원";
function purgeUser(id) {
  db.prepare("UPDATE users SET name=?, email='', hash='', status='purged', reason=NULL, until=NULL WHERE id=?").run(GONE, id);
  db.prepare("UPDATE posts SET owner_name=? WHERE owner=?").run(GONE, id);
  db.prepare("UPDATE apps SET uname=? WHERE uid=?").run(GONE, id);
  db.prepare("DELETE FROM profiles WHERE uid=?").run(id); // [마이페이지] 프로필도 파기
  db.prepare("UPDATE team_msgs SET uname=? WHERE uid=?").run(GONE, id);
  db.prepare("UPDATE team_nt SET uname=? WHERE uid=?").run(GONE, id);
  for (const p of db.prepare("SELECT id, mem FROM posts").all()) {
    const mem = JSON.parse(p.mem);
    if (mem.some(x => x.uid === id))
      db.prepare("UPDATE posts SET mem=? WHERE id=?").run(JSON.stringify(mem.map(x => x.uid === id ? { ...x, n: GONE } : x)), p.id);
  }
}

// 상태 자동 정리: 정지 기간 만료 → 해제, 미접속 → 휴면, 탈퇴 후 기간 경과 → 파기
function sweep() {
  db.prepare("UPDATE users SET status='active', reason=NULL, until=NULL WHERE status='suspended' AND until<=?").run(now());
  db.prepare(`UPDATE users SET status='dormant', reason=? WHERE status='active' AND role!='admin' AND last_login<=?`)
    .run(`${DORMANT_DAYS}일 이상 미접속`, daysAgo(DORMANT_DAYS));
  for (const u of db.prepare("SELECT id FROM users WHERE status='withdrawn' AND withdrawn_at<=?").all(daysAgo(PURGE_DAYS))) purgeUser(u.id);
}
sweep();
setInterval(sweep, 60 * 60 * 1000); // 1시간마다

// ===== 로그인 세션도 data.db에 저장해요 (서버를 껐다 켜도 로그인이 유지돼요) =====
class SqliteStore extends session.Store {
  constructor() {
    super();
    db.exec("CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT, expires INTEGER)");
    setInterval(() => db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now()), 60 * 60 * 1000).unref(); // 만료된 세션 정리
  }
  get(sid, cb) {
    try { const r = db.prepare("SELECT sess, expires FROM sessions WHERE sid=?").get(sid); cb(null, r && r.expires > Date.now() ? JSON.parse(r.sess) : null); }
    catch (e) { cb(e); }
  }
  set(sid, s, cb) {
    try {
      const exp = s.cookie && s.cookie.expires ? new Date(s.cookie.expires).getTime() : Date.now() + SESSION_DAYS * 864e5;
      db.prepare("INSERT OR REPLACE INTO sessions (sid, sess, expires) VALUES (?,?,?)").run(sid, JSON.stringify(s), exp);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { db.prepare("DELETE FROM sessions WHERE sid=?").run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, s, cb) { this.set(sid, s, cb); }
}
const SESSION_DAYS = 7; // 마지막 이용 후 이 기간 동안 로그인 유지

const app = express();
app.use(express.json());
app.use(session({
  store: new SqliteStore(),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // 이용할 때마다 유지 기간이 다시 늘어나요
  cookie: { httpOnly: true, sameSite: "lax", maxAge: SESSION_DAYS * 864e5 },
}));
// 화면에 필요한 파일만 공개해요 (data.db, server.js 같은 파일이 인터넷에 노출되지 않도록)
// no-cache: 브라우저가 오래된 js를 쓰지 않고 항상 최신 파일을 확인해요
const noCache = { setHeaders: res => res.set("Cache-Control", "no-cache") };
app.use("/css", express.static(__dirname + "/css", noCache));
app.use("/js", express.static(__dirname + "/js", noCache));
app.get("/logo.png", (req, res) => res.sendFile(__dirname + "/logo.png"));
app.get("/", (req, res) => res.set("Cache-Control", "no-cache").sendFile(__dirname + "/index.html"));

// ===== 이 PC에서 직접 접속했는지 확인 =====
// 터널(cloudflared)도 내 PC의 localhost로 요청을 넘겨주기 때문에 IP만으로는 구분이 안 돼요.
// 그래서 ① 접속 IP가 내 PC이고 ② 주소창 주소(Host)가 localhost이며 ③ 프록시가 붙이는 헤더가 없을 때만 '로컬'로 봐요.
// (터널로 들어온 요청은 Host가 xxx.trycloudflare.com이고 CF-Connecting-IP 헤더가 붙어요)
const LOOPBACK_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1"], LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];
const isLocal = req => {
  const host = String(req.headers.host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return LOOPBACK_IPS.includes(req.socket.remoteAddress) && LOCAL_HOSTS.includes(host)
    && !req.headers["cf-connecting-ip"] && !req.headers["cf-ray"] && !req.headers["x-forwarded-for"];
};
// 관리자 계정은 로컬에서만 쓸 수 있어요 (밖에서는 로그인하지 않은 것으로 취급)
const adminBlocked = (req, u) => u && u.role === "admin" && !isLocal(req);

// ===== 로그인 확인 미들웨어 =====
// 정지·차단·휴면·탈퇴 상태가 되면 로그인해 있던 사람도 다음 요청부터 막혀요 (code:'inactive')
const viewer = req => { const u = req.session.uid && findUser(req.session.uid); return u && u.status === "active" && !adminBlocked(req, u) ? u : null; };
const requireUser = (req, res, next) => {
  const u = req.session.uid && findUser(req.session.uid);
  if (!u || adminBlocked(req, u)) return res.status(401).json({ error: "로그인이 필요해요." });
  if (u.status !== "active") return res.status(403).json({ error: "이용할 수 없는 계정 상태예요. 다시 로그인해 주세요.", code: "inactive" });
  req.user = u; next();
};
const requireAdmin = (req, res, next) => requireUser(req, res, () => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "관리자만 사용할 수 있어요." });
  next();
});
const fmt = iso => iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";

// ===== 회원 =====
app.post("/api/signup", async (req, res) => {
  const { id, pw, name, email } = req.body;
  if (!id || !pw || !name || !email) return res.status(400).json({ error: "모든 항목을 입력해 주세요." });
  if (findUser(id)) return res.status(409).json({ error: "이미 사용 중인 ID예요." });
  const hash = await bcrypt.hash(pw, 10);
  db.prepare("INSERT INTO users (id,name,email,hash,role,status,last_login,created_at) VALUES (?,?,?,?, 'user','active',?,?)")
    .run(id, name, email, hash, now(), now());
  req.session.uid = id;
  res.json({ id, name, email, role: "user" });
});

app.post("/api/login", async (req, res) => {
  const { id, pw } = req.body;
  sweep();
  const u = findUser(id);
  // 관리자 계정은 밖(터널 등)에서는 비밀번호를 확인하지도 않고 일반 오류로 거절해요
  // → 밖에서는 관리자 계정이 있는지, 비밀번호가 맞는지 알아낼 수 없어요
  if (adminBlocked(req, u)) return res.status(401).json({ error: "ID 또는 비밀번호가 틀렸어요." });
  // 비밀번호가 맞는 사람에게만 계정 상태를 알려 줘요
  if (!u || !u.hash || !pw || !(await bcrypt.compare(pw, u.hash)))
    return res.status(401).json({ error: "ID 또는 비밀번호가 틀렸어요." });
  if (u.status === "withdrawn")
    return res.status(403).json({ error: `탈퇴 처리된 계정이에요. 탈퇴 후 ${PURGE_DAYS}일 안에는 관리자에게 복구를 요청할 수 있어요.` });
  if (u.status === "banned")
    return res.status(403).json({ error: `이용이 영구 정지된 계정이에요. (사유: ${u.reason || "운영 정책 위반"})` });
  if (u.status === "suspended")
    return res.status(403).json({ error: `이용이 일시 정지된 계정이에요. (사유: ${u.reason || "운영 정책 위반"}, ${fmt(u.until)}에 해제)` });
  const wasDormant = u.status === "dormant";
  db.prepare("UPDATE users SET status='active', reason=NULL, last_login=? WHERE id=?").run(now(), u.id);
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "로그인 처리 중 문제가 생겼어요." });
    req.session.uid = u.id;
    res.json({ ...pub(u), wasDormant });
  });
});

app.get("/api/me", (req, res) => {
  const u = viewer(req);
  if (!u) return res.status(401).json({ error: "로그인이 필요해요." });
  res.json(pub(u));
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

// 본인 탈퇴: 바로 지우지 않고 탈퇴 상태로 바꿔요 (PURGE_DAYS 뒤 자동 파기)
app.delete("/api/me", requireUser, async (req, res) => {
  const u = req.user;
  if (u.role === "admin") return res.status(403).json({ error: "관리자 계정은 탈퇴할 수 없어요." });
  const { pw } = req.body || {};
  if (!pw || !(await bcrypt.compare(pw, u.hash)))
    return res.status(401).json({ error: "비밀번호가 틀렸어요." });
  withdraw(u.id, "본인 탈퇴");
  req.session.destroy(() => res.json({ ok: true }));
});
function withdraw(id, reason) {
  db.prepare("UPDATE users SET status='withdrawn', reason=?, until=NULL, withdrawn_at=? WHERE id=?").run(reason, now(), id);
  db.prepare("UPDATE apps SET st='x', updated_at=? WHERE uid=? AND st IN ('w','p')").run(now(), id); // 진행 중인 지원은 취소
}

// ===== 모집글 =====
// 탈퇴한 회원의 모집글은 게시판에서 숨겨요
const VISIBLE = `(p.owner IS NULL OR (SELECT status FROM users WHERE id=p.owner) NOT IN ('withdrawn','purged'))`;
function postOut(p, u) {
  const mem = JSON.parse(p.mem), mine = !!u && p.owner === u.id;
  return {
    id: p.id, owner: p.owner, ownerName: p.owner_name, ctitle: p.ctitle, name: p.name, lv: p.lv, cond: p.cond,
    max: p.max, need: JSON.parse(p.need), mem: mem.map(x => `${x.n}(${x.r})`), status: p.status,
    blinded: !!p.blinded, blindReason: mine || (u && u.role === "admin") ? p.blind_reason : undefined, mine,
  };
}
// 게시판 목록: 블라인드된 글은 작성자 본인에게만 보여요
app.get("/api/posts", (req, res) => {
  const u = viewer(req);
  const rows = db.prepare(`SELECT * FROM posts p WHERE ${VISIBLE} ORDER BY id DESC`).all()
    .filter(p => !p.blinded || (u && p.owner === u.id));
  res.json(rows.map(p => postOut(p, u)));
});
function readPostBody(b) {
  const need = Array.isArray(b.need) ? b.need.map(s => String(s).trim()).filter(Boolean) : [];
  const v = { ctitle: String(b.ctitle || "").trim(), name: String(b.name || "").trim(), cond: String(b.cond || "").trim(),
    lv: +b.lv, max: Math.round(+b.max), need };
  if (!v.ctitle || !v.name || !v.cond || !need.length) return { error: "공모전, 팀명, 모집 조건, 모집 직무를 모두 입력해 주세요." };
  if (![1, 2, 3].includes(v.lv)) return { error: "참여 수준이 올바르지 않아요." };
  if (!(v.max >= 2 && v.max <= 10)) return { error: "최대 인원은 2~10명으로 정해 주세요." };
  return { v };
}
app.post("/api/posts", requireUser, (req, res) => {
  const { v, error } = readPostBody(req.body || {});
  if (error) return res.status(400).json({ error });
  const r = db.prepare("INSERT INTO posts (owner,owner_name,ctitle,name,lv,cond,max,need,mem,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(req.user.id, req.user.name, v.ctitle, v.name, v.lv, v.cond, v.max, JSON.stringify(v.need),
      JSON.stringify([{ uid: req.user.id, n: req.user.name, r: "팀장" }]), now());
  res.json(postOut(findPost(r.lastInsertRowid), req.user));
});
app.put("/api/posts/:id", requireUser, (req, res) => {
  const p = findPost(+req.params.id);
  if (!p || p.owner !== req.user.id) return res.status(404).json({ error: "수정할 수 있는 모집글이 아니에요." });
  const { v, error } = readPostBody(req.body || {});
  if (error) return res.status(400).json({ error });
  const max = Math.max(v.max, JSON.parse(p.mem).length);
  db.prepare("UPDATE posts SET ctitle=?, name=?, lv=?, cond=?, max=?, need=? WHERE id=?")
    .run(v.ctitle, v.name, v.lv, v.cond, max, JSON.stringify(v.need), p.id);
  res.json(postOut(findPost(p.id), req.user));
});
app.delete("/api/posts/:id", requireUser, (req, res) => {
  const p = findPost(+req.params.id);
  if (!p || p.owner !== req.user.id) return res.status(404).json({ error: "삭제할 수 있는 모집글이 아니에요." });
  db.prepare("DELETE FROM apps WHERE pid=?").run(p.id);
  deleteTeamData(p.id); // 팀채팅 내용과 첨부 파일도 함께 지워요
  db.prepare("DELETE FROM posts WHERE id=?").run(p.id);
  res.json({ ok: true });
});

// ===== 지원(매칭) =====
app.post("/api/posts/:id/apply", requireUser, (req, res) => {
  const p = db.prepare(`SELECT * FROM posts p WHERE id=? AND ${VISIBLE}`).get(+req.params.id);
  if (!p || p.blinded) return res.status(404).json({ error: "지원할 수 없는 모집글이에요." });
  if (p.owner === req.user.id) return res.status(400).json({ error: "내가 만든 팀에는 지원할 수 없어요." });
  if (p.status !== "open") return res.status(400).json({ error: "모집이 마감된 팀이에요." });
  if (JSON.parse(p.mem).length >= p.max) return res.status(400).json({ error: "정원이 다 찼어요." });
  if (db.prepare("SELECT 1 FROM apps WHERE pid=? AND uid=? AND st='k'").get(p.id, req.user.id))
    return res.status(403).json({ error: "팀장이 이 팀에서 내보낸 기록이 있어 다시 지원할 수 없어요." });
  if (db.prepare("SELECT 1 FROM apps WHERE pid=? AND uid=? AND st IN ('w','p','a')").get(p.id, req.user.id))
    return res.status(409).json({ error: "이미 지원한 팀이에요." });
  const role = String((req.body || {}).role || "");
  if (!JSON.parse(p.need).includes(role)) return res.status(400).json({ error: "모집 중인 직무를 골라 주세요." });
  db.prepare("INSERT INTO apps (pid,uid,uname,role,intro,st,created_at,updated_at) VALUES (?,?,?,?,?, 'w',?,?)")
    .run(p.id, req.user.id, req.user.name, role, String(req.body.intro || "").trim(), now(), now());
  res.json({ ok: true });
});
// 내가 지원한 목록
app.get("/api/my/apps", requireUser, (req, res) => {
  res.json(db.prepare("SELECT a.* FROM apps a JOIN posts p ON p.id=a.pid WHERE a.uid=? AND a.st IN ('w','p','r','a') ORDER BY a.id DESC")
    .all(req.user.id).map(a => ({ aid: a.id, tid: a.pid, role: a.role, intro: a.intro, st: a.st })));
});
// 내 팀에 들어온 신청서 (대기 중인 것만)
app.get("/api/my/recv", requireUser, (req, res) => {
  res.json(db.prepare("SELECT a.* FROM apps a JOIN posts p ON p.id=a.pid WHERE p.owner=? AND a.st='w' ORDER BY a.id")
    .all(req.user.id).map(a => ({ aid: a.id, tid: a.pid, uid: a.uid, n: a.uname, role: a.role, intro: a.intro, ...profOf(a.uid) }))); // [마이페이지] 지원자 프로필도 같이
});
// 팀장이 합격/불합격 결정
app.post("/api/apps/:id/decide", requireUser, (req, res) => {
  const a = findApp(+req.params.id), p = a && findPost(a.pid);
  if (!a || !p || p.owner !== req.user.id || a.st !== "w") return res.status(404).json({ error: "처리할 수 있는 신청서가 아니에요." });
  db.prepare("UPDATE apps SET st=?, updated_at=? WHERE id=?").run(req.body && req.body.ok ? "p" : "r", now(), a.id);
  res.json({ ok: true });
});
// 지원자가 결과 확인: 합격이면 팀에 합류, 불합격이면 확인 처리
app.post("/api/apps/:id/confirm", requireUser, (req, res) => {
  const a = findApp(+req.params.id), p = a && findPost(a.pid);
  if (!a || !p || a.uid !== req.user.id || !["p", "r"].includes(a.st)) return res.status(404).json({ error: "확인할 결과가 없어요." });
  if (a.st === "r") { db.prepare("UPDATE apps SET st='rc', updated_at=? WHERE id=?").run(now(), a.id); return res.json({ ok: true, joined: false }); }
  const mem = JSON.parse(p.mem);
  if (mem.length >= p.max) return res.status(400).json({ error: "그사이 정원이 다 찼어요. 팀장에게 문의해 주세요." });
  mem.push({ uid: a.uid, n: a.uname, r: a.role });
  db.prepare("UPDATE posts SET mem=? WHERE id=?").run(JSON.stringify(mem), p.id);
  db.prepare("UPDATE apps SET st='a', updated_at=? WHERE id=?").run(now(), a.id);
  res.json({ ok: true, joined: true });
});
// 합격했지만 참여하지 않기
app.post("/api/apps/:id/skip", requireUser, (req, res) => {
  const a = findApp(+req.params.id);
  if (!a || a.uid !== req.user.id || a.st !== "p") return res.status(404).json({ error: "불참여할 수 있는 지원이 아니에요." });
  db.prepare("UPDATE apps SET st='x', updated_at=? WHERE id=?").run(now(), a.id);
  res.json({ ok: true });
});

// ===== 마이페이지: 개인 프로필 =====
const EMPTY_PROF = { aff: "", aw: [], car: [], pf: [] };
const arr = s => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
// 이 회원의 프로필 (저장한 적 없으면 빈 프로필)
function profOf(uid) {
  const p = db.prepare("SELECT * FROM profiles WHERE uid=?").get(uid);
  return p ? { aff: p.aff || "", aw: arr(p.aw), car: arr(p.car), pf: arr(p.pf) } : { ...EMPTY_PROF };
}
// 글자 목록 정리: 앞뒤 공백 빼고, 빈 칸 빼고, 길이·개수 제한
const textList = (v, len = 100, max = 30) =>
  (Array.isArray(v) ? v : []).map(x => String(x ?? "").trim().slice(0, len)).filter(Boolean).slice(0, max);

// 내 프로필 불러오기
app.get("/api/me/profile", requireUser, (req, res) => res.json(profOf(req.user.id)));

// 내 프로필 저장 (보낸 내용으로 통째로 바꿔요)
app.put("/api/me/profile", requireUser, (req, res) => {
  const b = req.body || {};
  const pf = (Array.isArray(b.pf) ? b.pf : [])
    .map(p => ({ t: String(p?.t ?? "").trim().slice(0, 60), u: String(p?.u ?? "").trim().slice(0, 300) }))
    .filter(p => p.t && /^https?:\/\//.test(p.u)).slice(0, 30);
  const prof = { aff: String(b.aff ?? "").trim().slice(0, 60), aw: textList(b.aw), car: textList(b.car), pf };
  db.prepare(`INSERT INTO profiles (uid,aff,aw,car,pf,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(uid) DO UPDATE SET aff=excluded.aff, aw=excluded.aw, car=excluded.car, pf=excluded.pf, updated_at=excluded.updated_at`)
    .run(req.user.id, prof.aff, JSON.stringify(prof.aw), JSON.stringify(prof.car), JSON.stringify(prof.pf), now());
  res.json({ ok: true, ...prof });
});

// ===== 신고 =====
app.get("/api/report-reasons", (req, res) => res.json(REPORT_REASONS));
app.post("/api/reports", requireUser, (req, res) => {
  const { ttype, tid, reason, detail } = req.body || {};
  if (!["post", "user"].includes(ttype)) return res.status(400).json({ error: "신고 대상이 올바르지 않아요." });
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: "신고 사유를 골라 주세요." });
  const key = String(tid);
  if (ttype === "post") {
    const p = findPost(+key);
    if (!p) return res.status(404).json({ error: "없는 모집글이에요." });
    if (p.owner === req.user.id) return res.status(400).json({ error: "내 모집글은 신고할 수 없어요." });
  } else {
    if (!findUser(key)) return res.status(404).json({ error: "없는 회원이에요." });
    if (key === req.user.id) return res.status(400).json({ error: "나 자신은 신고할 수 없어요." });
  }
  if (db.prepare("SELECT 1 FROM reports WHERE ttype=? AND tid=? AND reporter=? AND status='open'").get(ttype, key, req.user.id))
    return res.status(409).json({ error: "이미 신고한 대상이에요. 관리자가 확인 중이에요." });
  db.prepare("INSERT INTO reports (ttype,tid,reporter,reason,detail,created_at) VALUES (?,?,?,?,?,?)")
    .run(ttype, key, req.user.id, reason, String(detail || "").trim().slice(0, 500), now());
  res.json({ ok: true });
});

// ===== 팀채팅 =====
// 팀원(팀장 + 합격 후 참여 중인 사람)만 그 팀의 내용을 보고 쓸 수 있어요
const isMember = (p, uid) => p.owner === uid || !!db.prepare("SELECT 1 FROM apps WHERE pid=? AND uid=? AND st='a'").get(p.id, uid);
// 팀 권한: 팀장(lead) / 수정 권한을 받은 팀원(editor) / 일반 팀원
const isEditor = (pid, uid) => !!db.prepare("SELECT 1 FROM team_editors WHERE pid=? AND uid=?").get(pid, uid);
const requireMember = (req, res, next) => requireUser(req, res, () => {
  const p = findPost(+req.params.pid);
  if (!p || !isMember(p, req.user.id)) return res.status(403).json({ error: "이 팀의 팀원만 이용할 수 있어요." });
  req.team = p;
  req.lead = p.owner === req.user.id;
  req.editor = req.lead || isEditor(p.id, req.user.id); // 팀장은 항상 수정 권한이 있어요
  next();
});
const deny = (res, msg) => res.status(403).json({ error: msg });
// 이 팀에서의 채팅 상태: global(관리자가 전체 채팅 박탈) > 이 팀의 banned/muted > ok
const chatState = (pid, u) => {
  if (!u) return null;
  if ((u.chat_status || "ok") === "banned") return "global";
  const b = db.prepare("SELECT status FROM team_chat_block WHERE pid=? AND uid=?").get(pid, u.id);
  return b ? b.status : "ok";
};
const NEED_EDITOR = "팀장이나 수정 권한을 받은 팀원만 할 수 있어요.";
// 공지: 팀장은 모든 글, 권한을 받은 팀원은 자기 글만 수정·삭제
const canEditNotice = (req, n) => req.lead || (req.editor && n.uid === req.user.id);
// 자료: 팀장은 모든 자료, 팀원은 자기가 올린 자료만 삭제
const canDelLib = (req, x) => req.lead || x.uid === req.user.id;
// 팀장이 보는 팀원 목록 (역할, 계정 상태, 채팅 상태, 수정 권한)
const membersOf = p => JSON.parse(p.mem).map(m => {
  const u = m.uid && findUser(m.uid);
  return { uid: m.uid, n: m.n, r: m.r, lead: !!m.uid && m.uid === p.owner, editor: !!m.uid && isEditor(p.id, m.uid),
    status: u ? u.status : null, until: u ? u.until : null, chat: chatState(p.id, u) };
});
const fileKind = mime => mime.startsWith("image/") ? "img" : mime === "application/pdf" ? "pdf" : mime === "video/mp4" ? "mp4" : "";
const removeFile = fid => {
  if (!fid) return;
  db.prepare("DELETE FROM files WHERE id=?").run(fid);
  fs.rm(path.join(UPLOAD_DIR, fid), { force: true }, () => {});
};
function deleteTeamData(pid) {
  for (const f of db.prepare("SELECT id FROM files WHERE pid=?").all(pid)) removeFile(f.id);
  db.prepare("DELETE FROM team_msg_ck WHERE mid IN (SELECT id FROM team_msgs WHERE pid=?)").run(pid);
  db.prepare("DELETE FROM team_vt_pick WHERE vid IN (SELECT id FROM team_vt WHERE pid=?)").run(pid);
  for (const t of ["team_nt", "team_msgs", "team_lib", "team_vt", "team_ev", "team_av", "team_editors", "team_chat_block"]) db.prepare(`DELETE FROM ${t} WHERE pid=?`).run(pid);
}
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d));
const isUrl = u => /^https?:\/\//i.test(String(u));
// 이 팀에 올라온 파일인지 확인
const teamFile = (pid, fid) => fid ? db.prepare("SELECT * FROM files WHERE id=? AND pid=?").get(String(fid), pid) : null;

// 팀채팅 전체 내용 한 번에 불러오기
app.get("/api/teams/:pid", requireMember, (req, res) => {
  const pid = req.team.id, me = req.user.id;
  const file = fid => { const f = fid && db.prepare("SELECT * FROM files WHERE id=?").get(fid); return f ? { fid: f.id, fn: f.name, fk: fileKind(f.mime) } : {}; };
  const nt = db.prepare("SELECT * FROM team_nt WHERE pid=? ORDER BY id DESC").all(pid)
    .map(n => ({ id: n.id, t: n.title, b: n.body, u: n.url || "", w: n.uname, at: n.created_at, can: canEditNotice(req, n), ...file(n.fid) }));
  const msgs = db.prepare(`SELECT m.*, (SELECT COUNT(*) FROM team_msg_ck c WHERE c.mid=m.id AND c.uid!=?) ck,
      EXISTS(SELECT 1 FROM team_msg_ck c WHERE c.mid=m.id AND c.uid=?) my
    FROM team_msgs m WHERE pid=? ORDER BY id DESC LIMIT 500`).all(me, me, pid).reverse()
    .map(m => ({ id: m.id, w: m.uname, t: m.text, at: m.created_at, ck: m.ck, my: m.my ? 1 : 0, me: m.uid === me ? 1 : 0 }));
  const lib = db.prepare("SELECT * FROM team_lib WHERE pid=? ORDER BY id DESC").all(pid)
    .map(x => ({ id: x.id, k: x.kind, n: x.name, u: x.url || "", can: canDelLib(req, x), ...file(x.fid) }));
  const vt = db.prepare("SELECT * FROM team_vt WHERE pid=? ORDER BY id DESC").all(pid).map(v => {
    const picks = db.prepare("SELECT uid, opt FROM team_vt_pick WHERE vid=?").all(v.id), mine = picks.find(p => p.uid === me);
    return { id: v.id, q: v.q, o: JSON.parse(v.opts).map((x, i) => ({ x, n: picks.filter(p => p.opt === i).length })), my: mine ? mine.opt : -1 };
  });
  const ev = db.prepare("SELECT * FROM team_ev WHERE pid=? ORDER BY d, id").all(pid)
    .map(e => ({ id: e.id, d: e.d, t: e.title, todo: e.todo, done: e.done }));
  const av = db.prepare("SELECT a.d, a.h, a.uid, IFNULL(u.name, a.uid) n FROM team_av a LEFT JOIN users u ON u.id=a.uid WHERE a.pid=?").all(pid)
    .map(a => ({ d: a.d, h: a.h, n: a.n, me: a.uid === me ? 1 : 0 }));
  // perm: 화면에서 버튼을 보여 줄지 정하는 데 써요 (실제 검사는 각 API가 다시 해요)
  const perm = { lead: req.lead, editor: req.editor, chat: chatState(pid, req.user) };
  res.json({ nt, msgs, lib, vt, ev, av, perm, members: req.lead ? membersOf(req.team) : undefined });
});

// 파일 올리기: 본문에 파일 내용을 그대로 보내고, 파일 이름은 ?name= 으로 보내요
app.post("/api/teams/:pid/upload", requireMember, express.raw({ type: () => true, limit: MAX_UPLOAD_MB + "mb" }), (req, res) => {
  const name = str(req.query.name, 200), mime = FILE_TYPES[path.extname(name).toLowerCase()];
  if (!name || !mime) return res.status(400).json({ error: "pdf, jpg, png, mp4 파일만 올릴 수 있어요." });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "빈 파일은 올릴 수 없어요." });
  const id = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(UPLOAD_DIR, id), req.body);
  db.prepare("INSERT INTO files (id,pid,uid,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.team.id, req.user.id, name, mime, req.body.length, now());
  res.json({ fid: id, fn: name, fk: fileKind(mime) });
});
// 업로드 크기 초과 등 오류를 JSON으로 알려 줘요
app.use("/api/teams/:pid/upload", (err, req, res, next) =>
  res.status(err.type === "entity.too.large" ? 413 : 400).json({ error: err.type === "entity.too.large" ? `파일은 ${MAX_UPLOAD_MB}MB까지 올릴 수 있어요.` : "파일을 올리지 못했어요." }));
// 파일 열기/내려받기: 그 팀의 팀원만
app.get("/api/files/:fid", requireUser, (req, res) => {
  const f = db.prepare("SELECT * FROM files WHERE id=?").get(String(req.params.fid)), p = f && findPost(f.pid);
  if (!f || !p || !isMember(p, req.user.id)) return res.status(404).json({ error: "파일을 찾을 수 없어요." });
  res.set({ "Content-Type": f.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${req.query.dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  fs.createReadStream(path.join(UPLOAD_DIR, f.id)).on("error", () => res.status(404).end()).pipe(res);
});

// 공지
app.post("/api/teams/:pid/nt", requireMember, (req, res) => {
  if (!req.editor) return deny(res, "공지는 팀장이나 권한을 받은 팀원만 올릴 수 있어요.");
  const b = req.body || {}, t = str(b.t, 100), u = str(b.u, 500), f = teamFile(req.team.id, b.fid);
  if (!t) return res.status(400).json({ error: "공지 제목을 입력해 주세요." });
  if (u && !isUrl(u)) return res.status(400).json({ error: "링크는 https:// 로 시작해야 해요." });
  if (b.fid && !f) return res.status(400).json({ error: "첨부 파일을 찾을 수 없어요." });
  db.prepare("INSERT INTO team_nt (pid,uid,uname,title,body,url,fid,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(req.team.id, req.user.id, req.user.name, t, str(b.b, 2000), u, f ? f.id : null, now());
  res.json({ ok: true });
});
app.put("/api/teams/:pid/nt/:id", requireMember, (req, res) => {
  const n = db.prepare("SELECT * FROM team_nt WHERE id=? AND pid=?").get(+req.params.id, req.team.id);
  if (!n) return res.status(404).json({ error: "없는 공지예요." });
  if (!canEditNotice(req, n)) return deny(res, "팀장은 모든 공지를, 권한을 받은 팀원은 자기가 쓴 공지만 수정할 수 있어요.");
  const b = req.body || {}, t = str(b.t, 100), u = str(b.u, 500);
  if (!t) return res.status(400).json({ error: "공지 제목을 입력해 주세요." });
  if (u && !isUrl(u)) return res.status(400).json({ error: "링크는 https:// 로 시작해야 해요." });
  db.prepare("UPDATE team_nt SET title=?, body=?, url=? WHERE id=?").run(t, str(b.b, 2000), u, n.id);
  res.json({ ok: true });
});

// 채팅
const CHAT_BLOCK = { muted: "이 팀채팅에서 신고가 접수되어 관리자가 확인할 때까지 채팅을 할 수 없어요.",
  banned: "이 팀채팅에서 채팅 권한이 영구 박탈되어 채팅을 할 수 없어요.", global: "관리자가 채팅 권한을 박탈해 모든 팀채팅에서 채팅을 할 수 없어요." };
app.post("/api/teams/:pid/msgs", requireMember, (req, res) => {
  const cs = chatState(req.team.id, req.user);
  if (cs !== "ok") return res.status(403).json({ error: CHAT_BLOCK[cs] || CHAT_BLOCK.muted, code: "chat_" + cs });
  const t = str((req.body || {}).t, 1000);
  if (!t) return res.status(400).json({ error: "메시지를 입력해 주세요." });
  db.prepare("INSERT INTO team_msgs (pid,uid,uname,text,created_at) VALUES (?,?,?,?,?)").run(req.team.id, req.user.id, req.user.name, t, now());
  res.json({ ok: true });
});
app.post("/api/teams/:pid/msgs/:id/check", requireMember, (req, res) => {
  const m = db.prepare("SELECT id FROM team_msgs WHERE id=? AND pid=?").get(+req.params.id, req.team.id);
  if (!m) return res.status(404).json({ error: "없는 메시지예요." });
  const del = db.prepare("DELETE FROM team_msg_ck WHERE mid=? AND uid=?").run(m.id, req.user.id);
  if (!del.changes) db.prepare("INSERT INTO team_msg_ck (mid,uid) VALUES (?,?)").run(m.id, req.user.id);
  res.json({ ok: true });
});
// 채팅 신고: 사유를 적어 신고하면, 신고당한 사람은 관리자가 확인할 때까지 채팅을 못 해요
app.post("/api/teams/:pid/msgs/:id/report", requireMember, (req, res) => {
  const m = db.prepare("SELECT * FROM team_msgs WHERE id=? AND pid=?").get(+req.params.id, req.team.id);
  if (!m) return res.status(404).json({ error: "없는 메시지예요." });
  if (m.uid === req.user.id) return res.status(400).json({ error: "내 메시지는 신고할 수 없어요." });
  const detail = str((req.body || {}).detail, 500);
  if (!detail) return res.status(400).json({ error: "신고 사유를 적어 주세요." });
  if (db.prepare("SELECT 1 FROM reports WHERE ttype='msg' AND tid=? AND reporter=? AND status='open'").get(String(m.id), req.user.id))
    return res.status(409).json({ error: "이미 신고한 메시지예요. 관리자가 확인 중이에요." });
  const snap = JSON.stringify({ pid: m.pid, team: req.team.name, uid: m.uid, uname: m.uname, text: m.text, at: m.created_at });
  db.prepare("INSERT INTO reports (ttype,tid,reporter,reason,detail,snap,created_at) VALUES ('msg',?,?,?,?,?,?)")
    .run(String(m.id), req.user.id, "채팅 신고", detail, snap, now());
  const target = findUser(m.uid);
  // 이 팀채팅에서만 채팅을 막아요 (관리자 계정, 이미 영구 박탈된 경우는 그대로)
  if (target && target.role !== "admin")
    db.prepare("INSERT OR IGNORE INTO team_chat_block (pid,uid,status,reason,created_at) VALUES (?,?,'muted',?,?)")
      .run(req.team.id, target.id, "채팅 신고 접수 (관리자 확인 대기)", now());
  res.json({ ok: true });
});

// 자료 라이브러리: 이미지·PDF 파일 또는 링크
app.post("/api/teams/:pid/lib", requireMember, (req, res) => {
  const b = req.body || {}, f = teamFile(req.team.id, b.fid);
  if (f) {
    const k = fileKind(f.mime);
    if (k !== "img" && k !== "pdf") return res.status(400).json({ error: "자료 라이브러리에는 jpg, png, pdf만 올릴 수 있어요." });
    db.prepare("INSERT INTO team_lib (pid,uid,kind,name,fid,created_at) VALUES (?,?,?,?,?,?)").run(req.team.id, req.user.id, k === "img" ? "이미지" : "PDF", f.name, f.id, now());
  } else if (isUrl(b.u)) {
    const u = str(b.u, 500);
    db.prepare("INSERT INTO team_lib (pid,uid,kind,name,url,created_at) VALUES (?,?,'링크',?,?,?)").run(req.team.id, req.user.id, u, u, now());
  } else return res.status(400).json({ error: "파일을 고르거나 https:// 링크를 입력해 주세요." });
  res.json({ ok: true });
});

// 투표
const readOpts = o => [...new Set((Array.isArray(o) ? o : []).map(x => str(x, 100)).filter(Boolean))].slice(0, 20);
app.post("/api/teams/:pid/vt", requireMember, (req, res) => {
  const q = str((req.body || {}).q, 200), o = readOpts((req.body || {}).o);
  if (!q || o.length < 2) return res.status(400).json({ error: "질문과 선택지를 2개 이상 입력해 주세요." });
  db.prepare("INSERT INTO team_vt (pid,uid,q,opts,created_at) VALUES (?,?,?,?,?)").run(req.team.id, req.user.id, q, JSON.stringify(o), now());
  res.json({ ok: true });
});
// 투표 수정: 그대로 둔 선택지는 표가 유지되고, 사라진 선택지의 표는 없어져요
app.put("/api/teams/:pid/vt/:id", requireMember, (req, res) => {
  if (!req.editor) return deny(res, NEED_EDITOR);
  const v =db.prepare("SELECT * FROM team_vt WHERE id=? AND pid=?").get(+req.params.id, req.team.id);
  if (!v) return res.status(404).json({ error: "없는 투표예요." });
  const q = str((req.body || {}).q, 200), o = readOpts((req.body || {}).o), old = JSON.parse(v.opts);
  if (!q || o.length < 2) return res.status(400).json({ error: "질문과 선택지를 2개 이상 입력해 주세요." });
  for (const p of db.prepare("SELECT uid, opt FROM team_vt_pick WHERE vid=?").all(v.id)) {
    const ni = o.indexOf(old[p.opt]);
    if (ni < 0) db.prepare("DELETE FROM team_vt_pick WHERE vid=? AND uid=?").run(v.id, p.uid);
    else db.prepare("UPDATE team_vt_pick SET opt=? WHERE vid=? AND uid=?").run(ni, v.id, p.uid);
  }
  db.prepare("UPDATE team_vt SET q=?, opts=? WHERE id=?").run(q, JSON.stringify(o), v.id);
  res.json({ ok: true });
});
// 투표하기: 같은 선택지를 다시 누르면 취소, 다른 걸 누르면 바꾸기
app.post("/api/teams/:pid/vt/:id/pick", requireMember, (req, res) => {
  const v = db.prepare("SELECT * FROM team_vt WHERE id=? AND pid=?").get(+req.params.id, req.team.id), o = +(req.body || {}).o;
  if (!v) return res.status(404).json({ error: "없는 투표예요." });
  if (!(o >= 0 && o < JSON.parse(v.opts).length)) return res.status(400).json({ error: "없는 선택지예요." });
  const cur = db.prepare("SELECT opt FROM team_vt_pick WHERE vid=? AND uid=?").get(v.id, req.user.id);
  db.prepare("DELETE FROM team_vt_pick WHERE vid=? AND uid=?").run(v.id, req.user.id);
  if (!cur || cur.opt !== o) db.prepare("INSERT INTO team_vt_pick (vid,uid,opt) VALUES (?,?,?)").run(v.id, req.user.id, o);
  res.json({ ok: true });
});

// 일정 / 해야할 일
app.post("/api/teams/:pid/ev", requireMember, (req, res) => {
  if (!req.editor) return deny(res, NEED_EDITOR);
  const b = req.body || {}, t = str(b.t, 100);
  if (!isDate(b.d) || !t) return res.status(400).json({ error: "날짜와 일정 제목을 입력해 주세요." });
  db.prepare("INSERT INTO team_ev (pid,uid,d,title,todo,done,created_at) VALUES (?,?,?,?,?,0,?)").run(req.team.id, req.user.id, b.d, t, b.todo ? 1 : 0, now());
  res.json({ ok: true });
});
app.put("/api/teams/:pid/ev/:id", requireMember, (req, res) => {
  if (!req.editor) return deny(res, NEED_EDITOR);
  const b = req.body || {}, t = str(b.t, 100);
  if (!isDate(b.d) || !t) return res.status(400).json({ error: "날짜와 일정 제목을 입력해 주세요." });
  const r = db.prepare("UPDATE team_ev SET d=?, title=?, todo=?, done=CASE WHEN ? THEN done ELSE 0 END WHERE id=? AND pid=?")
    .run(b.d, t, b.todo ? 1 : 0, b.todo ? 1 : 0, +req.params.id, req.team.id);
  res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: "없는 일정이에요." });
});
app.post("/api/teams/:pid/ev/:id/done", requireMember, (req, res) => {
  const r = db.prepare("UPDATE team_ev SET done=1-done WHERE id=? AND pid=? AND todo=1").run(+req.params.id, req.team.id);
  res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: "없는 할 일이에요." });
});

// 시간 조율: 날짜 + 시간(0~23시)을 누를 때마다 내 '가능' 표시를 켜고 꺼요
app.post("/api/teams/:pid/avail", requireMember, (req, res) => {
  const { d } = req.body || {}, h = +(req.body || {}).h;
  if (!isDate(d) || !Number.isInteger(h) || h < 0 || h > 23) return res.status(400).json({ error: "날짜와 시간이 올바르지 않아요." });
  const del = db.prepare("DELETE FROM team_av WHERE pid=? AND uid=? AND d=? AND h=?").run(req.team.id, req.user.id, d, h);
  if (!del.changes) db.prepare("INSERT INTO team_av (pid,uid,d,h) VALUES (?,?,?,?)").run(req.team.id, req.user.id, d, h);
  res.json({ ok: true });
});

// 삭제: 공지(nt) · 자료(lib) · 투표(vt) · 일정(ev)
app.delete("/api/teams/:pid/:kind/:id", requireMember, (req, res) => {
  const pid = req.team.id, id = +req.params.id, kind = req.params.kind;
  const table = { nt: "team_nt", lib: "team_lib", vt: "team_vt", ev: "team_ev" }[kind];
  if (!table) return res.status(404).json({ error: "알 수 없는 항목이에요." });
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=? AND pid=?`).get(id, pid);
  if (!row) return res.status(404).json({ error: "이미 삭제된 항목이에요." });
  // 권한: 공지(팀장=모두, 권한 팀원=자기 글) · 자료(팀장=모두, 팀원=자기 자료) · 투표/일정(팀장·권한 팀원)
  if (kind === "nt" && !canEditNotice(req, row)) return deny(res, "팀장은 모든 공지를, 권한을 받은 팀원은 자기가 쓴 공지만 삭제할 수 있어요.");
  if (kind === "lib" && !canDelLib(req, row)) return deny(res, "자기가 올린 자료만 삭제할 수 있어요. (팀장은 모두 삭제 가능)");
  if ((kind === "vt" || kind === "ev") && !req.editor) return deny(res, NEED_EDITOR);
  if (row.fid) removeFile(row.fid);
  if (kind === "vt") db.prepare("DELETE FROM team_vt_pick WHERE vid=?").run(id);
  db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  res.json({ ok: true });
});

// ----- 팀장 전용: 수정 권한 주기/회수, 팀에서 내보내기 -----
const teamMember = (req, res) => {
  if (!req.lead) { deny(res, "팀장만 할 수 있어요."); return null; }
  const uid = String(req.params.uid), mem = JSON.parse(req.team.mem), m = mem.find(x => x.uid === uid);
  if (!m) { res.status(404).json({ error: "이 팀의 팀원이 아니에요." }); return null; }
  if (uid === req.team.owner) { res.status(400).json({ error: "팀장 본인에게는 할 수 없어요." }); return null; }
  return { uid, mem, m };
};
app.post("/api/teams/:pid/members/:uid/editor", requireMember, (req, res) => {
  const t = teamMember(req, res); if (!t) return;
  if ((req.body || {}).on) db.prepare("INSERT OR IGNORE INTO team_editors (pid,uid) VALUES (?,?)").run(req.team.id, t.uid);
  else db.prepare("DELETE FROM team_editors WHERE pid=? AND uid=?").run(req.team.id, t.uid);
  res.json({ ok: true });
});
// 내보내기: 팀원 목록에서 빼고, 팀채팅 접근을 막아요 (같은 팀에 다시 지원할 수 없어요). 쓴 글과 메시지는 남아요
app.post("/api/teams/:pid/members/:uid/kick", requireMember, (req, res) => {
  const t = teamMember(req, res); if (!t) return;
  db.prepare("UPDATE posts SET mem=? WHERE id=?").run(JSON.stringify(t.mem.filter(x => x.uid !== t.uid)), req.team.id);
  db.prepare("UPDATE apps SET st='k', updated_at=? WHERE pid=? AND uid=? AND st='a'").run(now(), req.team.id, t.uid);
  db.prepare("DELETE FROM team_editors WHERE pid=? AND uid=?").run(req.team.id, t.uid);
  db.prepare("DELETE FROM team_av WHERE pid=? AND uid=?").run(req.team.id, t.uid);
  db.prepare("DELETE FROM team_chat_block WHERE pid=? AND uid=?").run(req.team.id, t.uid);
  res.json({ ok: true });
});

// ===== 관리자: 회원 =====
const setChat = (uid, st, reason = null) => db.prepare("UPDATE users SET chat_status=?, chat_reason=? WHERE id=?").run(st, st === "ok" ? null : reason, uid);
// 목록 + 검색 (q: ID·이름·이메일 일부, status: 상태)
app.get("/api/admin/users", requireAdmin, (req, res) => {
  sweep();
  const q = `%${String(req.query.q || "").trim()}%`, st = String(req.query.status || "");
  const rows = db.prepare(`SELECT id,name,email,role,status,reason,until,last_login,created_at,withdrawn_at,
    IFNULL(chat_status,'ok') chat_status, chat_reason,
    (SELECT COUNT(*) FROM team_chat_block b WHERE b.uid=users.id) team_blocks FROM users
    WHERE (id LIKE ? OR name LIKE ? OR email LIKE ?) ${st ? "AND status=?" : ""} ORDER BY created_at DESC`)
    .all(...(st ? [q, q, q, st] : [q, q, q]));
  res.json(rows.map(u => ({ ...u, purge_at: u.withdrawn_at && u.status === "withdrawn"
    ? new Date(new Date(u.withdrawn_at).getTime() + PURGE_DAYS * 864e5).toISOString() : null })));
});
app.get("/api/admin/policy", requireAdmin, (req, res) => res.json({ DORMANT_DAYS, PURGE_DAYS, SUSPEND_DAYS, REPORT_REASONS }));
// 계정 상태 바꾸기
app.post("/api/admin/users/:id/action", requireAdmin, (req, res) => {
  const t = findUser(req.params.id), { action, days, reason } = req.body || {};
  const why = String(reason || "").trim();
  if (!t) return res.status(404).json({ error: "없는 회원이에요." });
  if (t.role === "admin") return res.status(403).json({ error: "관리자 계정의 상태는 바꿀 수 없어요." });
  const set = (status, r = null, until = null) => db.prepare("UPDATE users SET status=?, reason=?, until=? WHERE id=?").run(status, r, until, t.id);
  const is = (...s) => s.includes(t.status);
  switch (action) {
    case "suspend":
      if (!is("active", "suspended", "dormant")) return res.status(400).json({ error: "이 상태에서는 일시 정지할 수 없어요." });
      if (!SUSPEND_DAYS.includes(+days)) return res.status(400).json({ error: "정지 기간을 골라 주세요." });
      if (!why) return res.status(400).json({ error: "정지 사유를 입력해 주세요." });
      set("suspended", why, daysLater(+days)); break;
    case "ban":
      if (!is("active", "suspended", "dormant")) return res.status(400).json({ error: "이 상태에서는 영구 차단할 수 없어요." });
      if (!why) return res.status(400).json({ error: "차단 사유를 입력해 주세요." });
      set("banned", why); break;
    case "activate": // 정지·차단·휴면 해제
      if (!is("suspended", "banned", "dormant")) return res.status(400).json({ error: "해제할 상태가 아니에요." });
      set("active"); db.prepare("UPDATE users SET last_login=? WHERE id=?").run(now(), t.id); break;
    case "dormant":
      if (!is("active")) return res.status(400).json({ error: "정상 회원만 휴면 처리할 수 있어요." });
      set("dormant", "관리자 휴면 처리"); break;
    case "withdraw": // 강제 탈퇴 (PURGE_DAYS 동안 복구 가능)
      if (is("withdrawn", "purged")) return res.status(400).json({ error: "이미 탈퇴한 회원이에요." });
      if (!why) return res.status(400).json({ error: "탈퇴 사유를 입력해 주세요." });
      withdraw(t.id, "관리자 강제 탈퇴: " + why); break;
    case "restore":
      if (!is("withdrawn")) return res.status(400).json({ error: "복구할 수 있는 탈퇴 회원이 아니에요." });
      db.prepare("UPDATE users SET status='active', reason=NULL, withdrawn_at=NULL, last_login=? WHERE id=?").run(now(), t.id); break;
    case "purge": // 보관 기간을 기다리지 않고 즉시 파기
      if (!is("withdrawn")) return res.status(400).json({ error: "탈퇴한 회원만 파기할 수 있어요." });
      purgeUser(t.id); break;
    case "chatRestore": // 전체 채팅 박탈 해제 (팀별 신고 제한은 각 신고에서 따로 처리)
      setChat(t.id, "ok"); break;
    case "chatBan": // 모든 팀채팅에서 채팅 박탈
      setChat(t.id, "banned", why || "관리자 결정"); break;
    default: return res.status(400).json({ error: "알 수 없는 작업이에요." });
  }
  res.json({ ok: true });
});

// ===== 관리자: 모집글 =====
const appCounts = pid => {
  const c = { w: 0, p: 0, r: 0, a: 0, rc: 0, x: 0 };
  for (const r of db.prepare("SELECT st, COUNT(*) n FROM apps WHERE pid=? GROUP BY st").all(pid)) c[r.st] = r.n;
  return c;
};
app.get("/api/admin/posts", requireAdmin, (req, res) => {
  const q = `%${String(req.query.q || "").trim()}%`;
  const rows = db.prepare(`SELECT p.*, (SELECT status FROM users WHERE id=p.owner) owner_status,
    (SELECT COUNT(*) FROM reports WHERE ttype='post' AND tid=CAST(p.id AS TEXT) AND status='open') open_reports
    FROM posts p WHERE p.name LIKE ? OR p.ctitle LIKE ? OR IFNULL(p.owner,'') LIKE ? OR IFNULL(p.owner_name,'') LIKE ? ORDER BY p.id DESC`).all(q, q, q, q);
  res.json(rows.map(p => ({ ...postOut(p, { role: "admin" }), ownerStatus: p.owner_status, openReports: p.open_reports, counts: appCounts(p.id), createdAt: p.created_at })));
});
app.post("/api/admin/posts/:id/blind", requireAdmin, (req, res) => {
  const p = findPost(+req.params.id), { blind, reason } = req.body || {};
  if (!p) return res.status(404).json({ error: "없는 모집글이에요." });
  const why = String(reason || "").trim();
  if (blind && !why) return res.status(400).json({ error: "블라인드 사유를 입력해 주세요." });
  db.prepare("UPDATE posts SET blinded=?, blind_reason=? WHERE id=?").run(blind ? 1 : 0, blind ? why : null, p.id);
  res.json({ ok: true });
});
app.post("/api/admin/posts/:id/status", requireAdmin, (req, res) => {
  const p = findPost(+req.params.id), st = (req.body || {}).status;
  if (!p) return res.status(404).json({ error: "없는 모집글이에요." });
  if (!["open", "closed"].includes(st)) return res.status(400).json({ error: "모집 상태가 올바르지 않아요." });
  db.prepare("UPDATE posts SET status=? WHERE id=?").run(st, p.id);
  res.json({ ok: true });
});

// ===== 관리자: 매칭 현황 =====
app.get("/api/admin/matching", requireAdmin, (req, res) => {
  const posts = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
  const tot = { w: 0, p: 0, r: 0, a: 0, rc: 0, x: 0 };
  for (const r of db.prepare("SELECT st, COUNT(*) n FROM apps GROUP BY st").all()) tot[r.st] = r.n;
  const rows = posts.map(p => {
    const m = JSON.parse(p.mem).length;
    return { id: p.id, name: p.name, ctitle: p.ctitle, ownerName: p.owner_name, mem: m, max: p.max, full: m >= p.max,
      status: p.status, blinded: !!p.blinded, counts: appCounts(p.id) };
  });
  const recent = db.prepare(`SELECT a.id, a.uname, a.role, a.st, a.updated_at, p.name pname FROM apps a
    LEFT JOIN posts p ON p.id=a.pid ORDER BY a.updated_at DESC LIMIT 20`).all();
  const decided = tot.a + tot.p + tot.r + tot.rc + tot.x;
  res.json({
    summary: { posts: posts.length, open: rows.filter(r => r.status === "open" && !r.full).length,
      closed: rows.filter(r => r.status === "closed" || r.full).length, blinded: rows.filter(r => r.blinded).length,
      apps: tot, acceptRate: decided ? Math.round((tot.a + tot.p + tot.x) / decided * 100) : 0 },
    rows, recent,
  });
});

// ===== 관리자: 신고 =====
// 채팅 신고 대상: 신고 당시 메시지 사본 + 앞뒤 대화(각 5개)를 함께 보여 줘요
function msgTarget(r) {
  const s = JSON.parse(r.snap || "{}"), u = s.uid && findUser(s.uid), id = +r.tid;
  const around = db.prepare(`SELECT * FROM (SELECT * FROM team_msgs WHERE pid=? AND id<? ORDER BY id DESC LIMIT 5)
    UNION ALL SELECT * FROM team_msgs WHERE id=? UNION ALL SELECT * FROM (SELECT * FROM team_msgs WHERE pid=? AND id>? ORDER BY id LIMIT 5)`)
    .all(s.pid, id, id, s.pid, id).sort((a, b) => a.id - b.id);
  return { label: `${s.uname || "알 수 없음"} (${s.uid || "-"})`, owner: s.uid, team: s.team, text: s.text, at: s.at,
    status: u ? u.status : null, chat: chatState(s.pid, u), gone: !u,
    context: around.map(m => ({ id: m.id, w: m.uname, t: m.text, at: m.created_at, hit: m.id === id })) };
}
// 채팅 신고 처리: 신고가 일어난 그 팀채팅에서만 채팅 권한을 돌려주거나(신고 반려) 영구 박탈(처리 완료)
// 같은 팀에서 같은 회원에 대한 다른 접수 건도 함께 처리해요
app.post("/api/admin/reports/:id/chat", requireAdmin, (req, res) => {
  const r = db.prepare("SELECT * FROM reports WHERE id=? AND ttype='msg'").get(+req.params.id), { action, note } = req.body || {};
  if (!r) return res.status(404).json({ error: "없는 채팅 신고예요." });
  const s = JSON.parse(r.snap || "{}"), u = s.uid && findUser(s.uid);
  if (!u) return res.status(404).json({ error: "신고 대상 회원을 찾을 수 없어요." });
  if (u.role === "admin") return res.status(403).json({ error: "관리자 계정은 바꿀 수 없어요." });
  if (!["restore", "ban"].includes(action)) return res.status(400).json({ error: "알 수 없는 작업이에요." });
  const memo = String(note || "").trim() || (action === "ban" ? "이 팀채팅에서 채팅 권한 영구 박탈" : "문제 없음 · 채팅 권한 복구");
  if (action === "ban") db.prepare("INSERT OR REPLACE INTO team_chat_block (pid,uid,status,reason,created_at) VALUES (?,?,'banned',?,?)").run(s.pid, u.id, memo, now());
  else db.prepare("DELETE FROM team_chat_block WHERE pid=? AND uid=?").run(s.pid, u.id);
  const open = db.prepare("SELECT id, snap FROM reports WHERE ttype='msg' AND status='open'").all()
    .filter(x => { const y = JSON.parse(x.snap || "{}"); return x.id === r.id || (y.uid === u.id && y.pid === s.pid); });
  for (const x of open) db.prepare("UPDATE reports SET status=?, note=?, handled_at=? WHERE id=?")
    .run(action === "ban" ? "done" : "rejected", x.id === r.id ? memo : memo + " (같은 팀·같은 회원에 대한 결정으로 함께 처리)", now(), x.id);
  res.json({ ok: true, handled: open.length });
});
app.get("/api/admin/reports", requireAdmin, (req, res) => {
  const st = String(req.query.status || "");
  const rows = db.prepare(`SELECT * FROM reports ${st ? "WHERE status=?" : ""} ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC`).all(...(st ? [st] : []));
  res.json(rows.map(r => {
    let target;
    if (r.ttype === "post") { const p = findPost(+r.tid); target = p ? { label: `${p.name} (${p.ctitle})`, owner: p.owner, ownerName: p.owner_name, blinded: !!p.blinded, status: p.status } : { label: "삭제된 모집글", gone: true }; }
    else if (r.ttype === "msg") target = msgTarget(r);
    else { const u = findUser(r.tid); target = u ? { label: `${u.name} (${u.id})`, status: u.status, chat: (u.chat_status || "ok") === "banned" ? "global" : "ok" } : { label: "없는 회원", gone: true }; }
    const rep = findUser(r.reporter);
    return { ...r, target, reporterName: rep ? rep.name : r.reporter };
  }));
});
app.post("/api/admin/reports/:id", requireAdmin, (req, res) => {
  const r = db.prepare("SELECT * FROM reports WHERE id=?").get(+req.params.id), { status, note } = req.body || {};
  if (!r) return res.status(404).json({ error: "없는 신고예요." });
  if (!["open", "done", "rejected"].includes(status)) return res.status(400).json({ error: "처리 상태가 올바르지 않아요." });
  db.prepare("UPDATE reports SET status=?, note=?, handled_at=? WHERE id=?")
    .run(status, String(note || "").trim() || null, status === "open" ? null : now(), r.id);
  res.json({ ok: true });
});

// 포트: 환경변수 PORT가 있으면 그 값, 없으면 3000
const PORT = +process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버가 켜졌어요: http://localhost:${PORT}/`));
