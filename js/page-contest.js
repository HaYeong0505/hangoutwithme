// 주요공모전 화면: 공모전 목록(직군 필터 · 정렬)과 공모전 상세
// [주요공모전 파트] 상세(pCDetail): 공모전 내용 / 참여 가능 직군 / 이 공모전에 해당하는 팀
// 팀(TM)은 서버에서 불러온 모집글이고, t.cid(공모전 번호)는 actions.js의 loadAll에서 연결해요

const tOf=id=>TM.filter(t=>t.cid===id),open=t=>!isClosed(t); // 이 공모전의 팀 / 아직 모집 중인 팀
const gi=c=>GR[C.indexOf(c)%4]; // 홈 포스터와 같은 색을 쓰도록 C 안의 순서로 색을 골라요

function cCard(c){const n=tOf(c.id).filter(open).length;
return `<article class="card"><a class="poster" href="#contest/${c.id}" style="background:linear-gradient(150deg,${gi(c)})"><span class="m" style="color:#fff">${E(c.h)} · <b style="font-size:13px">${dd(c.d)}</b></span><b>${E(c.t)}</b></a>
<p class="m" style="margin:0">${E(c.info)}</p><div><span class="m">참여 가능 직군</span><br>${rl(c.roles)}</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;gap:8px"><span class="m">마감 ${md(c.d)} · 모집 중인 팀 <b class="red">${n}</b></span><a class="btn sm o" href="#contest/${c.id}">자세히 보기</a></div></article>`}

function pContest(q){if(q)return pCDetail(q);
const rs=["전체",...new Set(C.flatMap(c=>c.roles))];
let l=C.filter(c=>S.cr==="전체"||c.roles.includes(S.cr));
const sk={d:c=>(dn(c.d)<0?1e4:0)+dn(c.d),n:c=>-tOf(c.id).filter(open).length,p:c=>-new Date(c.p||c.d)}[S.cs];
l=[...l].sort((a,b)=>sk(a)-sk(b));
return `<div class="in"><h2 class="pt">주요공모전</h2><p class="m" style="margin:-6px 0 0">지금 팀원을 모으고 있는 공모전이에요. 내 직군으로 참여할 수 있는 공모전을 골라 보세요.</p>
<div class="tabs">${rs.map(r=>`<button class="${S.cr===r?"on":""}" data-a="cr" data-v="${E(r)}">${E(r)}</button>`).join("")}</div>
<div class="row" style="justify-content:space-between;margin-top:14px"><span class="m">공모전 ${l.length}개</span><select id="csort" aria-label="정렬" style="max-width:180px;flex:none"><option value="d" ${S.cs==="d"?"selected":""}>마감 임박순</option><option value="n" ${S.cs==="n"?"selected":""}>모집 중인 팀 많은순</option><option value="p" ${S.cs==="p"?"selected":""}>최근 접수 시작순</option></select></div>
<div class="grid" style="margin-top:8px">${l.map(cCard).join("")||`<p class="empty">이 직군으로 참여할 수 있는 공모전이 없어요.</p>`}</div></div>`}

function pCDetail(q){const c=C.find(x=>x.id===+q);
if(!c)return `<div class="in"><h2 class="pt">주요공모전</h2><div class="box"><p class="empty">없는 공모전이에요.</p><a class="btn o" href="#contest">목록으로</a></div></div>`;
const ts=tOf(c.id),fl=ts.filter(t=>S.ctr==="전체"||t.need.includes(S.ctr)),closed=dn(c.d)<0;
const info=[["주최",c.h],["접수 기간",(c.p?dot(c.p)+" ~ ":"~ ")+dot(c.d)],["참가 대상",c.who],["시상",c.prize],["제출물",c.sub]].filter(x=>x[1]);
return `<div class="in"><p class="bc"><a href="#contest">주요공모전</a> › ${E(c.t)}</p>
<div class="cb" style="background:linear-gradient(120deg,${gi(c)})"><span>${E(c.h)} · <b>${dd(c.d)}</b></span><h2>${E(c.t)}</h2><span>접수 ${c.p?dot(c.p)+" ~ ":"~ "}${dot(c.d)}</span>
<div class="row" style="margin-top:16px">${closed?"":`<button class="btn w" data-a="mkTeam" data-id="${c.id}">이 공모전으로 팀 만들기</button>`}${c.url?`<a class="btn" style="background:none;color:#fff;border-color:#fff" href="${E(c.url)}" target="_blank" rel="noopener">공모전 요강 보기 ↗</a>`:""}</div></div>
<div class="two" style="margin-top:20px">
<section class="box"><h3 class="bh">공모전 내용</h3><p style="margin:0">${E(c.info)}</p><dl class="ib">${info.map(([k,v])=>`<dt>${k}</dt><dd>${E(v)}</dd>`).join("")}</dl></section>
<section class="box"><h3 class="bh">참여 가능 직군</h3><p class="m" style="margin:0 0 4px">직군을 누르면 그 직군을 모집하는 팀만 아래에 보여요.</p>
${c.roles.map(r=>{const rt=ts.filter(t=>t.need.includes(r)&&open(t));return `<button class="it rr${S.ctr===r?" on":""}" data-a="ctr" data-v="${E(r)}"><span><span class="rl">${E(r)}</span></span><span class="m">${rt.length?`모집 중인 팀 <strong class="red">${rt.length}</strong>개`:"모집 중인 팀 없음"}</span></button>`}).join("")}</section></div>
<section class="sec" style="margin-top:34px"><div class="tit"><i>팀</i><span>이 공모전에 해당하는 팀 (${ts.length})</span>${closed?"":`<a href="#" data-a="mkTeam" data-id="${c.id}">+ 팀 만들기</a>`}</div>
<div class="tabs" style="margin-top:0">${["전체",...c.roles].map(r=>`<button class="${S.ctr===r?"on":""}" data-a="ctr" data-v="${E(r)}">${E(r)}${r==="전체"?"":" 모집"}</button>`).join("")}</div>
<div class="grid" style="margin-top:18px">${fl.map(teamCard).join("")||`<div class="box" style="grid-column:1/-1;text-align:center"><p class="empty">${S.ctr==="전체"?"아직 이 공모전의 팀 모집 공고가 없어요.":E(S.ctr)+" 직군을 모집하는 팀이 없어요."}</p>${closed?"":`<button class="btn r" data-a="mkTeam" data-id="${c.id}">직접 팀 만들기</button>`}</div>`}</div></section>
<div class="row"><a class="btn o" href="#contest">‹ 목록으로</a></div></div>`}
