// 공통 도우미 함수: DOM 선택, HTML 이스케이프, 날짜 계산, 토스트, 파일 형식 검사

const $=s=>document.querySelector(s),E=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dn=d=>Math.round((new Date(d)-T)/864e5),dd=d=>{const n=dn(d);return n<0?"마감":n?"D-"+n:"D-day"},md=d=>d.slice(5).replace("-","/");
const rl=a=>a.map(r=>`<span class="rl">${E(r)}</span>`).join("");
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.x);toast.x=setTimeout(()=>t.classList.remove("on"),2200)};
const ymd=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; // 날짜 → "2026-11-26"
const okPdf=f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name);
const okImg=f=>/^image\/(jpeg|png)$/.test(f.type)||/\.(jpe?g|png)$/i.test(f.name);
