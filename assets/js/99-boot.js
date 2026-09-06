/* ============ שמירת מיקום הגלילה בכל רינדור ============
   האפליקציה בונה מחדש מסך שלם בהרבה מקומות (עריכה, סנכרון, מעבר תצוגה).
   בלי זה — כל רינדור קופץ לראש הדף באמצע עבודה. */
(function(){
  const SCROLLERS='.tablewrap,.mapscroll,.tk-list,.bd-mgrid,.view';
  function snapshotScroll(){
    return {
      wy:window.scrollY, wx:window.scrollX,
      inner:[...document.querySelectorAll(SCROLLERS)].map(el=>({t:el.scrollTop,l:el.scrollLeft})),
      focus:(()=>{const a=document.activeElement;
        return (a&&a.dataset&&(a.dataset.eid||a.dataset.f))
          ? {eid:a.dataset.eid||'',f:a.dataset.f||'',pos:(a.selectionStart!==undefined?a.selectionStart:null)} : null;})()
    };
  }
  function restoreScroll(s){
    const els=[...document.querySelectorAll(SCROLLERS)];
    els.forEach((el,i)=>{const v=s.inner[i];if(!v)return;
      if(el.scrollTop!==v.t)el.scrollTop=v.t;
      if(el.scrollLeft!==v.l)el.scrollLeft=v.l;});
    if(window.scrollY!==s.wy||window.scrollX!==s.wx)window.scrollTo(s.wx,s.wy);
    if(s.focus&&s.focus.eid){
      const el=document.querySelector('[data-eid="'+s.focus.eid+'"][data-f="'+s.focus.f+'"]');
      if(el&&document.activeElement!==el){
        try{el.focus({preventScroll:true});}catch(e){el.focus();}
        try{if(s.focus.pos!==null)el.setSelectionRange(s.focus.pos,s.focus.pos);}catch(e){}
      }
    }
  }
  function keepScroll(fn){
    return function(){
      const snap=snapshotScroll();
      const out=fn.apply(this,arguments);
      restoreScroll(snap);
      requestAnimationFrame(()=>restoreScroll(snap));   /* גם אחרי הציור */
      return out;
    };
  }
  ['renderLoc','renderTasks','renderInv','renderShip','renderLabels','renderDash','renderMap','renderInvLog']
    .forEach(n=>{ if(typeof window[n]==='function' && !window[n].__kept){
      const w=keepScroll(window[n]); w.__kept=true; window[n]=w; }});
  window.__keepScroll=keepScroll;
})();
/* הדפדפן גולל את הטבלה כשנכנסים לשדה ("scroll into view").
   בטבלאות ארוכות זה נראה כמו קפיצה — מנטרלים על ידי שחזור מיידי. */
document.addEventListener('focusin',function(e){
  const el=e.target;
  if(!el||!el.dataset||!el.dataset.eid)return;
  const wrap=el.closest('.tablewrap');
  const before=wrap?wrap.scrollTop:0, beforeL=wrap?wrap.scrollLeft:0;
  const wy=window.scrollY, wx=window.scrollX;
  const r0=el.getBoundingClientRect();
  const wasVisible=r0.top>=0&&r0.bottom<=window.innerHeight&&(!wrap||(r0.top>=wrap.getBoundingClientRect().top-2&&r0.bottom<=wrap.getBoundingClientRect().bottom+2));
  requestAnimationFrame(()=>{
    if(!wasVisible)return;                       /* אם השדה לא היה גלוי — שיגלול אליו */
    if(wrap){if(wrap.scrollTop!==before)wrap.scrollTop=before;
             if(wrap.scrollLeft!==beforeL)wrap.scrollLeft=beforeL;}
    if(window.scrollY!==wy||window.scrollX!==wx)window.scrollTo(wx,wy);
  });
},true);
/* סגירת חלונות ומסכים ב-Escape (כאן — אחרי שכל הפונקציות הוגדרו) */
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  try{
    /* בדיקה לפי הסגנון בפועל — יש רכיבים שמוסתרים ב-CSS ולא בסגנון מוטבע */
    /* position:fixed מחזיר offsetParent=null — נסמכים על הסגנון בפועל בלבד */
    const visible=el=>!!el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
    const bc=document.getElementById('bcscan');
    if(visible(bc)&&typeof closeBarcodeScan==='function'){closeBarcodeScan();return;}
    const sc=document.getElementById('scanov');
    if(visible(sc)&&typeof closeScanner==='function'){closeScanner();return;}
    const md=document.getElementById('modal');
    if(md&&md.classList.contains('open')&&typeof closeModal==='function'){closeModal();return;}
  }catch(err){}
});
/* keep the map viewport where the user was, on any re-render */
(function(){
  if(typeof renderMap!=='function')return;
  const _orig=renderMap;
  let _pos=null;
  window.renderMap=function(){
    const el=document.querySelector('#v-map .mapscroll');
    if(el)_pos={l:el.scrollLeft,t:el.scrollTop};
    const out=_orig.apply(this,arguments);
    if(_pos){
      const el2=document.querySelector('#v-map .mapscroll');
      if(el2){el2.scrollLeft=_pos.l;el2.scrollTop=_pos.t;
        requestAnimationFrame(()=>{el2.scrollLeft=_pos.l;el2.scrollTop=_pos.t;});}
    }
    return out;
  };
})();
if(typeof sanitizeState==='function')sanitizeState();
loadCustomCats();seedCatDefaults();ensureAllCodes();if(typeof ensureRowIds==='function')ensureRowIds();/* פריטים שנטענו בלי קפסולה/צבע — משלימים מההגדרות הקיימות */
(function(){
  try{
    let n=0;
    (state.entries||[]).forEach(e=>{
      if(!e.capsule&&e.capsule!==0&&e.capsule!=='0'){const c=capOf(e.category);e.capsule=c[0];e.capcolor=c[1];n++;}
      else if(!e.capcolor){e.capcolor=capOf(e.category)[1];n++;}
      if(!e.color){e.color=colorOf(e.category);n++;}
    });
    if(n)localStorage.setItem(KEY,JSON.stringify(state));
  }catch(e){}
})();
applyBrand();buildNav();activate(0);setInterval(function(){if(typeof sbLoggedIn==='function'&&sbLoggedIn())sbRefresh();},45*60*1000);
window.addEventListener('load',function(){
  setTimeout(function(){try{
    const f=selfTest().filter(x=>x.pass===false);
    if(f.length){console.warn('בדיקת תקינות נכשלה:',f);toast('⚠ בדיקת תקינות מצאה '+f.length+' תקלות — ראה הגדרות מתקדמות');}
  }catch(e){}},2500);
  if(typeof sbLoggedIn!=='function')return;if(sbLoggedIn()){var lb=document.getElementById('logoutBtn');if(lb)lb.style.display='inline-block';sbMaybeDailyBackup();sbLoadPlan();sbPull().catch(function(e){if(e&&e.message==='__RELOGIN__'){sbRenderLogin();sbShowLogin();}else{sbSyncMsg('שגיאת ענן — '+((e&&e.message)||''));}});}else{sbRenderLogin();sbShowLogin();}});

