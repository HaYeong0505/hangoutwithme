// 팀채팅 화면: 공지사항, 채팅, 자료 라이브러리, 투표, 캘린더/시간 조율 (내용은 모두 서버에 저장돼요)
// 권한: 팀장 / 수정 권한을 받은 팀원(editor) / 일반 팀원 — 버튼은 권한에 맞게만 보이고, 실제 검사는 서버가 다시 해요

function grid(o,evs,sel){const f=new Date(o.y,o.m,1).getDay(),n=new Date(o.y,o.m+1,0).getDate();
let h=["일","월","화","수","목","금","토"].map(d=>`<div class="w">${d}</div>`).join("")+`<div class="d e"></div>`.repeat(f);
for(let d=1;d<=n;d++){const iso=`${o.y}-${String(o.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;h+=`<div class="d${iso===sel?" t":""}" data-a="sel" data-d="${iso}">${d}<br>${evs.filter(e=>e.d===iso).map(e=>`<i style="background:${e.c}" title="${E(e.t)}"></i>`).join("")}</div>`}
return `<div class="ch"><b>${o.y}년 ${o.m+1}월</b><span><button class="sb" data-a="mv" data-v="-1" aria-label="이전 달">‹</button> <button class="sb" data-a="mv" data-v="1" aria-label="다음 달">›</button></span></div><div class="cal">${h}</div>`}
const evList=evs=>[...evs].sort((a,b)=>a.d<b.d?-1:1).map(e=>`<div class="it"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.c};margin-right:6px"></i>${E(e.t)}</span><span class="m">${md(e.d)}</span></div>`).join("")||`<p class="empty">일정이 없어요.</p>`;
// 팀원 시간 조율: 날짜 하루를 고르고 0~23시를 1시간 칸으로 나눠 '가능' 표시
// 칸에 마우스를 올리면(또는 키보드로 포커스하면) 그 시간에 가능한 사람 이름이 떠요
const hh=h=>String(h).padStart(2,"0");
function avail(r,t){const d=S.avd||(S.avd=ymd(new Date())),tot=Math.max(1,t.mem.length);
const by=[...Array(24).keys()].map(h=>r.av.filter(a=>a.d===d&&a.h===h)),mx=Math.max(0,...by.map(l=>l.length));
const dates=[...new Set(r.av.map(a=>a.d))].sort(),wk=["일","월","화","수","목","금","토"][new Date(d+"T00:00").getDay()];
const cells=by.map((l,h)=>{const mine=l.some(a=>a.me),tip=`${hh(h)}:00~${hh(h+1)}:00 · ${l.length}명 가능\n${l.length?l.map(a=>"· "+a.n+(a.me?" (나)":"")).join("\n"):"아직 표시한 사람이 없어요"}`;
return `<button class="hb${mine?" mine":""}${mx&&l.length===mx?" best":""}" data-a="av" data-d="${d}" data-h="${h}" data-tip="${E(tip)}" aria-label="${E(tip.replace(/\n/g,", "))}" style="background:rgba(231,27,27,${(l.length/tot*.55).toFixed(2)})">${hh(h)}시<b>${l.length}명${mine?" ✓":""}</b></button>`}).join("");
return `<div class="row" style="margin:0 0 10px;flex-wrap:nowrap"><button class="sb" data-a="avDay" data-v="-1" aria-label="이전 날">‹</button><input type="date" id="avd" value="${d}" aria-label="날짜 선택" style="flex:1;min-width:0"><span class="m" style="white-space:nowrap">(${wk})</span><button class="sb" data-a="avDay" data-v="1" aria-label="다음 날">›</button></div>
<div class="hg">${cells}</div>
<p class="m" style="margin:8px 0 0">칸을 누르면 내 '가능' 표시가 켜지고 꺼져요. 마우스를 올리면 가능한 사람 이름이 보여요.${mx?`<br>가장 많이 모이는 시간: <b class="red">${by.map((l,h)=>l.length===mx?hh(h)+"시":"").filter(Boolean).join(", ")}</b> (${mx}/${t.mem.length}명)`:""}</p>
${dates.length?`<p class="m" style="margin:6px 0 0">표시가 있는 날짜: ${dates.map(x=>`<button class="ck${x===d?" on":""}" data-a="avGo" data-v="${x}">${md(x)}</button>`).join(" ")}</p>`:""}`}

const edB=(k,i)=>`<button class="btn sm o" data-a="ed" data-k="${k}" data-i="${i}">수정</button>`;
const rmB=(k,i)=>`<button class="btn sm o" data-a="rm" data-k="${k}" data-i="${i}">삭제</button>`,RMN={nt:"공지",lib:"자료",vt:"투표",ev:"일정"};
const TT=[["nt","공지사항"],["chat","채팅"],["lib","자료 라이브러리"],["vt","투표"],["cal","캘린더"]];
const lock=msg=>`<p class="m" style="margin:0 0 10px;padding:8px 12px;background:var(--soft);border-radius:4px">🔒 ${msg}</p>`;
const myTeams=()=>TM.filter(t=>t.mine||(myApp(t.id)||{}).st==="a"); // 내가 팀장이거나 참여 중인 팀

// 팀장 전용: 팀원 역할·상태 보기, 수정 권한 주기/회수, 내보내기
const ACC={active:["계정 정상","var(--l1)"],suspended:["계정 일시 정지","var(--l2)"],banned:["계정 영구 차단","var(--l3)"],dormant:["휴면 계정","#7a7a85"],withdrawn:["탈퇴","#444"],purged:["탈퇴","#aaa"]};
// 이 팀에서의 채팅 상태 (신고는 신고가 일어난 팀에만 적용, global은 관리자가 모든 팀에서 박탈)
const CHT={muted:["이 팀 채팅 정지 (신고 확인 중)","var(--l2)"],banned:["이 팀 채팅 영구 박탈","var(--l3)"],global:["전체 채팅 박탈 (관리자)","var(--l3)"]};
const CHAT_LOCK={muted:"이 팀채팅에서 신고가 접수되어 관리자가 확인할 때까지 채팅을 할 수 없어요. 다른 팀채팅은 그대로 쓸 수 있어요.",banned:"이 팀채팅에서 채팅 권한이 영구 박탈되어 채팅을 할 수 없어요.",global:"관리자가 채팅 권한을 박탈해 모든 팀채팅에서 채팅을 할 수 없어요."};
function memberPanel(r){return `<div><b>팀원 관리</b> <span class="m">팀장에게만 보이는 탭이에요</span>
${r.members.map(m=>{const a=m.status&&ACC[m.status],c=m.chat&&CHT[m.chat];
const tags=[m.lead?badge("팀장","var(--ink)"):"",m.editor?badge("수정 권한","#2b6de0"):"",a?badge(a[0],a[1]):"",c?badge(c[0],c[1]):""].join("");
const info=m.status==="suspended"&&m.until?`<span class="m" style="display:block">정지 해제: ${fd(m.until)}</span>`:"";
const btns=m.lead||!m.uid?"":`<span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm o" data-a="tmEditor" data-uid="${E(m.uid)}" data-on="${m.editor?0:1}">${m.editor?"권한 회수":"수정 권한 주기"}</button><button class="btn sm r" data-a="tmKick" data-uid="${E(m.uid)}" data-n="${E(m.n)}">내보내기</button></span>`;
return `<div class="it"><div style="min-width:0"><b>${E(m.n)} <span class="rl">${E(m.r)}</span></b><span style="display:block;margin-top:2px">${tags}${m.uid?"":`<span class="m">예시 팀원</span>`}</span>${info}</div>${btns}</div>`}).join("")}
<p class="m" style="margin:8px 0 0">수정 권한을 받은 팀원은 공지 작성, 투표·일정 수정과 삭제를 할 수 있어요. 내보낸 팀원은 팀채팅에 들어올 수 없고 이 팀에 다시 지원할 수 없어요.</p></div>`}

function pTeam(){if(!S.user)return need("팀채팅");
const ts=myTeams();
if(!ts.length)return `<div class="in"><h2 class="pt">팀채팅</h2><p class="empty">참여 중인 팀이 없어요. 게시판에서 지원해 보세요.</p></div>`;
if(!ts.some(t=>t.id===S.tid))S.tid=ts[0].id;
const r=room(S.tid),t=TM.find(x=>x.id===S.tid);let p="";
const head=`<div class="in"><h2 class="pt">팀채팅</h2><div class="row" style="margin-top:0"><select id="tsel" aria-label="팀 선택" style="max-width:260px">${ts.map(x=>`<option value="${x.id}" ${x.id===S.tid?"selected":""}>${E(x.name)}</option>`).join("")}</select><span class="m">참여자 ${t.mem.length}명 · ${E(t.mem.join(", "))}</span></div>`;
if(r.loading||r.err)return head+`<div class="box" style="margin-top:12px"><p class="empty">${r.err?E(r.err):"불러오는 중…"}</p></div></div>`;
const pm=r.perm||{},ed=!!pm.editor;
// 탭: 팀장에게만 캘린더 옆에 '팀원 관리' 탭이 생겨요
const tabs=pm.lead&&r.members?[...TT,["mem","팀원 관리"]]:TT;
if(!tabs.some(([k])=>k===S.tt))S.tt="nt"; // 팀장이 아닌 팀으로 바꾸면 공지사항으로

// 공지: 팀장·권한 팀원만 작성. 팀장은 모든 글, 권한 팀원은 자기 글만 수정·삭제 (n.can)
if(S.tt==="nt")p=(ed?`<input id="nti" placeholder="공지 제목"><textarea id="ntb" rows="2" placeholder="내용" style="margin-top:8px"></textarea><div class="row"><input id="ntu" placeholder="링크 (https://…)"><input id="nim" type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4" aria-label="파일 첨부 (pdf, jpg, png, mp4)"><button class="btn r" data-a="ntAdd">공지 등록</button></div>`:lock("공지는 팀장과 수정 권한을 받은 팀원만 올릴 수 있어요. 읽기만 할 수 있어요."))
+(r.nt.map((n,i)=>`<div class="it nt" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>${E(n.t)}</b>${n.can?`<span style="white-space:nowrap">${edB("nt",i)} ${rmB("nt",i)}</span>`:""}</div><span class="m">${E(n.b)}</span>${n.u?`<br><a class="red" href="${E(n.u)}" target="_blank" rel="noopener">${E(n.u)}</a>`:""}${n.fk==="img"?`<br><img src="${n.f}" alt="첨부 이미지">`:n.fk==="mp4"?`<br><video src="${n.f}" controls style="max-width:100%;max-height:260px;border-radius:4px;margin-top:6px"></video>`:n.fk==="pdf"?`<br><span class="rl">PDF</span>${E(n.fn)} <button class="btn sm o" data-a="pvn" data-i="${i}">미리보기</button>`:""}${n.f?` <a class="btn sm o" href="${n.f}?dl=1" download="${E(n.fn)}" style="margin-top:6px;display:inline-block">다운로드</a>`:""}<br><span class="m">${E(n.w)} · ${n.d}</span></div>`).join("")||`<p class="empty">등록된 공지가 없어요.</p>`);

