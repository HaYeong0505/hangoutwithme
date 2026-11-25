# 행아웃윗미

공모전에 같이 나갈 팀원을 찾고, 팀이 꾸려지면 팀채팅으로 협업하는 학교 프로젝트예요.
Node.js(Express) 서버 하나가 화면 파일과 API를 함께 제공하고, 데이터는 SQLite 파일(`data.db`)에 저장돼요.

## 처음 실행하기

[Node.js](https://nodejs.org) 20 이상이 필요해요.

```powershell
npm install
```

```powershell
npm start
```

브라우저에서 <http://localhost:3000> 으로 접속하세요.

처음 실행하면 `data.db`와 `uploads` 폴더가 자동으로 만들어지고, 예시 모집글 5개와 관리자 계정이 들어가요.
회원·채팅 같은 다른 사람의 데이터는 GitHub에 올라가지 않으니까 각자 빈 상태에서 시작해요.

## 관리자 계정

| 항목 | 값 |
|---|---|
| ID | `admin` |
| 비밀번호 | `1` (환경변수 `ADMIN_PW`로 바꿀 수 있어요) |

- 관리자는 **서버를 켠 PC에서 `http://localhost:3000`으로 접속할 때만** 로그인할 수 있어요. 터널 주소나 다른 PC에서는 로그인되지 않아요.
- 관리자 계정은 DB에 관리자가 한 명도 없을 때만 자동으로 만들어져요. 이미 만들어진 뒤에 `ADMIN_PW`를 바꿔도 비밀번호는 바뀌지 않아요. 바꾸려면 서버를 끄고 `data.db`를 지운 뒤 다시 켜세요. 모든 데이터가 지워져요.

비밀번호를 정해서 켜려면 이렇게 하세요 (PowerShell):

```powershell
$env:ADMIN_PW="원하는비밀번호"; npm start
```

## 환경변수 (선택)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | 서버 포트 |
| `ADMIN_PW` | `1` | 처음 만들어지는 관리자 계정의 비밀번호 |
| `SESSION_SECRET` | 자동 생성 | 로그인 쿠키 서명 키. 없으면 처음 실행할 때 무작위로 만들어 `data.db`에 보관해요 |

## 인터넷에 잠깐 공개하기 (발표·시연용)

서버를 켠 상태에서 새 터미널을 열고 실행하세요.

```powershell
winget install Cloudflare.cloudflared
```

```powershell
cloudflared tunnel --url http://localhost:3000
```

출력에 나오는 `https://….trycloudflare.com` 주소를 공유하면 돼요. 터미널을 닫으면 주소가 사라지고, 다시 켤 때마다 주소가 바뀌어요.

## 파일 구성

| 경로 | 내용 |
|---|---|
| `server.js` | 서버 전체 (회원, 모집글, 지원, 신고, 팀채팅, 관리자 API) |
| `index.html` | 화면 뼈대 |
| `css/style.css` | 스타일 |
| `js/util.js` | 공통 도우미 함수 |
| `js/data.js` | 화면 상태와 공모전 목록 |
| `js/page-board.js` | 홈 · 게시판 · 모집글 작성 화면 |
| `js/page-team.js` | 팀채팅 화면 |
| `js/page-mypage.js` | 마이페이지 화면 |
| `js/page-admin.js` | 관리자 화면 |
| `js/actions.js` | 버튼 동작과 서버 요청 |
| `js/main.js` | 화면 그리기와 이벤트 연결 (마지막에 불러와요) |

GitHub에 올리지 않는 것: `node_modules/`, `data.db`, `uploads/` (`.gitignore` 참고)

## 데이터 백업과 초기화

- **백업:** 서버를 끄고 `data.db`와 `uploads` 폴더를 함께 복사해 두세요.
- **초기화:** 서버를 끄고 `data.db`와 `uploads` 폴더를 지운 뒤 다시 켜세요.
