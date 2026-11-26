// 홈 · 게시판 · 모집글 상세 · 모집글 작성/수정 화면
// [게시판 파트] 팀 모집 공고 상세(pPost): 공모전 내용 / 조건 / 팀 설명 / 지원 버튼(희망 직무 · 자기소개서)

const APST={w:"지원 완료 (대기 중)",c:"결과 확인 요망",a:"참여 중"};
const isClosed=t=>t.status==="closed"||t.mem.length>=t.max; // 관리자/팀장이 마감했거나 정원이 찼으면 마감
function teamCard(t){const c=ctOf(t),a=myApp(t.id),closed=isClosed(t),mine=t.mine;
const lab=a?APST[a.st]:mine?"내가 만든 팀":closed?"모집 마감":"지원하기";
return `<article class="card">${t.blinded?`<p class="red" style="margin:0;font-size:13px">관리자에 의해 블라인드된 글이에요. 다른 사람에게는 보이지 않아요.${t.blindReason?` (사유: ${E(t.blindReason)})`:""}</p>`:""}
<div style="display:flex;align-items:center;gap:6px"><span class="lv l${t.lv}">${LV[t.lv]}</span>${closed?`<span class="rl" style="margin:0">모집 마감</span>`:""}<span class="m" style="flex:1">${E(c.t)}</span>${S.user&&!mine?`<button class="ck" data-a="report" data-t="post" data-id="${t.id}" aria-label="모집글 신고">신고</button>`:""}<a class="m" href="#post/${t.id}" style="white-space:nowrap">상세 ›</a></div><h3><a href="#post/${t.id}">${E(t.name)}</a></h3>${c.info||t.desc?`<p class="m" style="margin:0">${E(c.info||t.desc)}</p>`:""}
<dl><dt>조건</dt><dd>${E(t.cond)}</dd><dt>팀원</dt><dd>${t.mem.map(E).join(", ")} <span class="m">(${t.mem.length}/${t.max})</span></dd><dt>모집 직무</dt><dd>${rl(t.need)}</dd></dl>
${mine&&S.user?`<div style="display:flex;gap:8px;margin-top:auto"><button class="ab" style="margin:0;background:none;color:var(--ink);border-color:var(--line)" data-a="edit" data-id="${t.id}">모집글 수정</button><button class="ab" style="margin:0;background:none;color:var(--red)" data-a="del" data-id="${t.id}">모집글 삭제</button></div>`:`<button class="ab" data-a="apply" data-id="${t.id}" ${a||mine||closed?"disabled":""}>${lab}</button>`}</article>`}
const poster=(c,i)=>`<a class="poster" href="#contest/${c.id}" style="background:linear-gradient(150deg,${GR[i%4]})"><span class="m" style="color:#fff">${E(c.h)} · <b style="font-size:13px">${dd(c.d)}</b></span><b>${E(c.t)}</b></a>`;
const need=n=>`<div class="in"><h2 class="pt">${n}</h2><div class="box"><p>로그인 후 이용할 수 있어요.</p><button class="btn r" data-a="login">로그인</button></div></div>`;

function pHome(){return `<div class="hero"><div class="in"><h1>내 수준에 맞는 공모전,<br>같이 할 팀원까지 한 번에.</h1><p>팀 모집 공고마다 단계와 직무 태그가 붙어 있어요.</p><a class="btn w" href="#board">팀 모집 공고 보기</a></div></div>
<div class="in"><section class="sec"><div class="tit"><i>주</i><i>요</i><span>공모전</span><a href="#contest">더보기 ›</a></div><div class="grid">${C.map(poster).join("")}</div></section>
<section class="sec"><div class="tit"><i>팀</i><i>모</i><i>집</i><span>최신 공고</span><a href="#board">더보기 ›</a></div><div class="grid">${TM.slice(0,3).map(teamCard).join("")}</div></section></div>`}

