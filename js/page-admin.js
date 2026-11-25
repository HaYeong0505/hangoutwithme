// 관리자 페이지: 회원 관리 · 모집글 관리 · 매칭 현황 · 신고 관리
// (화면에서 숨기는 건 편의일 뿐이고, 실제 권한 검사는 서버의 /api/admin/* 가 해요)

const isAdmin=()=>!!S.user&&S.user.role==="admin";
const fd=s=>s?new Date(s).toLocaleString("ko-KR",{dateStyle:"short",timeStyle:"short"}):"-";
const badge=(t,c)=>`<span class="st" style="background:${c}">${t}</span>`;
const UST={active:["정상","var(--l1)"],suspended:["일시 정지","var(--l2)"],banned:["영구 차단","var(--l3)"],dormant:["휴면","#7a7a85"],withdrawn:["탈퇴 (보관 중)","#444"],purged:["파기됨","#aaa"]};
const UACT={active:["suspend","ban","dormant","withdraw"],suspended:["activate","ban","withdraw"],banned:["activate","withdraw"],dormant:["activate","suspend","ban","withdraw"],withdrawn:["restore","purge"],purged:[]};
const UAN={suspend:"일시 정지",ban:"영구 차단",dormant:"휴면 처리",withdraw:"강제 탈퇴",activate:"정상으로 해제",restore:"탈퇴 복구",purge:"즉시 파기",chatRestore:"전체 채팅 복구",chatBan:"전체 채팅 박탈"};
const AST={w:"대기",p:"합격 (확인 전)",r:"불합격 (확인 전)",a:"참여 중",rc:"불합격 확인",x:"불참여·취소",k:"팀에서 내보냄"};
// 채팅 권한: 회원 관리의 '전체 채팅'은 모든 팀에 적용, 채팅 신고 결정은 신고가 일어난 팀에만 적용
const CST={banned:["전체 채팅 박탈","var(--l3)"]}; // 회원 관리 탭 (전체)
const TCST={muted:["이 팀 채팅 정지 (확인 대기)","var(--l2)"],banned:["이 팀 채팅 영구 박탈","var(--l3)"],global:["전체 채팅 박탈","var(--l3)"],ok:["이 팀 채팅 정상","var(--l1)"]}; // 신고 카드 (그 팀 기준)
const chatActs=u=>u.status==="purged"?[]:u.chat_status==="banned"?["chatRestore"]:["chatBan"];
const RST={open:["접수","var(--l2)"],done:["처리 완료","var(--l1)"],rejected:["반려","#7a7a85"]};
const ATABS=[["users","회원 관리"],["posts","모집글 관리"],["match","매칭 현황"],["reports","신고 관리"]];

// 탭별 데이터 불러오기 (S.adm[탭]: undefined=아직 안 불러옴)
const ADQ={users:()=>`/api/admin/users?q=${encodeURIComponent(S.aq||"")}&status=${encodeURIComponent(S.as||"")}`,
posts:()=>`/api/admin/posts?q=${encodeURIComponent(S.apq||"")}`,match:()=>"/api/admin/matching",
reports:()=>`/api/admin/reports?status=${encodeURIComponent(S.rs||"")}`};
function loadAdm(k){S.admBusy=S.admBusy||{};S.admBusy[k]=1;
api(ADQ[k]()).then(v=>{(S.adm=S.adm||{})[k]=v}).catch(e=>{(S.adm=S.adm||{})[k]={err:e.message}})
.then(()=>{S.admBusy[k]=0;if(location.hash==="#admin")render()})}
const admReset=()=>{S.adm={}}; // 처리 후 모든 탭을 새로 불러오게 해요

function pAdmin(){if(!S.user)return need("관리자");
if(!isAdmin())return `<div class="in"><h2 class="pt">관리자</h2><div class="box"><p>관리자만 이용할 수 있어요.</p></div></div>`;
S.adm=S.adm||{};const k=S.at||"users",v=S.adm[k];
if(v===undefined&&!(S.admBusy||{})[k])loadAdm(k);
const body=v===undefined?`<p class="empty">불러오는 중…</p>`:v.err?`<p class="empty">${E(v.err)}</p>`:{users:aUsers,posts:aPosts,match:aMatch,reports:aReports}[k](v);
return `<div class="in"><h2 class="pt">관리자</h2><div class="tabs">${ATABS.map(([x,n])=>`<button class="${k===x?"on":""}" data-a="admTab" data-v="${x}">${n}</button>`).join("")}</div><div class="box tp">${body}</div></div>`}

