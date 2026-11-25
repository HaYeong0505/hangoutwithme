// 마이페이지 화면: 프로필, 지원 현황, 캘린더 모으기, 완료된 프로젝트, 후기

function myEv(){const ev=[];S.apps.forEach(a=>{const t=TM.find(x=>x.id===a.tid);if(!t)return;const c=ctOf(t);
if(a.st==="a")room(t.id).ev.forEach(e=>ev.push({d:e.d,t:t.name+" · "+e.t,c:"var(--red)"}));
if(c.d)ev.push({d:c.d,t:c.t+" 마감",c:a.st==="a"?"var(--red)":a.st==="w"?"#f08a00":"#2b6de0"})});
TM.filter(t=>t.mine).forEach(t=>room(t.id).ev.forEach(e=>ev.push({d:e.d,t:t.name+" · "+e.t,c:"var(--red)"})));return ev}
function pMy(){if(!S.user)return need("마이페이지");const u=S.user,P=S.prof,tn=id=>TM.find(x=>x.id===id).name;
const grp=(st,lab)=>{const l=S.apps.filter(a=>a.st===st);return `<div class="sh">${lab} (${l.length})</div>`+(l.map(a=>`<div class="it"><div><b>${E(tn(a.tid))}</b><span class="m">${E(a.role)} 지원${a.st==="c"?" · 결과: "+(a.res==="합"?"합격":"불합격"):""}</span></div>${st==="w"?`<span class="m">팀장 결정 대기 중</span>`:st==="c"?`<span style="white-space:nowrap">${a.res==="합"?`<button class="btn sm o" data-a="skip" data-id="${a.tid}">불참여</button> `:""}<button class="btn sm r" data-a="confirm" data-id="${a.tid}">${a.res==="합"?"합격 확인 · 참여":"확인"}</button></span>`:`<a class="red" href="#team">팀채팅</a>`}</div>`).join("")||`<p class="empty" style="padding:6px 0">없음</p>`)};
const avg=S.rv.length?S.rv.reduce((a,r)=>a+r.s,0)/S.rv.length:0,ev=myEv(),myT=TM.filter(t=>t.mine);
return `<div class="in"><h2 class="pt">마이페이지</h2><div class="two">
<div class="box"><b style="font-size:18px">개인 프로필</b><p class="m" style="margin:2px 0 0">${E(u.name)} · ${E(u.id)} · ${E(u.email)}</p>
<label for="aff">소속</label><div class="row" style="margin:0"><input id="aff" value="${E(P.aff)}" placeholder="예: 한국대학교 디자인학과"><button class="btn sm" data-a="affSave">저장</button></div>
<div class="sh">수상내역</div>${P.aw.map((w,i)=>`<div class="it"><span>${E(w)}</span><button class="btn sm o" data-a="awDel" data-i="${i}">삭제</button></div>`).join("")||`<p class="empty" style="padding:6px 0">없음</p>`}<div class="row"><input id="awi" placeholder="예: 2025 교내 해커톤 대상"><button class="btn sm" data-a="awAdd">추가</button></div>
<div class="sh">경력 · 자격증</div>${P.car.map((w,i)=>`<div class="it"><span>${E(w)}</span><button class="btn sm o" data-a="carDel" data-i="${i}">삭제</button></div>`).join("")||`<p class="empty" style="padding:6px 0">없음</p>`}<div class="row"><input id="cari" placeholder="예: 정보처리기사 (2025.06), ○○ 인턴 3개월"><button class="btn sm" data-a="carAdd">추가</button></div>
<div class="sh">포폴 / 작업물</div>${P.pf.map((p,i)=>`<div class="it"><a href="${E(p.u)}" target="_blank" rel="noopener"><b>${E(p.t)}</b><span class="m">${E(p.u)}</span></a><button class="btn sm o" data-a="pfDel" data-i="${i}">삭제</button></div>`).join("")||`<p class="empty" style="padding:6px 0">없음</p>`}<div class="row"><input id="pft" placeholder="제목"><input id="pfu" placeholder="링크 (https://…)"><button class="btn sm" data-a="pfAdd">추가</button></div></div>
<div class="box"><b style="font-size:18px">지원 현황</b>
<div style="margin-top:12px;padding:8px 12px;background:var(--soft);border-radius:4px;font-weight:700">📤 내가 지원한 팀</div>${grp("a","현재 참여 중")}${grp("w","대기")}${grp("c","확인 요망")}
<div style="border-top:2px solid var(--ink);margin:22px 0 0"></div>
<div style="margin-top:16px;padding:8px 12px;background:var(--soft);border-radius:4px;font-weight:700">📥 내가 만든 팀 (${myT.length})</div>
${myT.length?"":`<p class="empty" style="padding:6px 0">만든 팀이 없어요. 모집글 메뉴에서 팀을 만들어 보세요.</p>`}${myT.map(t=>{const c=ctOf(t),l=S.recv.filter(r=>r.tid===t.id);return `<div style="border:1px solid var(--line);border-radius:6px;padding:12px 14px;margin-top:12px"><b style="font-size:16px">${E(t.name)}</b> <span class="lv l${t.lv}">${LV[t.lv]}</span>${t.blinded?` <span class="red" style="font-size:12px">블라인드됨</span>`:""}<span class="m" style="display:block">${E(c.t)} · 팀원 ${t.mem.length}/${t.max}</span>
<div class="sh" style="margin-top:8px">받은 신청서 (${l.length})</div>${l.map(r=>{const i=S.recv.indexOf(r);return `<div class="it"><div><b>${E(r.n)} <span class="rl">${E(r.role)}</span></b><span class="m">${E(r.intro)}</span></div><span style="white-space:nowrap"><button class="btn sm o" data-a="pv" data-i="${i}">프로필 보기</button> <button class="btn sm r" data-a="recv" data-i="${i}" data-v="1">합격</button> <button class="btn sm o" data-a="recv" data-i="${i}" data-v="0">불합격</button></span></div>`}).join("")||`<p class="empty" style="padding:6px 0">새 신청서가 없어요.</p>`}</div>`}).join("")}</div></div>
<div class="box" style="margin-top:20px"><b style="font-size:18px">캘린더 모으기</b> <span class="m">참여 중 <i style="color:var(--red)">●</i> 대기 <i style="color:#f08a00">●</i> 확인 요망 <i style="color:#2b6de0">●</i></span><div class="two" style="margin-top:10px"><div>${grid(S.mm,ev,S.sel)}</div><div>${evList(ev)}</div></div></div>
<div class="box" style="margin-top:20px"><b style="font-size:18px">완료된 프로젝트</b> <span class="m">함께한 팀원에게 후기를 남겨 보세요.</span>${S.done.map(p=>`<div style="border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin-top:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span class="st c">완료</span><b>${E(p.name)}</b><span class="m" style="display:block">${E(p.comp)} · ${E(p.role)} 담당 · ${p.end.replace(/-/g,".")} 종료${p.res?" · "+E(p.res):""}</span></div></div>
<div class="sh" style="margin-top:10px">팀원 (${p.mem.length})</div>${p.mem.map(m=>{const g=S.gv.find(x=>x.p===p.id&&x.n===m.n);return `<div class="it"><div><b>${E(m.n)} <span class="rl">${E(m.r)}</span></b>${g?`<span class="stars">${"★".repeat(g.s)}${"☆".repeat(5-g.s)}</span> <span class="m">${E(g.t)}</span>`:`<span class="m">아직 후기를 남기지 않았어요.</span>`}</div>${g?`<button class="btn sm o" data-a="rvDel" data-p="${p.id}" data-n="${E(m.n)}">후기 삭제</button>`:`<button class="btn sm r" data-a="rvW" data-p="${p.id}" data-n="${E(m.n)}">후기 쓰기</button>`}</div>`}).join("")}</div>`).join("")||`<p class="empty">완료된 프로젝트가 없어요.</p>`}</div>
<div class="box" style="margin-top:20px"><b style="font-size:18px">받은 후기 / 별점</b> <span class="stars">${avg?"★ "+avg.toFixed(1):""}</span>${S.rv.map(r=>`<div class="it"><div><b>${E(r.w)} <span class="stars">${"★".repeat(r.s)}${"☆".repeat(5-r.s)}</span></b><span class="m">${E(r.t)}</span></div></div>`).join("")||`<p class="empty">받은 후기가 없어요.</p>`}</div></div>`}
function rvM(pid,n){const p=S.done.find(x=>x.id===pid);S.rate=5;openM(`<h3 style="margin:0 0 2px">${E(n)}님에게 후기 남기기</h3><p class="m" style="margin:0">${E(p.name)} · ${E(p.comp)}</p><label>별점</label><div class="rate">${[1,2,3,4,5].map(k=>`<button type="button" data-a="rate" data-v="${k}" class="on" aria-label="${k}점">★</button>`).join("")}</div><label for="rvt">후기</label><textarea id="rvt" rows="4" placeholder="함께 작업하면서 좋았던 점을 적어 주세요."></textarea><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="rvOk" data-p="${pid}" data-n="${E(n)}">등록하기</button></div>`)}


// ───────── 프로필 저장 / 불러오기 (API 연결 자리) ─────────
// 지금은 화면(S.prof)에만 저장돼요. 서버 API가 생기면 아래 TODO 부분만 바꾸면 됨
// S.prof 모양: { aff: "소속", aw: ["수상내역"], car: ["경력·자격증"], pf: [{ t: "제목", u: "링크" }] }

// 프로필 버튼(소속 저장, 수상·경력·포폴 추가/삭제)을 누를 때마다 불러.
function mpSaveProf(msg){
  toast(msg);
  // TODO: 서버에 저장하기 (PUT /api/me/profile)
  // 힌트: api(주소, "PUT", 보낼데이터) 를 쓰고, 실패하면 .catch 로 에러 메시지를 toast 함.
}

// 로그인한 뒤 / 마이페이지에 들어올 때 내 프로필을 서버에서 가져오는 자리.
function mpLoadProf(){
  // TODO: 서버에서 불러오기 (GET /api/me/profile)
  // 힌트: 받아 온 값을 S.prof 에 넣고 render() 해서 화면을 다시 그림.
}
