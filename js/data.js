// 예시 데이터와 화면 상태(S): 공모전(C), 팀 모집글(TM), 내 지원·후기·완료 프로젝트, 팀채팅 방(room)
// 모집글(TM)·내 지원(S.apps)·받은 신청서(S.recv)는 서버에서 불러와요 (actions.js의 loadAll)

const LV={1:"초보",2:"중급",3:"고급"},T=new Date(2026,10,19),GR=["#3a6df0,#7b3ff0","#f0623a,#f0a13a","#10a58a,#2b6de0","#d6264a,#7b2ff0"];
// 공모전 목록: p 접수 시작 · d 마감 · who 참가 대상 · prize 시상 · sub 제출물 · url 요강 링크 ([주요공모전] 상세에 보여요)
const C=[
{id:1,t:"MTN 중소기업 광고 공모전",h:"MTN",p:"2026-11-03",d:"2026-12-04",info:"중소기업 제품·서비스를 알리는 광고 아이디어와 15초 영상 시안을 공모합니다.",who:"대학생·대학원생 (팀 최대 4명)",prize:"대상 300만원 · 최우수상 150만원 · 우수상 50만원",sub:"광고 기획서(PDF 10장 이내) + 15초 영상 시안",url:"https://example.com/mtn",roles:["기획","카피","디자인","영상"]},
{id:2,t:"서울 영상 공모전 밤로그",h:"서울시",p:"2026-10-27",d:"2026-11-27",info:"서울의 밤 풍경을 담은 1분 이내 숏폼 영상을 모집합니다.",who:"서울 소재 대학 재학생·휴학생 누구나",prize:"대상 200만원 · 입선 10팀 각 20만원",sub:"세로형 숏폼 영상(1분 이내, mp4)",url:"https://example.com/nightlog",roles:["기획","영상"]},
{id:3,t:"AI 융합교육 플랫폼 챌린지",h:"교육부",p:"2026-11-10",d:"2026-12-18",info:"교육용 AI 서비스를 직접 구현해 발표하는 개발 공모전입니다.",who:"전국 대학생 (2~5인 팀)",prize:"장관상 500만원 · 우수상 200만원 · 장려상 100만원",sub:"동작하는 서비스 데모 + 발표 자료 + GitHub 저장소",url:"https://example.com/ai-edu",roles:["기획","프론트","백엔드"]},
{id:4,t:"연구재단 50주년 엠블럼 디자인",h:"한국연구재단",p:"2026-11-01",d:"2026-12-02",info:"재단 50주년을 기념하는 엠블럼 디자인을 공모합니다.",who:"제한 없음 (개인·팀 모두 가능)",prize:"최우수 1점 300만원 · 우수 2점 각 100만원",sub:"엠블럼 원본(AI) + 설명서(A4 1장)",url:"https://example.com/emblem",roles:["디자인"]}];
const TM=[]; // 서버(/api/posts)에서 받아 채워요 (t.desc = 팀 설명, t.cid = 공모전 번호)
// 모집글의 공모전 정보: 목록(C)에 있으면 그 정보를, 없으면 이름만 써요 (직접 입력한 공모전은 id가 없어요)
const ctOf=t=>C.find(c=>c.t===t.ctitle)||{t:t.ctitle,h:"",d:"",info:"",roles:[]};
const cidOf=t=>(C.find(c=>c.t===t.ctitle)||{}).id||0;
const RPR=["스팸·홍보","욕설·비방","허위 정보","부적절한 내용","기타"]; // 신고 사유 (server.js와 같아야 해요)
// bc·bq = 게시판 공모전 필터·검색어, cr·cs = 주요공모전 직군 필터·정렬, ctr = 공모전 상세의 팀 직군 필터, pre = 모집글 작성 시 미리 채울 공모전
const S={user:null,am:"in",f:0,bc:0,bq:"",cr:"전체",cs:"d",ctr:"전체",pre:"",tid:1,tt:"nt",lf:"전체",cm:{y:2026,m:10},mm:{y:2026,m:10},sel:"",rate:5,
apps:[],recv:[],
// 마이페이지(프로필·받은 후기·완료된 프로젝트·남긴 후기)는 빈 상태로 시작해요
prof:{aff:"",aw:[],car:[],pf:[]},rv:[],done:[],gv:[]};
// 팀채팅 방(R[모집글 id]): 서버(/api/teams/:id)에서 불러와요. 아직 안 불러왔으면 빈 방을 돌려주고 불러오기를 시작해요
const R={},EMPTY_ROOM={nt:[],msgs:[],lib:[],vt:[],ev:[],av:[],loading:1};
const room=t=>{if(!R[t]&&S.user)loadRoom(t);return R[t]||EMPTY_ROOM};
const myApp=id=>S.apps.find(a=>a.tid===id);
