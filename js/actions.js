// 모달 창과 버튼 동작(act): 버튼의 data-a 값에 따라 처리

function openM(h,w){$("#bx").innerHTML=h;$("#bx").style.maxWidth=w||"";$("#md").classList.add("on")}const closeM=()=>$("#md").classList.remove("on");
function authM(){const up=S.am==="up";openM(`<div class="tabs" style="margin:0 0 8px"><button class="${up?"":"on"}" data-a="am" data-v="in">로그인</button><button class="${up?"on":""}" data-a="am" data-v="up">회원가입</button></div>${up?`<label for="ae">이메일</label><input id="ae" type="email"><label for="an">이름</label><input id="an">`:""}<label for="aid">ID</label><input id="aid"><label for="apw">비밀번호</label><input id="apw" type="password">
<div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="authOk">${up?"가입하기":"로그인"}</button></div>`)}
function applyM(id){const t=TM.find(x=>x.id===id);openM(`<h3 style="margin:0 0 2px">${E(t.name)}</h3><p class="m" style="margin:0">${LV[t.lv]} · ${E(t.cond)}</p><label for="ar">희망 직무</label><select id="ar">${t.need.map(r=>`<option>${E(r)}</option>`).join("")}</select><label for="ai">자기소개</label><textarea id="ai" rows="4" placeholder="경험과 맡고 싶은 역할을 적어 주세요."></textarea><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="applyOk" data-id="${id}">지원하기</button></div>`)}

// 서버 API 호출 도우미: 실패하면 서버가 보낸 error 메시지로 예외를 던져요
const api=(url,method="GET",body)=>fetch(url,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined})
.catch(()=>{throw new Error("서버에 연결할 수 없어요. node server.js로 서버를 켜고 http://localhost:3000 으로 접속해 주세요.")})
.then(async r=>{const j=await r.json().catch(()=>({}));
if(j.code==="inactive"&&S.user){S.user=null;location.hash="home";render()} // 이용 중 정지·차단되면 로그아웃
if(!r.ok){const err=new Error(j.error||"요청에 실패했어요. 서버가 켜져 있는지 확인해 주세요.");err.status=r.status;throw err}return j});

// 서버에서 모집글·내 지원·받은 신청서를 다시 불러와요 (로그인/로그아웃이나 데이터가 바뀐 뒤 호출)
function loadAll(){return Promise.all([api("/api/posts"),S.user?api("/api/my/apps"):[],S.user?api("/api/my/recv"):[]])
.then(([ps,ap,rv])=>{TM.splice(0,TM.length,...ps);
// 서버 상태 p(합격)·r(불합격)는 화면에서 '결과 확인 요망(c)'으로 보여요
S.apps=ap.filter(a=>TM.some(t=>t.id===a.tid)).map(a=>a.st==="p"||a.st==="r"?{...a,st:"c",res:a.st==="p"?"합":"불"}:a);
S.recv=rv.map(r=>({aff:"",car:[],aw:[],pf:[],rt:0,...r}));render()})
.catch(e=>toast(e.message))}
// ---- 팀채팅: 서버에서 방 내용 불러오기 ----
// soft=true면 입력 중인 글자와 커서를 지키면서 다시 그려요 (채팅 자동 갱신용)
const roomP={};
const dayLabel=at=>{const x=new Date(at);return `${x.getMonth()+1}/${x.getDate()}`};
const chatTime=at=>{const x=new Date(at),t=x.toLocaleTimeString("ko-KR",{hour:"numeric",minute:"2-digit"});return x.toDateString()===new Date().toDateString()?t:dayLabel(at)+" "+t};
function loadRoom(pid,soft){
if(roomP[pid])return roomP[pid].then(()=>loadRoom(pid,soft)); // 이미 불러오는 중이면 끝난 뒤 한 번 더
roomP[pid]=api(`/api/teams/${pid}`).then(d=>{const s=JSON.stringify(d);if(R[pid]&&R[pid]._s===s)return; // 바뀐 게 없으면 그대로
d._s=s;d.msgs.forEach(m=>m.h=chatTime(m.at));
d.nt.forEach(n=>{n.d=dayLabel(n.at);n.f=n.fid?"/api/files/"+n.fid:""});d.lib.forEach(x=>{x.f=x.fid?"/api/files/"+x.fid:""});
R[pid]=d;if(["#team","#mypage"].includes(location.hash))soft?softRender():render()})
.catch(e=>{
if(e.status===403){R[pid]={...EMPTY_ROOM,loading:0,err:e.message};loadAll();return} // 팀에서 내보내졌으면 목록을 다시 불러와 팀을 빼요
if(!R[pid])R[pid]={...EMPTY_ROOM,loading:0,err:e.message}}).finally(()=>{delete roomP[pid]});
return roomP[pid]}
// 파일을 서버에 올리고 {fid, fn, fk}를 받아요
const upFile=(pid,f)=>fetch(`/api/teams/${pid}/upload?name=${encodeURIComponent(f.name)}`,{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:f})
.catch(()=>{throw new Error("서버에 연결할 수 없어요.")})
.then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"파일을 올리지 못했어요.");return j});
// 팀채팅 요청 공통 처리: 성공하면 메시지 + 방 다시 불러오기
const tsend=(b,p,method,body,msg)=>{const pid=S.tid;if(b)b.disabled=true;
return api(`/api/teams/${pid}${p}`,method,body).then(()=>{closeM();if(msg)toast(msg);return loadRoom(pid)}).catch(e=>{if(b)b.disabled=false;toast(e.message)})};