// ---- 회원 관리: 검색 + 상태 제어 ----
function aUsers(l){
const f=`<div class="row" style="margin:0 0 12px"><input id="aq" value="${E(S.aq||"")}" placeholder="ID, 이름, 이메일로 검색"><select id="as" style="max-width:170px"><option value="">전체 상태</option>${Object.entries(UST).map(([s,[n]])=>`<option value="${s}" ${S.as===s?"selected":""}>${n}</option>`).join("")}</select><button class="btn r" data-a="admSearch">검색</button></div>`;
const cnt=`<p class="m" style="margin:0 0 6px">검색 결과 ${l.length}명</p>`;
return f+cnt+(l.map(u=>{const [sn,sc]=UST[u.status]||[u.status,"#999"],adm=u.role==="admin",cs=CST[u.chat_status];
const info=[u.reason?`사유: ${E(u.reason)}`:"",cs&&u.chat_reason?`채팅: ${E(u.chat_reason)}`:"",u.team_blocks?`<span class="red">신고로 채팅이 제한된 팀 ${u.team_blocks}곳</span>`:"",u.status==="suspended"?`해제 예정: ${fd(u.until)}`:"",u.status==="withdrawn"?`탈퇴: ${fd(u.withdrawn_at)} · 파기 예정: ${fd(u.purge_at)}`:"",`가입: ${fd(u.created_at)} · 마지막 로그인: ${fd(u.last_login)}`].filter(Boolean).join(" · ");
return `<div class="it"><div style="min-width:0"><b>${badge(sn,sc)}${cs?badge(cs[0],cs[1]):""}${E(u.name)} <span class="m">(${E(u.id)})</span>${adm?` <span class="rl tdo">관리자</span>`:""}</b><span class="m">${E(u.email||"-")}</span><span class="m" style="display:block">${info}</span></div>
<span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${adm?"":[...(UACT[u.status]||[]),...chatActs(u)].map(x=>`<button class="btn sm ${["ban","withdraw","purge","chatBan"].includes(x)?"r":"o"}" data-a="admUser" data-id="${E(u.id)}" data-k="${x}">${UAN[x]}</button>`).join("")}</span></div>`}).join("")||`<p class="empty">조건에 맞는 회원이 없어요.</p>`)}
function admUserM(id,k){const why=["suspend","ban","withdraw","chatBan"].includes(k);
const warn={chatBan:"이 회원은 모든 팀채팅에서 메시지를 보낼 수 없게 돼요. 다른 기능은 그대로 쓸 수 있어요.",chatRestore:"전체 채팅 박탈을 풀어요. 신고로 특정 팀에만 걸린 제한은 그대로이고, 신고 관리에서 따로 처리해요.",suspend:"기간 동안 로그인과 모든 이용이 막히고, 기간이 끝나면 자동으로 풀려요.",ban:"해제하기 전까지 로그인과 모든 이용이 막혀요.",dormant:"회원이 다음에 로그인하면 휴면이 풀려요.",withdraw:"바로 로그인할 수 없게 되고 진행 중인 지원이 취소돼요. 30일 뒤 개인정보가 파기되며, 그 전에는 복구할 수 있어요.",activate:"바로 정상적으로 이용할 수 있게 돼요.",restore:"정상 회원으로 돌아가요. (취소된 지원은 되살아나지 않아요)",purge:"이름·이메일·비밀번호가 지워지고 기록에는 '탈퇴한 회원'으로 남아요. 되돌릴 수 없어요."}[k];
openM(`<h3 style="margin:0 0 6px">${UAN[k]}</h3><p class="m" style="margin:0">대상: ${E(id)}</p><p class="m">${warn}</p>${k==="suspend"?`<label for="xdays">정지 기간</label><select id="xdays">${[1,3,7,30].map(n=>`<option value="${n}" ${n===7?"selected":""}>${n}일</option>`).join("")}</select>`:""}${why?`<label for="xr">사유 (회원이 로그인할 때 보여요)</label><input id="xr" placeholder="예: 홍보성 모집글 반복 게시">`:""}<div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="admUserOk" data-id="${E(id)}" data-k="${k}">${UAN[k]}</button></div>`)}

