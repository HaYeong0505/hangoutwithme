// 홈 · 게시판 · 모집글 작성/수정 화면

function teamCard(t){const c=ctOf(t),a=myApp(t.id),full=t.mem.length>=t.max,closed=t.status==="closed"||full,mine=t.mine;
const lab=a?{w:"지원 완료 (대기 중)",c:"결과 확인 요망",a:"참여 중"}[a.st]:mine?"내가 만든 팀":closed?"모집 마감":"지원하기";
return `<article class="card">${t.blinded?`<p class="red" style="margin:0;font-size:13px">관리자에 의해 블라인드된 글이에요. 다른 사람에게는 보이지 않아요.${t.blindReason?` (사유: ${E(t.blindReason)})`:""}</p>`:""}
<div style="display:flex;align-items:center;gap:6px"><span class="lv l${t.lv}">${LV[t.lv]}</span>${closed?`<span class="rl" style="margin:0">모집 마감</span>`:""}<span class="m" style="flex:1">${E(c.t)}</span>${S.user&&!mine?`<button class="ck" data-a="report" data-t="post" data-id="${t.id}" aria-label="모집글 신고">신고</button>`:""}</div><h3>${E(t.name)}</h3>${c.info?`<p class="m" style="margin:0">${E(c.info)}</p>`:""}
<dl><dt>조건</dt><dd>${E(t.cond)}</dd><dt>팀원</dt><dd>${t.mem.map(E).join(", ")} <span class="m">(${t.mem.length}/${t.max})</span></dd><dt>모집 직무</dt><dd>${rl(t.need)}</dd></dl>
${mine&&S.user?`<div style="display:flex;gap:8px;margin-top:auto"><button class="ab" style="margin:0;background:none;color:var(--ink);border-color:var(--line)" data-a="edit" data-id="${t.id}">모집글 수정</button><button class="ab" style="margin:0;background:none;color:var(--red)" data-a="del" data-id="${t.id}">모집글 삭제</button></div>`:`<button class="ab" data-a="apply" data-id="${t.id}" ${a||mine||closed?"disabled":""}>${lab}</button>`}</article>`}
const poster=(c,i)=>`<a class="poster" href="#board" style="background:linear-gradient(150deg,${GR[i%4]})"><span class="m" style="color:#fff">${E(c.h)} · <b style="font-size:13px">${dd(c.d)}</b></span><b>${E(c.t)}</b></a>`;
const need=n=>`<div class="in"><h2 class="pt">${n}</h2><div class="box"><p>로그인 후 이용할 수 있어요.</p><button class="btn r" data-a="login">로그인</button></div></div>`;

function pHome(){return `<div class="hero"><div class="in"><h1>내 수준에 맞는 공모전,<br>같이 할 팀원까지 한 번에.</h1><p>팀 모집 공고마다 단계와 직무 태그가 붙어 있어요.</p><a class="btn w" href="#board">팀 모집 공고 보기</a></div></div>
<div class="in"><section class="sec"><div class="tit"><i>주</i><i>요</i><span>공모전</span><a href="#board">더보기 ›</a></div><div class="grid">${C.filter(c=>!c.u).map(poster).join("")}</div></section>
<section class="sec"><div class="tit"><i>팀</i><i>모</i><i>집</i><span>최신 공고</span><a href="#board">더보기 ›</a></div><div class="grid">${TM.slice(0,3).map(teamCard).join("")}</div></section></div>`}
function pBoard(){const l=TM.filter(t=>!S.f||t.lv===S.f);
return `<div class="in"><h2 class="pt">게시판 · 팀 모집 공고</h2><div class="tabs">${[[0,"전체"],[1,"초보"],[2,"중급"],[3,"고급"]].map(([v,n])=>`<button class="${S.f===v?"on":""}" data-a="bf" data-v="${v}">${n}</button>`).join("")}</div><div class="grid" style="margin-top:18px">${l.map(teamCard).join("")||`<p class="empty">해당 단계의 공고가 없어요.</p>`}</div></div>`}
function pRecruit(){if(!S.user)return need("모집글 작성");
const t=S.edit?TM.find(x=>x.id===S.edit):null,c=t?ctOf(t):null;
return `<div class="in" style="max-width:920px"><h2 class="pt">${t?"모집글 수정":"모집글 작성"}</h2><div class="box" style="padding:28px 32px">
<label for="rcid">대상 공모전</label><input id="rcid" placeholder="예: MTN 중소기업 광고 공모전" autocomplete="off" value="${c?E(c.t):""}">
<label for="rname">팀명</label><input id="rname" placeholder="예: 챌린지 메이커스" value="${t?E(t.name):""}">
<div class="row" style="flex-wrap:nowrap;gap:16px">
  <div style="flex:1;min-width:0"><label for="rlv">참여 수준</label><select id="rlv" style="width:100%">${[1,2,3].map(n=>`<option value="${n}" ${t&&t.lv===n?"selected":""}>${LV[n]}</option>`).join("")}</select></div>
  <div style="flex:1;min-width:0"><label for="rmax">최대 인원 (본인 포함)</label><input id="rmax" type="number" min="2" max="10" value="${t?t.max:4}" style="width:100%"></div>
</div>
<label for="rcond">모집 조건</label><input id="rcond" placeholder="예: 주 1회 온라인 회의, 성실하게 참여하실 분" value="${t?E(t.cond):""}">
<label for="rneed">모집 직무 (쉼표로 구분)</label><input id="rneed" placeholder="예: 기획, 디자인, 프론트" value="${t?E(t.need.join(", ")):""}">
<div class="row" style="justify-content:flex-end;margin-top:16px"><a class="btn o" href="#board">취소</a><button class="btn r" data-a="recruitOk">${t?"수정하기":"등록하기"}</button></div>
</div></div>`}