// 채팅: 다른 사람 말풍선을 우클릭하면 신고 메뉴. 채팅 정지 중이면 입력칸이 잠겨요
else if(S.tt==="chat"){const blocked=pm.chat&&pm.chat!=="ok";
p=`<div class="msgs" id="ms">${r.msgs.length?"":`<p class="empty">아직 메시지가 없어요. 첫 메시지를 보내 보세요.</p>`}${r.msgs.map((m,i)=>`<div class="mg${m.me?" me":""}"${m.me?"":` data-mid="${m.id}" title="우클릭하면 신고할 수 있어요"`}><small>${E(m.w)}</small><div class="bb">${E(m.t)}</div><small>${m.h} <button class="ck${m.my?" on":""}" data-a="ck" data-i="${i}">✓ 확인 ${m.ck+(m.my?1:0)}</button></small></div>`).join("")}</div>
${blocked?`<p class="red" style="margin:10px 0 0;font-size:14px">${CHAT_LOCK[pm.chat]||CHAT_LOCK.muted}</p>`:""}
<div class="row"><input id="ci" placeholder="${blocked?"지금은 채팅을 할 수 없어요":"메시지를 입력하세요"}" aria-label="메시지" ${blocked?"disabled":""}><button class="btn r" data-a="send" ${blocked?"disabled":""}>보내기</button></div>`}