// ---- 모집글 관리: 블라인드 + 모집 상태 강제 변경 ----
function aPosts(l){
const f=`<div class="row" style="margin:0 0 12px"><input id="apq" value="${E(S.apq||"")}" placeholder="팀명, 공모전, 작성자로 검색"><button class="btn r" data-a="admPSearch">검색</button></div>`;
return f+`<p class="m" style="margin:0 0 6px">모집글 ${l.length}개</p>`+(l.map(p=>{const full=p.mem.length>=p.max,c=p.counts;
const st=p.status==="closed"?badge("모집 마감 (관리자/팀장)","#7a7a85"):full?badge("정원 마감","#7a7a85"):badge("모집 중","var(--l1)");
return `<div class="it"><div style="min-width:0"><b>${st}${p.blinded?badge("블라인드","var(--l3)"):""}${E(p.name)}</b><span class="m">${E(p.ctitle)} · 작성자 ${E(p.ownerName||"-")}${p.owner?` (${E(p.owner)}${p.ownerStatus&&p.ownerStatus!=="active"?" · "+(UST[p.ownerStatus]||[p.ownerStatus])[0]:""})`:""} · 팀원 ${p.mem.length}/${p.max}</span>
<span class="m" style="display:block">지원 대기 ${c.w} · 합격 확인 전 ${c.p} · 참여 ${c.a} · 불합격 ${c.r+c.rc}${p.openReports?` · <span class="red">미처리 신고 ${p.openReports}건</span>`:""}${p.blinded&&p.blindReason?` · 블라인드 사유: ${E(p.blindReason)}`:""}</span></div>
<span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${p.blinded?`<button class="btn sm o" data-a="admBlind" data-id="${p.id}" data-v="0">블라인드 해제</button>`:`<button class="btn sm r" data-a="admBlind" data-id="${p.id}" data-v="1" data-n="${E(p.name)}">블라인드</button>`}${p.status==="open"?`<button class="btn sm o" data-a="admPStat" data-id="${p.id}" data-v="closed">모집 마감으로</button>`:`<button class="btn sm o" data-a="admPStat" data-id="${p.id}" data-v="open">모집 중으로</button>`}</span></div>`}).join("")||`<p class="empty">조건에 맞는 모집글이 없어요.</p>`)}
const blindM=(id,n)=>openM(`<h3 style="margin:0 0 6px">모집글 블라인드</h3><p class="m" style="margin:0">${E(n)}</p><p class="m">게시판에서 숨겨지고 새 지원을 받을 수 없어요. 작성자에게는 사유와 함께 보여요.</p><label for="xr">블라인드 사유</label><input id="xr" placeholder="예: 공모전과 무관한 홍보 글"><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="admBlindOk" data-id="${id}">블라인드</button></div>`);

