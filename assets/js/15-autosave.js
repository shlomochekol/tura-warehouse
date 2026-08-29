/* ============ שמירה אוטומטית ביציאה ============ */
function saveOnExit(){
  if(typeof sbLoggedIn!=='function'||!sbLoggedIn())return;
  try{ if(typeof sbPushChanged==='function')sbPushChanged(true); }catch(e){}
}
window.addEventListener('beforeunload',saveOnExit);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveOnExit();});
