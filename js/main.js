// 화면 그리기(render)와 이벤트 연결 — 가장 마지막에 불러와야 해요
// 주소 형식: #페이지 또는 #페이지/번호 (예: #post/3 = 3번 모집글 상세, #contest/2 = 2번 공모전 상세)

function render(){const [h,q]=(location.hash.slice(1)||"home").split("/"),on=h==="post"||h==="recruit"?"board":h; // 상세·모집글 작성은 게시판에 속해요
if(!isAdmin())S.adm=null;
$("#menu").innerHTML=[["board","게시판"],["contest","주요공모전"],["team","팀채팅"],["mypage","마이페이지"],...(isAdmin()?[["admin","관리자"]]:[])].map(([k,n])=>`<a href="#${k}" class="${on===k?"on":""}">${n}</a>`).join("");
$("#auth").innerHTML=S.user?`<span>${E(S.user.name)}님</span><a href="#" data-a="logout">로그아웃</a>${isAdmin()?"":`<a href="#" data-a="quit">회원탈퇴</a>`}`:`<a href="#" data-a="login">로그인</a><a href="#" data-a="join">회원가입</a>`;
$("#app").innerHTML=({home:pHome,board:pBoard,post:pPost,contest:pContest,recruit:pRecruit,team:pTeam,mypage:pMy,admin:pAdmin}[h]||pHome)(q);
const ms=$("#ms");if(ms)ms.scrollTop=ms.scrollHeight}
// 입력 중인 글자·커서·채팅 스크롤 위치를 지키면서 다시 그려요 (자동 갱신용)
function softRender(){const a=document.activeElement,fid=a&&a.id,pos=a&&a.selectionStart,keep={};
document.querySelectorAll("#app input[id],#app textarea[id]").forEach(x=>{if(x.type!=="file"&&x.type!=="checkbox")keep[x.id]=x.value});
if([...document.querySelectorAll("#app input[type=file]")].some(x=>x.files.length))return; // 파일을 골라 둔 상태면 지워지지 않게 건너뛰어요
const ms=$("#ms"),stay=ms&&ms.scrollHeight-ms.scrollTop-ms.clientHeight>40,top=ms&&ms.scrollTop;
render();for(const id in keep){const x=document.getElementById(id);if(x)x.value=keep[id]}
if(fid){const x=document.getElementById(fid);if(x){x.focus();try{x.setSelectionRange(pos,pos)}catch(_){}}}
const m2=$("#ms");if(m2&&stay)m2.scrollTop=top} // 위로 올려 읽는 중이면 아래로 끌어내리지 않아요
// 채팅 말풍선 우클릭 메뉴 (다른 사람 메시지에만 '신고하기')
const ctx=document.createElement("div");ctx.className="ctx";ctx.setAttribute("role","menu");document.body.append(ctx);
function hideCtx(){ctx.classList.remove("on")}
document.addEventListener("contextmenu",e=>{const g=e.target.closest("#ms .mg[data-mid]");if(!g){hideCtx();return}
e.preventDefault();ctx.innerHTML=`<button role="menuitem" data-a="msgReport" data-mid="${g.dataset.mid}">🚩 신고하기</button>`;ctx.classList.add("on");
const w=ctx.offsetWidth,h=ctx.offsetHeight;ctx.style.left=Math.min(e.clientX,innerWidth-w-8)+"px";ctx.style.top=Math.min(e.clientY,innerHeight-h-8)+"px";ctx.querySelector("button").focus()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")hideCtx()});
addEventListener("scroll",hideCtx,true);addEventListener("resize",hideCtx);
document.addEventListener("click",e=>{if(!e.target.closest(".ctx"))hideCtx()});
document.addEventListener("click",e=>{const b=e.target.closest("[data-a]");if(!b)return;if(b.tagName==="A")e.preventDefault();act(b.dataset.a,b)});
document.addEventListener("change",e=>{const id=e.target.id;if(id==="tsel"){S.tid=+e.target.value;render();loadRoom(S.tid)}
else if(id==="avd"&&e.target.value){S.avd=e.target.value;render()}
else if(id==="bsel"){S.bc=+e.target.value;render()}   // [게시판] 공모전 선택
else if(id==="csort"){S.cs=e.target.value;render()}}); // [주요공모전] 정렬
// [게시판] 자기소개서 글자 수 표시
document.addEventListener("input",e=>{if(e.target.id==="ai"&&$("#aic"))$("#aic").textContent=e.target.value.length});
// 팀채팅 화면을 보고 있으면 3초마다 새 내용을 확인해요 (다른 팀원의 메시지가 자동으로 보이게)
setInterval(()=>{if(S.user&&location.hash==="#team"&&document.visibilityState==="visible"&&myTeams().some(t=>t.id===S.tid))loadRoom(S.tid,true)},3000);
document.addEventListener("keydown",e=>{if(e.key!=="Enter")return;const id=e.target.id;
if(id==="ci")act("send",e.target);
else if(["aid","apw","ae","an"].includes(id)){const b=$('[data-a="authOk"]');if(b&&!b.disabled)act("authOk",b)}
else if(id==="qpw"){const b=$('[data-a="quitOk"]');if(b&&!b.disabled)act("quitOk",b)}
else if(id==="aq")act("admSearch",e.target);else if(id==="apq")act("admPSearch",e.target)
else if(id==="bq")act("bsearch",e.target)}); // [게시판] 검색어 Enter
addEventListener("hashchange",()=>{if(location.hash!=="#recruit"){S.edit=0;S.pre=""}if(location.hash!=="#admin")S.adm=null;S.ctr="전체";render();scrollTo(0,0)});
render();
// 새로고침해도 로그인 유지: 서버 세션이 살아 있으면 사용자 정보를 받아와요
// 그다음 모집글·지원 현황을 서버에서 불러와요
api("/api/me").then(u=>{S.user=u}).catch(()=>{}).then(loadAll);