// ---- 매칭 현황 ----
function aMatch(v){const s=v.summary,a=s.apps,tile=(n,x)=>`<div style="border:1px solid var(--line);border-radius:6px;padding:10px 12px"><span class="m">${n}</span><b style="display:block;font-size:22px">${x}</b></div>`;
return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">${tile("전체 모집글",s.posts)}${tile("모집 중",s.open)}${tile("마감",s.closed)}${tile("블라인드",s.blinded)}${tile("지원 대기",a.w)}${tile("합격 확인 전",a.p)}${tile("참여 중 (매칭 완료)",a.a)}${tile("불합격",a.r+a.rc)}${tile("불참여·취소",a.x)}${tile("합격률",s.acceptRate+"%")}</div>
<div class="sh" style="margin-top:18px">팀별 현황</div>${v.rows.map(r=>`<div class="it"><div><b>${E(r.name)}</b><span class="m">${E(r.ctitle)} · ${E(r.ownerName||"-")}${r.blinded?" · 블라인드":""}</span></div><span class="m" style="text-align:right;white-space:nowrap">팀원 <b style="display:inline;color:var(--ink)">${r.mem}/${r.max}</b>${r.full?" (정원)":r.status==="closed"?" (마감)":""}<br>대기 ${r.counts.w} · 참여 ${r.counts.a}</span></div>`).join("")||`<p class="empty">모집글이 없어요.</p>`}
<div class="sh" style="margin-top:18px">최근 지원 활동</div>${v.recent.map(x=>`<div class="it"><span>${E(x.uname)} → <b style="display:inline">${E(x.pname||"삭제된 모집글")}</b> <span class="rl">${E(x.role)}</span></span><span class="m" style="white-space:nowrap">${AST[x.st]||x.st} · ${fd(x.updated_at)}</span></div>`).join("")||`<p class="empty">지원 기록이 없어요.</p>`}`}

// ---- 신고 관리 ----
function aReports(l){
const f=`<div class="row" style="margin:0 0 12px">${[["","전체"],["open","접수"],["done","처리 완료"],["rejected","반려"]].map(([x,n])=>`<button class="btn sm ${(S.rs||"")===x?"":"o"}" data-a="admRs" data-v="${x}">${n}</button>`).join("")}</div>`;
return f+(l.map(r=>{if(r.ttype==="msg")return msgCard(r);const [sn,sc]=RST[r.status]||[r.status,"#999"],t=r.target,who=r.ttype==="post"?t.owner:r.tid;
return `<div class="it" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${badge(sn,sc)}${r.ttype==="post"?"모집글":"회원"} · ${E(t.label)}${t.blinded?" <span class='red' style='font-size:12px'>블라인드됨</span>":""}${t.status&&UST[t.status]&&r.ttype==="user"?` <span class="m">(${UST[t.status][0]})</span>`:""}</b><span class="m">${fd(r.created_at)}</span></div>
<span class="m" style="display:block">사유: <b style="display:inline;color:var(--ink)">${E(r.reason)}</b> · 신고자: ${E(r.reporterName)} (${E(r.reporter)})${r.ttype==="post"&&t.ownerName?` · 작성자: ${E(t.ownerName)}`:""}</span>
${r.detail?`<p style="margin:4px 0">${E(r.detail)}</p>`:""}${r.note?`<span class="m" style="display:block">처리 메모: ${E(r.note)} · ${fd(r.handled_at)}</span>`:""}
<div class="row" style="justify-content:flex-end;margin-top:6px">${r.ttype==="post"&&!t.gone&&!t.blinded?`<button class="btn sm o" data-a="admBlind" data-id="${E(r.tid)}" data-v="1" data-n="${E(t.label)}">모집글 블라인드</button>`:""}${who&&!t.gone?`<button class="btn sm o" data-a="admUser" data-id="${E(who)}" data-k="suspend">${r.ttype==="post"?"작성자 ":""}일시 정지</button>`:""}
${r.status==="open"?`<button class="btn sm o" data-a="admRep" data-id="${r.id}" data-v="rejected">반려</button><button class="btn sm r" data-a="admRep" data-id="${r.id}" data-v="done">처리 완료</button>`:`<button class="btn sm o" data-a="admRep" data-id="${r.id}" data-v="open">다시 접수로</button>`}</div></div>`}).join("")||`<p class="empty">신고 내역이 없어요.</p>`)}
// 채팅 신고 카드: 신고된 메시지(빨간 배경)와 앞뒤 대화를 보여 주고, 채팅 권한을 돌려줄지 영구 박탈할지 고르게 해요
function msgCard(r){const t=r.target,[sn,sc]=RST[r.status]||[r.status,"#999"],cs=TCST[t.chat];
const ctxMsgs=t.context&&t.context.length?t.context:[{w:t.label,t:t.text,at:t.at,hit:1}];
return `<div class="it" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${badge(sn,sc)}채팅 · ${E(t.label)} ${cs?badge(cs[0],cs[1]):""}</b><span class="m">${fd(r.created_at)}</span></div>
<span class="m" style="display:block">팀: ${E(t.team||"-")} · 신고자: ${E(r.reporterName)} (${E(r.reporter)})</span>
<p style="margin:4px 0">신고 사유: ${E(r.detail||"-")}</p>
<div class="sh" style="margin-top:8px">채팅 내역 <span class="m" style="font-weight:400">(빨간 줄이 신고된 메시지, 앞뒤 최대 5개)</span></div>
<div style="border:1px solid var(--line);border-radius:6px;padding:6px;max-height:240px;overflow:auto">${ctxMsgs.map(m=>`<div style="padding:4px 8px;border-radius:4px;${m.hit?"background:rgba(231,27,27,.13);font-weight:700":""}"><span class="m">${E(m.w)} · ${fd(m.at)}</span><br>${E(m.t)}</div>`).join("")}</div>
${r.note?`<span class="m" style="display:block;margin-top:4px">처리 메모: ${E(r.note)} · ${fd(r.handled_at)}</span>`:""}
<div class="row" style="justify-content:flex-end;margin-top:6px">${!t.gone&&t.owner?`<button class="btn sm o" data-a="admUser" data-id="${E(t.owner)}" data-k="suspend">계정 일시 정지</button>`:""}
${r.status==="open"&&!t.gone?`<button class="btn sm o" data-a="admChat" data-id="${r.id}" data-v="restore">이 팀 채팅 권한 돌려주기</button><button class="btn sm r" data-a="admChat" data-id="${r.id}" data-v="ban">이 팀 채팅 영구 박탈</button>`:r.status==="open"?"":`<button class="btn sm o" data-a="admRep" data-id="${r.id}" data-v="open">다시 접수로</button>`}</div></div>`}
const chatM=(id,v)=>openM(`<h3 style="margin:0 0 6px">${v==="ban"?"이 팀 채팅 영구 박탈":"이 팀 채팅 권한 돌려주기"}</h3><p class="m">${v==="ban"?"이 회원은 신고가 일어난 이 팀채팅에서만 메시지를 보낼 수 없게 돼요. 다른 팀채팅은 그대로예요. 신고는 '처리 완료'가 돼요.":"이 회원이 이 팀채팅에서 다시 채팅할 수 있게 되고, 신고는 '반려'가 돼요."} 같은 팀에서 같은 회원에 대한 다른 채팅 신고도 함께 처리돼요.</p><label for="xr">처리 메모 (선택)</label><input id="xr" placeholder="${v==="ban"?"예: 욕설 반복":"예: 문제 없는 대화"}"><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="admChatOk" data-id="${id}" data-v="${v}">확인</button></div>`);
const repM=(id,st)=>openM(`<h3 style="margin:0 0 6px">신고 ${st==="done"?"처리 완료":st==="rejected"?"반려":"다시 접수"}</h3><label for="xr">처리 메모 (선택)</label><input id="xr" placeholder="${st==="rejected"?"예: 운영 정책 위반 아님":"예: 모집글 블라인드 및 작성자 3일 정지"}"><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="admRepOk" data-id="${id}" data-v="${st}">확인</button></div>`);

// ---- 관리자 버튼 동작 (actions.js의 act에서 'adm'으로 시작하는 버튼을 여기로 넘겨요) ----
function admAct(a,b){const d=b.dataset,done=m=>{closeM();toast(m);admReset();loadAll()};
const go=(url,body,m)=>{b.disabled=true;api(url,"POST",body).then(()=>done(m)).catch(e=>{b.disabled=false;toast(e.message)})};
switch(a){
case"admTab":S.at=d.v;break;
case"admSearch":S.aq=$("#aq").value.trim();S.as=$("#as").value;delete S.adm.users;break;
case"admPSearch":S.apq=$("#apq").value.trim();delete S.adm.posts;break;
case"admRs":S.rs=d.v;delete S.adm.reports;break;
case"admUser":return admUserM(d.id,d.k);
case"admUserOk":{const body={action:d.k};if($("#xdays"))body.days=+$("#xdays").value;if($("#xr"))body.reason=$("#xr").value.trim();
if($("#xr")&&!body.reason)return toast("사유를 입력해 주세요.");return go(`/api/admin/users/${encodeURIComponent(d.id)}/action`,body,`${UAN[d.k]} 처리했어요.`)}
case"admBlind":if(d.v==="1")return blindM(d.id,d.n);return go(`/api/admin/posts/${+d.id}/blind`,{blind:false},"블라인드를 해제했어요.");
case"admBlindOk":{const reason=$("#xr").value.trim();if(!reason)return toast("블라인드 사유를 입력해 주세요.");return go(`/api/admin/posts/${+d.id}/blind`,{blind:true,reason},"모집글을 블라인드했어요.")}
case"admPStat":return go(`/api/admin/posts/${+d.id}/status`,{status:d.v},d.v==="open"?"모집 중으로 바꿨어요.":"모집 마감으로 바꿨어요.");
case"admRep":return repM(d.id,d.v);
case"admRepOk":return go(`/api/admin/reports/${+d.id}`,{status:d.v,note:$("#xr").value.trim()},"신고 상태를 바꿨어요.");
case"admChat":return chatM(d.id,d.v);
case"admChatOk":return go(`/api/admin/reports/${+d.id}/chat`,{action:d.v,note:$("#xr").value.trim()},d.v==="ban"?"이 팀에서 채팅 권한을 영구 박탈했어요.":"이 팀 채팅 권한을 돌려줬어요.");
}render()}