// 게시판 목록: 단계 탭 + 공모전 선택 + 검색(팀명·공모전·조건·팀 설명·직무)
function pBoard(){const q=S.bq.toLowerCase(),l=TM.filter(t=>(!S.f||t.lv===S.f)&&(!S.bc||t.cid===S.bc)&&(!q||[t.name,t.ctitle,t.cond,t.desc||"",t.need.join(" ")].join(" ").toLowerCase().includes(q)));
return `<div class="in"><h2 class="pt">게시판 · 팀 모집 공고</h2><div class="tabs">${[[0,"전체"],[1,"초보"],[2,"중급"],[3,"고급"]].map(([v,n])=>`<button class="${S.f===v?"on":""}" data-a="bf" data-v="${v}">${n}</button>`).join("")}</div>
<div class="row" style="margin-top:14px"><select id="bsel" aria-label="공모전 선택" style="max-width:280px"><option value="0">공모전 전체</option>${C.map(c=>`<option value="${c.id}" ${S.bc===c.id?"selected":""}>${E(c.t)}</option>`).join("")}</select><input id="bq" value="${E(S.bq)}" placeholder="팀명, 공모전, 직무로 검색" aria-label="검색어"><button class="btn" data-a="bsearch">검색</button>${S.bq||S.bc?`<button class="btn o" data-a="bclr">초기화</button>`:""}<a class="btn r" href="#recruit">모집글 작성</a></div>
<p class="m" style="margin:10px 0 0">공고 ${l.length}개</p><div class="grid" style="margin-top:8px">${l.map(teamCard).join("")||`<p class="empty">조건에 맞는 공고가 없어요.</p>`}</div></div>`}

// 팀 모집 공고 상세
const dot=d=>d?d.replace(/-/g,"."):"-";
function pPost(q){const t=TM.find(x=>x.id===+q);
if(!t)return `<div class="in"><h2 class="pt">게시판</h2><div class="box"><p class="empty">${TM.length?"삭제되었거나 없는 모집글이에요.":"불러오는 중…"}</p><a class="btn o" href="#board">목록으로</a></div></div>`;
const c=ctOf(t),own=!!c.id,a=myApp(t.id),closed=isClosed(t),full=t.mem.length>=t.max,mine=t.mine,left=t.max-t.mem.length,others=TM.filter(x=>x.ctitle===t.ctitle&&x.id!==t.id);
const info=[["주최",c.h],["접수 기간",c.p?dot(c.p)+" ~ "+dot(c.d):c.d?"~ "+dot(c.d):""],["참가 대상",c.who],["시상",c.prize]].filter(x=>x[1]);
let side;
if(mine&&S.user)side=`<p class="m" style="margin:0 0 10px">내가 만든 팀의 모집글이에요. 받은 신청서는 마이페이지에서 확인해요.</p><a class="btn o" href="#mypage" style="display:block;text-align:center">받은 신청서 보기</a><button class="ab" style="margin-top:8px;background:none;color:var(--ink);border-color:var(--line)" data-a="edit" data-id="${t.id}">모집글 수정</button><button class="ab" style="margin-top:8px;background:none;color:var(--red)" data-a="del" data-id="${t.id}">모집글 삭제</button>`;
else if(a)side=`<span class="st ${a.st}">${APST[a.st]}</span><div class="sh">희망 직무</div><span class="rl">${E(a.role)}</span><div class="sh">자기소개서</div><p style="margin:2px 0;white-space:pre-line">${E(a.intro)||`<span class="m">작성하지 않았어요.</span>`}</p>
${a.st==="w"?`<button class="ab" style="margin-top:14px;background:none;color:var(--ink);border-color:var(--line)" data-a="cancelApp" data-id="${t.id}">지원 취소</button>`:a.st==="a"?`<a class="ab" href="#team" style="display:block;text-align:center;margin-top:14px">팀채팅 가기</a>`:`<a class="ab" href="#mypage" style="display:block;text-align:center;margin-top:14px">결과 확인하기</a>`}`;
else side=`<p class="m" style="margin:0 0 6px">희망 직무를 고르고 자기소개서를 작성해 지원해요.</p><div style="margin-bottom:12px">${t.need.map(r=>`<button class="rl rb" data-a="apply" data-id="${t.id}" data-r="${E(r)}" ${closed?"disabled":""}>${E(r)} 지원</button>`).join("")}</div><button class="ab" data-a="apply" data-id="${t.id}" ${closed?"disabled":""}>${closed?"모집 마감":"지원하기"}</button>${S.user?`<button class="ck" style="margin-top:10px" data-a="report" data-t="post" data-id="${t.id}">이 모집글 신고</button>`:""}`;
return `<div class="in"><p class="bc"><a href="#board">게시판</a> › <a href="#board">팀 모집 공고</a> › ${E(t.name)}</p>
${t.blinded?`<p class="red" style="margin:8px 0 0">관리자에 의해 블라인드된 글이에요. 다른 사람에게는 보이지 않아요.${t.blindReason?` (사유: ${E(t.blindReason)})`:""}</p>`:""}
<div class="dh"><div><span class="lv l${t.lv}">${LV[t.lv]}</span> ${own?`<a class="m" href="#contest/${c.id}">${E(c.t)} ›</a>`:`<span class="m">${E(c.t)}</span>`}</div><h2 class="pt" style="margin:6px 0 4px">${E(t.name)}</h2><span class="m">팀원 ${t.mem.length}/${t.max}명 · ${closed?(full?"정원 마감":"모집 마감"):"남은 자리 "+left+"명"}${c.d?" · 공모전 마감 "+dd(c.d):""}</span></div>
<div class="dv"><div>
<section class="box"><h3 class="bh">공모전 내용</h3><b>${E(c.t)}</b><p style="margin:4px 0 0">${E(c.info)||`<span class="m">등록된 공모전 소개가 없어요.</span>`}</p>${info.length?`<dl class="ib">${info.map(([k,v])=>`<dt>${k}</dt><dd>${E(v)}</dd>`).join("")}</dl>`:""}${own?`<a class="red" href="#contest/${c.id}" style="display:inline-block;margin-top:10px">공모전 자세히 보기 ›</a>`:""}</section>
<section class="box" style="margin-top:20px"><h3 class="bh">조건</h3><dl class="ib" style="margin-top:0"><dt>참여 수준</dt><dd><span class="lv l${t.lv}">${LV[t.lv]}</span></dd><dt>모집 조건</dt><dd>${E(t.cond)}</dd><dt>모집 인원</dt><dd>최대 ${t.max}명 (본인 포함) · 남은 자리 ${Math.max(0,left)}명</dd><dt>모집 직무</dt><dd>${rl(t.need)}</dd></dl></section>
<section class="box" style="margin-top:20px"><h3 class="bh">팀 설명</h3><p style="margin:0;white-space:pre-line">${E(t.desc||"")||`<span class="m">팀 설명이 아직 없어요.</span>`}</p><div class="sh">현재 팀원 (${t.mem.length})</div>${t.mem.map(m=>{const i=m.lastIndexOf("("),n=i>0?m.slice(0,i):m,r=i>0?m.slice(i+1,-1):"";return `<div class="it"><b>${E(n)}</b>${r?`<span class="rl">${E(r)}</span>`:""}</div>`}).join("")}</section>
</div><aside class="box side"><h3 class="bh">지원하기</h3>${side}</aside></div>
${others.length?`<section class="sec"><div class="tit"><span style="margin:0;font-size:20px;font-weight:900">같은 공모전의 다른 팀</span>${own?`<a href="#contest/${c.id}">공모전 보기 ›</a>`:""}</div><div class="grid">${others.map(teamCard).join("")}</div></section>`:""}
<div class="row" style="margin-top:24px"><a class="btn o" href="#board">‹ 목록으로</a></div></div>`}