// 서버 요청 후 공통 처리: 성공하면 메시지 + 다시 불러오기, 실패하면 버튼 다시 켜기
const send=(b,url,method,body,msg,after)=>{if(b)b.disabled=true;return api(url,method,body).then(j=>{closeM();if(msg)toast(msg);if(after)after(j);return loadAll()}).catch(e=>{if(b)b.disabled=false;toast(e.message)})};
// 신고 창 (모집글/회원 공통)
function reportM(tt,id,label){openM(`<h3 style="margin:0 0 2px">${tt==="post"?"모집글":"회원"} 신고</h3><p class="m" style="margin:0">${E(label)}</p><label for="rpr">신고 사유</label><select id="rpr">${RPR.map(r=>`<option>${E(r)}</option>`).join("")}</select><label for="rpd">상세 내용 (선택)</label><textarea id="rpd" rows="3" maxlength="500" placeholder="관리자가 확인할 수 있게 구체적으로 적어 주세요."></textarea><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="reportOk" data-t="${tt}" data-id="${E(id)}">신고하기</button></div>`)}

function act(a,b){const d=b.dataset,r=S.user?room(S.tid):null;
if(a.startsWith("adm"))return admAct(a,b); // 관리자 버튼은 page-admin.js에서 처리해요
switch(a){
case"login":case"join":S.am=a==="join"?"up":"in";return authM();
case"am":S.am=d.v;return authM();
// 로그인/회원가입: 서버(/api/login, /api/signup)에 확인을 요청하고, 성공하면 서버가 돌려준 사용자 정보로 로그인 상태를 만들어요
case"authOk":{const id=$("#aid").value.trim(),pw=$("#apw").value,up=S.am==="up";if(!id||!pw)return toast("ID와 비밀번호를 입력해 주세요.");
const body={id,pw};if(up){body.name=$("#an").value.trim();body.email=$("#ae").value.trim();if(!body.name||!body.email)return toast("이메일과 이름을 입력해 주세요.")}
b.disabled=true;
api(up?"/api/signup":"/api/login","POST",body).then(u=>{S.user=u;closeM();toast(up?"가입이 완료됐어요.":u.wasDormant?"휴면 상태가 해제됐어요. 다시 오신 걸 환영해요!":"로그인했어요.");loadAll()}).catch(e=>{b.disabled=false;toast(e.message)});
return}
// 로그아웃: 서버 세션도 함께 지워요
case"logout":api("/api/logout","POST").catch(()=>{}).then(loadAll);S.user=null;S.apps=[];S.recv=[];location.hash="home";toast("로그아웃했어요.");break;
// 회원탈퇴: 비밀번호를 다시 확인한 뒤 서버(DELETE /api/me)에서 계정을 삭제해요
case"quit":return openM(`<h3 style="margin:0 0 6px">회원탈퇴</h3><p class="m">탈퇴하면 바로 로그인할 수 없고, 진행 중인 지원은 취소돼요. 30일이 지나면 이름·이메일 등 개인정보가 파기되며, 그 전에는 관리자에게 복구를 요청할 수 있어요. 확인을 위해 비밀번호를 입력해 주세요.</p><label for="qpw">비밀번호</label><input id="qpw" type="password"><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="quitOk">탈퇴하기</button></div>`);
case"quitOk":{const pw=$("#qpw").value;if(!pw)return toast("비밀번호를 입력해 주세요.");b.disabled=true;
api("/api/me","DELETE",{pw}).then(()=>{S.user=null;S.apps=[];S.recv=[];closeM();location.hash="home";toast("회원탈퇴가 완료됐어요.");loadAll()}).catch(e=>{b.disabled=false;toast(e.message)});
return}
case"close":return closeM();
case"apply":if(!S.user){toast("로그인이 필요해요.");return authM()}return applyM(+d.id);
case"applyOk":return send(b,`/api/posts/${+d.id}/apply`,"POST",{role:$("#ar").value,intro:$("#ai").value.trim()},"지원했어요. 마이페이지에서 현황을 확인하세요.");
case"recruitOk":{const ctitle=$("#rcid").value.trim();if(!ctitle)return toast("대상 공모전을 입력해 주세요.");
const body={ctitle,name:$("#rname").value.trim(),lv:+$("#rlv").value,max:Math.max(2,+$("#rmax").value||4),cond:$("#rcond").value.trim(),need:$("#rneed").value.split(",").map(x=>x.trim()).filter(Boolean)};
if(!body.name||!body.cond||!body.need.length)return toast("팀명, 모집 조건, 모집 직무를 모두 입력해 주세요.");
const ed=S.edit;return send(b,ed?`/api/posts/${ed}`:"/api/posts",ed?"PUT":"POST",body,ed?"모집글을 수정했어요.":"모집글이 등록됐어요.",()=>{S.edit=0;location.hash="board"})}
case"edit":S.edit=+d.id;if(location.hash==="#recruit")break;location.hash="recruit";return;
case"del":{const t=TM.find(x=>x.id===+d.id);return openM(`<h3 style="margin:0 0 6px">모집글 삭제</h3><p class="m">"${E(t.name)}" 모집글을 삭제할까요? 삭제하면 되돌릴 수 없어요.</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="delOk" data-id="${t.id}">삭제하기</button></div>`)}
case"delOk":return send(b,`/api/posts/${+d.id}`,"DELETE",null,"모집글을 삭제했어요.");
// 신고: 모집글(data-t=post) 또는 회원(data-t=user)
case"report":{if(!S.user){toast("로그인이 필요해요.");return authM()}const t=d.t==="post"?TM.find(x=>x.id===+d.id):null;return reportM(d.t,d.id,t?t.name:d.n||d.id)}
case"reportOk":return send(b,"/api/reports","POST",{ttype:d.t,tid:d.id,reason:$("#rpr").value,detail:$("#rpd").value},"신고가 접수됐어요. 관리자가 확인할게요.");
case"bf":S.f=+d.v;break;
case"tt":S.tt=d.v;if(S.user)loadRoom(S.tid);break;case"lf":S.lf=d.v;break; // 탭을 바꿀 때마다 최신 내용으로
case"mv":{const o=location.hash==="#mypage"?S.mm:S.cm;o.m+=+d.v;if(o.m<0){o.m=11;o.y--}if(o.m>11){o.m=0;o.y++}break}
case"sel":S.sel=d.d;break;
// ---- 팀채팅 (모두 서버에 저장돼요) ----
case"ntAdd":{const t=$("#nti").value.trim();if(!t)return toast("공지 제목을 입력해 주세요.");const f=$("#nim").files[0];
if(f&&!(okImg(f)||okPdf(f)||/\.mp4$/i.test(f.name)))return toast("공지 첨부는 pdf, jpg, png, mp4 파일만 올릴 수 있어요.");
const body={t,b:$("#ntb").value.trim(),u:$("#ntu").value.trim()};b.disabled=true;if(f)toast("파일을 올리는 중이에요…");
return (f?upFile(S.tid,f):Promise.resolve(null)).then(x=>{if(x)body.fid=x.fid;return tsend(b,"/nt","POST",body,"공지를 등록했어요.")}).catch(e=>{b.disabled=false;toast(e.message)})}
case"send":{const c=$("#ci"),v=c&&c.value.trim();if(!v||c.disabled||c.dataset.busy)return;c.dataset.busy=1;c.value="";
return api(`/api/teams/${S.tid}/msgs`,"POST",{t:v}).then(()=>loadRoom(S.tid)).then(()=>{const n=$("#ci");if(n)n.focus()})
.catch(e=>{const n=$("#ci");if(n&&!n.value)n.value=v;toast(e.message)}).finally(()=>{const n=$("#ci");if(n)delete n.dataset.busy})}
case"ck":return tsend(null,`/msgs/${r.msgs[+d.i].id}/check`,"POST");
// 채팅 신고 (말풍선 우클릭 메뉴 → 사유 입력 창)
case"msgReport":{hideCtx();const m=r.msgs.find(x=>x.id===+d.mid);if(!m)return;
return openM(`<h3 style="margin:0 0 6px">채팅 신고</h3><div style="background:var(--soft);border-radius:6px;padding:10px 12px"><span class="m">${E(m.w)} · ${E(m.h)}</span><p style="margin:2px 0 0;white-space:pre-wrap">${E(m.t)}</p></div><label for="mrd">신고 사유</label><textarea id="mrd" rows="3" maxlength="500" placeholder="어떤 점이 문제인지 적어 주세요."></textarea><p class="m" style="margin:6px 0 0">신고하면 관리자가 확인할 때까지 이 사람은 이 팀채팅에서 채팅을 할 수 없어요. (다른 팀채팅은 영향 없음)</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="msgReportOk" data-mid="${m.id}">신고하기</button></div>`)}
case"msgReportOk":{const detail=$("#mrd").value.trim();if(!detail)return toast("신고 사유를 적어 주세요.");
return tsend(b,`/msgs/${+d.mid}/report`,"POST",{detail},"신고가 접수됐어요. 관리자가 확인할게요.")}
// 팀장: 수정 권한 주기/회수, 팀에서 내보내기
case"tmEditor":return tsend(b,`/members/${encodeURIComponent(d.uid)}/editor`,"POST",{on:d.on==="1"},d.on==="1"?"수정 권한을 줬어요.":"수정 권한을 회수했어요.");
case"tmKick":return openM(`<h3 style="margin:0 0 6px">팀에서 내보내기</h3><p class="m">${E(d.n)}님을 이 팀에서 내보낼까요? 팀채팅에 더 이상 들어올 수 없고, 이 팀에 다시 지원할 수 없어요. 지금까지 쓴 메시지와 글은 남아요. 되돌릴 수 없어요.</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="tmKickOk" data-uid="${E(d.uid)}" data-n="${E(d.n)}">내보내기</button></div>`);
case"tmKickOk":return tsend(b,`/members/${encodeURIComponent(d.uid)}/kick`,"POST",null,d.n+"님을 팀에서 내보냈어요.").then(loadAll);
case"pvn":{const x=r.nt[+d.i];return openM(`<h3 style="margin:0 0 10px">${E(x.fn)}</h3><iframe src="${x.f}" title="${E(x.fn)}" style="width:100%;height:65vh;border:1px solid var(--line);border-radius:4px"></iframe><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">닫기</button><a class="btn r" href="${x.f}?dl=1" download="${E(x.fn)}">다운로드</a></div>`,"760px")}
case"pvf":{const x=r.lib[+d.i];const body=x.k==="이미지"?`<img src="${x.f}" alt="${E(x.n)}" style="max-width:100%;max-height:65vh;display:block;margin:0 auto;border-radius:4px">`:x.k==="PDF"?`<iframe src="${x.f}" title="${E(x.n)}" style="width:100%;height:65vh;border:1px solid var(--line);border-radius:4px"></iframe>`:`<p class="empty">이 형식은 미리보기를 지원하지 않아요. 다운로드해서 확인해 주세요.</p>`;
return openM(`<h3 style="margin:0 0 10px">${E(x.n)}</h3>${body}<div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">닫기</button><a class="btn r" href="${x.f}?dl=1" download="${E(x.n)}">다운로드</a></div>`,"760px")}
case"libAdd":{const f=$("#lfile").files[0],u=$("#lurl").value.trim();
if(f){if(!(okImg(f)||okPdf(f)))return toast("이미지는 jpg, png, PDF는 pdf 파일만 올릴 수 있어요. 그 밖의 자료는 링크로 공유해 주세요.");
b.disabled=true;toast("파일을 올리는 중이에요…");return upFile(S.tid,f).then(x=>tsend(b,"/lib","POST",{fid:x.fid},"자료를 추가했어요.")).catch(e=>{b.disabled=false;toast(e.message)})}
if(!/^https?:\/\//.test(u))return toast("파일을 고르거나 https:// 링크를 입력해 주세요.");return tsend(b,"/lib","POST",{u},"링크를 추가했어요.")}
case"vAdd":{const q=$("#vq").value.trim(),o=$("#vo").value.split("\n").map(s=>s.trim()).filter(Boolean);if(!q||o.length<2)return toast("질문과 선택지를 2개 이상 입력해 주세요.");return tsend(b,"/vt","POST",{q,o},"투표를 만들었어요.")}
case"vote":return tsend(null,`/vt/${r.vt[+d.v].id}/pick`,"POST",{o:+d.o});
// 시간 조율: 날짜를 고르고 1시간 칸을 눌러 '가능' 표시를 켜고 꺼요
case"av":return tsend(null,"/avail","POST",{d:d.d,h:+d.h});
case"avDay":{const x=new Date(S.avd+"T00:00");x.setDate(x.getDate()+ +d.v);S.avd=ymd(x);break}
case"avGo":S.avd=d.v;break;
case"rm":{const it=r[d.k][+d.i],nm=it.t||it.q||it.n;return openM(`<h3 style="margin:0 0 6px">${RMN[d.k]} 삭제</h3><p class="m">"${E(nm)}" ${RMN[d.k]}을(를) 삭제할까요? 삭제하면 되돌릴 수 없어요.</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="rmOk" data-k="${d.k}" data-i="${d.i}">삭제하기</button></div>`)}
case"ed":{const k=d.k,i=d.i,it=r[k][+i];let f="";
if(k==="nt")f=`<label for="xt">제목</label><input id="xt" value="${E(it.t)}"><label for="xb">내용</label><textarea id="xb" rows="3">${E(it.b)}</textarea><label for="xu">링크</label><input id="xu" value="${E(it.u)}" placeholder="https://…">`;
else if(k==="vt")f=`<label for="xt">투표 질문</label><input id="xt" value="${E(it.q)}"><label for="xb">선택지 (줄바꿈으로 구분, 2개 이상)</label><textarea id="xb" rows="4">${E(it.o.map(o=>o.x).join("\n"))}</textarea><p class="m" style="margin:6px 0 0">그대로 둔 선택지는 표 수가 유지되고, 새 선택지는 0표부터 시작해요.</p>`;
else f=`<label for="xd">날짜</label><input id="xd" type="date" value="${it.d}"><label for="xt">일정 제목</label><input id="xt" value="${E(it.t)}"><label style="margin-top:10px"><input type="checkbox" id="xc" ${it.todo?"checked":""}> 해야할 일 태그 붙이기</label>`;
return openM(`<h3 style="margin:0 0 6px">${RMN[k]} 수정</h3>${f}<div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="edOk" data-k="${k}" data-i="${i}">저장하기</button></div>`)}
case"edOk":{const k=d.k,it=r[k][+d.i],t=$("#xt").value.trim();let body;
if(k==="nt"){if(!t)return toast("공지 제목을 입력해 주세요.");body={t,b:$("#xb").value.trim(),u:$("#xu").value.trim()}}
else if(k==="vt"){const o=[...new Set($("#xb").value.split("\n").map(s=>s.trim()).filter(Boolean))];if(!t||o.length<2)return toast("질문과 선택지를 2개 이상 입력해 주세요.");body={q:t,o}}
else{const dt=$("#xd").value;if(!dt||!t)return toast("날짜와 일정 제목을 입력해 주세요.");body={d:dt,t,todo:$("#xc").checked}}
return tsend(b,`/${k}/${it.id}`,"PUT",body,RMN[k]+"을(를) 수정했어요.")}
case"rmOk":return tsend(b,`/${d.k}/${r[d.k][+d.i].id}`,"DELETE",null,RMN[d.k]+"을(를) 삭제했어요.");
case"evAdd":{const dt=$("#ed").value,t=$("#et").value.trim();if(!dt||!t)return toast("날짜와 일정 제목을 입력해 주세요.");S.sel=dt;return tsend(b,"/ev","POST",{d:dt,t,todo:$("#etd").checked},"일정을 추가했어요.")}
case"todo":return tsend(null,`/ev/${r.ev[+d.i].id}/done`,"POST");
case"affSave":S.prof.aff=$("#aff").value.trim();toast("소속을 저장했어요.");break;
case"awAdd":{const v=$("#awi").value.trim();if(!v)return toast("수상내역을 입력해 주세요.");S.prof.aw.push(v);break}
case"awDel":S.prof.aw.splice(+d.i,1);break;
case"pfAdd":{const t=$("#pft").value.trim(),u=$("#pfu").value.trim();if(!t||!/^https?:\/\//.test(u))return toast("제목과 https:// 링크를 입력해 주세요.");S.prof.pf.push({t,u});break}
case"pfDel":S.prof.pf.splice(+d.i,1);break;
case"skip":return openM(`<h3 style="margin:0 0 6px">불참여</h3><p class="m">"${E(TM.find(t=>t.id===+d.id).name)}" 팀에 합격했지만 참여하지 않을까요? 팀장에게 불참여가 전달되고 되돌릴 수 없어요.</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="skipOk" data-id="${d.id}">불참여하기</button></div>`);
case"skipOk":return send(b,`/api/apps/${myApp(+d.id).aid}/skip`,"POST",null,"불참여 처리했어요.");
case"confirm":{const x=myApp(+d.id);return send(b,`/api/apps/${x.aid}/confirm`,"POST",null,x.res==="합"?"팀에 참여했어요. 팀채팅에서 만나요.":"결과를 확인했어요.")}
case"pv":{const x=S.recv[+d.i],L=(a,f)=>a.length?a.map(f).join(""):`<p class="empty" style="padding:4px 0">없음</p>`;return openM(`<h3 style="margin:0 0 2px">${E(x.n)} <span class="rl">${E(x.role)} 지원</span></h3><p class="m" style="margin:0">${E(x.aff)}${x.rt?` · <span class="stars">★ ${x.rt.toFixed(1)}</span>`:" · 받은 후기 없음"}</p>
<div class="sh">자기소개</div><p style="margin:2px 0">${E(x.intro)}</p>
<div class="sh">경력</div>${L(x.car,c=>`<div class="it" style="padding:6px 0">${E(c)}</div>`)}
<div class="sh">수상내역</div>${L(x.aw,c=>`<div class="it" style="padding:6px 0">${E(c)}</div>`)}
<div class="sh">포폴 / 작업물</div>${L(x.pf,p=>`<div class="it" style="padding:6px 0"><a class="red" href="${E(p.u)}" target="_blank" rel="noopener">${E(p.t)}</a></div>`)}
<div class="row" style="justify-content:flex-end;margin-top:16px">${x.uid?`<button class="btn o" style="margin-right:auto" data-a="report" data-t="user" data-id="${E(x.uid)}" data-n="${E(x.n)}">회원 신고</button>`:""}<button class="btn o" data-a="close">닫기</button><button class="btn o" data-a="recv" data-i="${d.i}" data-v="0">불합격</button><button class="btn r" data-a="recv" data-i="${d.i}" data-v="1">합격</button></div>`)}
case"recv":{const x=S.recv[+d.i];return send(b,`/api/apps/${x.aid}/decide`,"POST",{ok:!!+d.v},+d.v?x.n+"님을 합격 처리했어요. 지원자가 확인하면 팀에 합류해요.":x.n+"님을 불합격 처리했어요.")}
case"rate":S.rate=+d.v;document.querySelectorAll(".rate button").forEach(x=>x.classList.toggle("on",+x.dataset.v<=S.rate));return;
case"rvW":return rvM(+d.p,d.n);
case"rvOk":{const t=$("#rvt").value.trim();if(!t)return toast("후기 내용을 입력해 주세요.");S.gv.push({p:+d.p,n:d.n,s:S.rate,t});closeM();toast(d.n+"님에게 후기를 남겼어요.");break}
case"rvDel":return openM(`<h3 style="margin:0 0 6px">후기 삭제</h3><p class="m">${E(d.n)}님에게 남긴 후기를 삭제할까요? 삭제하면 되돌릴 수 없어요.</p><div class="row" style="justify-content:flex-end"><button class="btn o" data-a="close">취소</button><button class="btn r" data-a="rvDelOk" data-p="${d.p}" data-n="${E(d.n)}">삭제하기</button></div>`);
case"rvDelOk":S.gv=S.gv.filter(x=>!(x.p===+d.p&&x.n===d.n));closeM();toast("후기를 삭제했어요.");break;
}render()}