// 자료: 누구나 추가. 삭제는 자기가 올린 자료만 (팀장은 모두) (x.can)
else if(S.tt==="lib")p=`<div class="row" style="margin:0 0 10px">${["전체","이미지","PDF","링크"].map(k=>`<button class="btn sm ${S.lf===k?"":"o"}" data-a="lf" data-v="${k}">${k}</button>`).join("")}</div>`+(r.lib.filter(x=>S.lf==="전체"||x.k===S.lf).map(x=>`<div class="it"><span><span class="rl">${x.k}</span>${x.u?`<a class="red" href="${E(x.u)}" target="_blank" rel="noopener">${E(x.n)}</a>`:E(x.n)}</span><span style="white-space:nowrap">${x.f?`<button class="btn sm o" data-a="pvf" data-i="${r.lib.indexOf(x)}">미리보기</button> <a class="btn sm o" href="${x.f}?dl=1" download="${E(x.n)}">다운로드</a> `:""}${x.can?rmB("lib",r.lib.indexOf(x)):""}</span></div>`).join("")||`<p class="empty">이 분류에 자료가 없어요.</p>`)+`<div class="row"><input id="lfile" type="file" accept=".jpg,.jpeg,.png,.pdf" aria-label="파일 (jpg, png, pdf)"><input id="lurl" placeholder="또는 링크 (https://…)"><button class="btn r" data-a="libAdd">추가</button></div><p class="m" style="margin:6px 0 0">자기가 올린 자료만 삭제할 수 있어요. (팀장은 모든 자료 삭제 가능)</p>`;