function pRecruit(){if(!S.user)return need("모집글 작성");
const t=S.edit?TM.find(x=>x.id===S.edit):null,c=t?ctOf(t):null;
return `<div class="in" style="max-width:920px"><h2 class="pt">${t?"모집글 수정":"모집글 작성"}</h2><div class="box" style="padding:28px 32px">
<label for="rcid">대상 공모전</label><input id="rcid" list="clist" placeholder="예: MTN 중소기업 광고 공모전" autocomplete="off" value="${c?E(c.t):E(S.pre)}"><datalist id="clist">${C.map(x=>`<option value="${E(x.t)}">`).join("")}</datalist>
<label for="rname">팀명</label><input id="rname" placeholder="예: 챌린지 메이커스" value="${t?E(t.name):""}">
<div class="row" style="flex-wrap:nowrap;gap:16px">
  <div style="flex:1;min-width:0"><label for="rlv">참여 수준</label><select id="rlv" style="width:100%">${[1,2,3].map(n=>`<option value="${n}" ${t&&t.lv===n?"selected":""}>${LV[n]}</option>`).join("")}</select></div>
  <div style="flex:1;min-width:0"><label for="rmax">최대 인원 (본인 포함)</label><input id="rmax" type="number" min="2" max="10" value="${t?t.max:4}" style="width:100%"></div>
</div>
<label for="rcond">모집 조건</label><input id="rcond" placeholder="예: 주 1회 온라인 회의, 성실하게 참여하실 분" value="${t?E(t.cond):""}">
<label for="rdesc">팀 설명</label><textarea id="rdesc" rows="4" maxlength="1000" placeholder="팀 분위기, 진행 방식, 목표 등을 소개해 주세요.">${t?E(t.desc||""):""}</textarea>
<label for="rneed">모집 직무 (쉼표로 구분)</label><input id="rneed" placeholder="예: 기획, 디자인, 프론트" value="${t?E(t.need.join(", ")):""}">
<div class="row" style="justify-content:flex-end;margin-top:16px"><a class="btn o" href="${t?"#post/"+t.id:"#board"}">취소</a><button class="btn r" data-a="recruitOk">${t?"수정하기":"등록하기"}</button></div>
</div></div>`}
