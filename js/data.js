// 예시 데이터와 화면 상태(S): 공모전(C), 팀 모집글(TM), 내 지원·후기·완료 프로젝트, 팀채팅 방(room)
// 모집글(TM)·내 지원(S.apps)·받은 신청서(S.recv)는 서버에서 불러와요 (actions.js의 loadAll)

const LV={1:"초보",2:"중급",3:"고급"},T=new Date(2026,10,19),GR=["#3a6df0,#7b3ff0","#f0623a,#f0a13a","#10a58a,#2b6de0","#d6264a,#7b2ff0"];
const C=[
{id:1,t:"MTN 중소기업 광고 공모전",h:"MTN",d:"2026-12-04",info:"중소기업 제품·서비스를 알리는 광고 아이디어와 15초 영상 시안을 공모합니다.",roles:["기획","카피","디자인","영상"]},
{id:2,t:"서울 영상 공모전 밤로그",h:"서울시",d:"2026-11-27",info:"서울의 밤 풍경을 담은 1분 이내 숏폼 영상을 모집합니다.",roles:["기획","영상"]},
{id:3,t:"AI 융합교육 플랫폼 챌린지",h:"교육부",d:"2026-12-18",info:"교육용 AI 서비스를 직접 구현해 발표하는 개발 공모전입니다.",roles:["기획","프론트","백엔드"]},
{id:4,t:"연구재단 50주년 엠블럼 디자인",h:"한국연구재단",d:"2026-12-02",info:"재단 50주년을 기념하는 엠블럼 디자인을 공모합니다.",roles:["디자인"]}];
const TM=[]; // 서버(/api/posts)에서 받아 채워요
// 모집글의 공모전 정보: 목록(C)에 있으면 그 정보를, 없으면 이름만 써요
const ctOf=t=>C.find(c=>c.t===t.ctitle)||{t:t.ctitle,h:"",d:"",info:"",roles:[]};
const RPR=["스팸·홍보","욕설·비방","허위 정보","부적절한 내용","기타"]; // 신고 사유 (server.js와 같아야 해요)
const S={user:null,am:"in",f:0,tid:1,tt:"nt",lf:"전체",cm:{y:2026,m:10},mm:{y:2026,m:10},sel:"",rate:5,
apps:[],recv:[],
// 마이페이지(프로필·받은 후기·완료된 프로젝트·남긴 후기)는 빈 상태로 시작해요
prof:{aff:"",aw:[],pf:[]},rv:[],done:[],gv:[]};
// 팀채팅 방(R[모집글 id]): 서버(/api/teams/:id)에서 불러와요. 아직 안 불러왔으면 빈 방을 돌려주고 불러오기를 시작해요
const R={},EMPTY_ROOM={nt:[],msgs:[],lib:[],vt:[],ev:[],av:[],loading:1};
const room=t=>{if(!R[t]&&S.user)loadRoom(t);return R[t]||EMPTY_ROOM};
const myApp=id=>S.apps.find(a=>a.tid===id);