// 투표: 누구나 만들고 투표. 수정·삭제는 팀장·권한 팀원만
else if(S.tt==="vt")p=`<input id="vq" placeholder="투표 질문"><textarea id="vo" rows="3" placeholder="선택지를 줄바꿈으로 구분해 2개 이상 입력" style="margin-top:8px"></textarea><div class="row"><button class="btn r" data-a="vAdd">투표 만들기</button></div>${ed?"":`<p class="m" style="margin:6px 0 0">투표 수정·삭제는 팀장과 수정 권한을 받은 팀원만 할 수 있어요.</p>`}`+(r.vt.map((v,vi)=>{const tot=v.o.reduce((a,o)=>a+o.n,0);return `<div class="it" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>${E(v.q)}</b>${ed?`<span style="white-space:nowrap">${edB("vt",vi)} ${rmB("vt",vi)}</span>`:""}</div>${v.o.map((o,oi)=>`<button class="vb${v.my===oi?" on":""}" data-a="vote" data-v="${vi}" data-o="${oi}"><span class="vf" style="width:${tot?o.n/tot*100:0}%;position:absolute"></span><span>${E(o.x)}</span><span>${o.n}표</span></button>`).join("")}<span class="m">총 ${tot}명 참여 · 다시 누르면 선택을 바꿀 수 있어요</span></div>`}).join("")||`<p class="empty">진행 중인 투표가 없어요.</p>`);

// 캘린더: 일정 추가·수정·삭제는 팀장·권한 팀원만 (할 일 완료 체크와 시간 조율은 누구나)
// 팀원 관리 (팀장 전용 탭)
else if(S.tt==="mem")p=memberPanel(r);

else{const evs=r.ev.map(e=>({d:e.d,t:e.t,c:e.todo?"#f08a00":"var(--red)"}));
const calBox=`<div class="box">${grid(S.cm,evs,S.sel)}${ed?`<div class="row"><input type="date" id="ed" value="${S.sel}" aria-label="날짜"><input id="et" placeholder="일정 제목"></div><div class="row"><label style="margin:0;display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="etd" style="flex:none;min-width:0;margin:0">해야할 일 태그 붙이기</label><button class="btn r" data-a="evAdd">추가</button></div>`:`<div style="margin-top:12px">${lock("일정 추가·수정은 팀장과 수정 권한을 받은 팀원만 할 수 있어요.")}</div>`}</div>`;
const avBox=`<div class="box"><b>팀원 시간 조율</b><div style="margin-top:8px">${avail(r,t)}</div></div>`;
const evBox=`<div class="box" style="margin-top:20px"><b>일정 확인</b>${[...r.ev].sort((a,b)=>a.d<b.d?-1:1).map(e=>{const i=r.ev.indexOf(e);return `<div class="it"><span>${e.todo?`<input type="checkbox" data-a="todo" data-i="${i}" ${e.done?"checked":""} aria-label="완료"> <span class="rl tdo">해야할 일</span>`:""}<span style="${e.done?"text-decoration:line-through;color:var(--mute)":""}">${E(e.t)}</span></span><span style="white-space:nowrap"><span class="m">${md(e.d)}</span>${ed?` ${edB("ev",i)} ${rmB("ev",i)}`:""}</span></div>`}).join("")||`<p class="empty">등록된 일정이 없어요.</p>`}</div>`;
// [캘린더 | 시간 조율] / [일정 확인]
p=`<div class="two">${calBox}${avBox}</div>${evBox}`}

return head+`<div class="tabs">${tabs.map(([k,n])=>`<button class="${S.tt===k?"on":""}" data-a="tt" data-v="${k}">${n}</button>`).join("")}</div><div class="box tp">${p}</div></div>`}
