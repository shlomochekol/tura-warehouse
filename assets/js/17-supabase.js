/* ============================================================
   SaaS mode — Supabase login + sync. Baked-in project creds.
   If a user logs in, data comes from Supabase (per-tenant).
   ============================================================ */
const SB_DEFAULT_URL='https://ncgehwgatdafxaydmhjc.supabase.co';
const SB_DEFAULT_KEY='sb_publishable_nmnrigdtL-QTwzl3ozsyWw_LlTVtUn-';
const SB={url:SB_DEFAULT_URL,key:SB_DEFAULT_KEY,token:'',refresh:'',uid:'',biz:'',email:''};
function sbLoad(){const c=JSON.parse(localStorage.getItem('sb_sess')||'{}');Object.assign(SB,c);if(!SB.url)SB.url=SB_DEFAULT_URL;if(!SB.key)SB.key=SB_DEFAULT_KEY;return SB;}
function sbStore(){localStorage.setItem('sb_sess',JSON.stringify({url:SB.url,key:SB.key,token:SB.token,refresh:SB.refresh,uid:SB.uid,biz:SB.biz,email:SB.email}));}
function sbLoggedIn(){sbLoad();return !!(SB.token&&SB.biz);}
function sbH(){return{'apikey':SB.key,'Authorization':'Bearer '+SB.token,'Content-Type':'application/json'};}

async function sbAuth(kind,email,password,bizName){
  sbLoad();
  const ep=kind==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  const body=kind==='signup'?{email,password,data:{business_name:bizName||'המחסן שלי'}}:{email,password};
  const r=await fetch(SB.url+ep,{method:'POST',headers:{'apikey':SB.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(!r.ok||j.error||j.code){throw new Error(j.error_description||j.msg||j.error||j.message||'שגיאת התחברות');}
  if(!j.access_token){throw new Error('נשלח אליך מייל אימות. אשר אותו ואז התחבר.');}
  SB.token=j.access_token;SB.refresh=j.refresh_token||'';SB.uid=(j.user&&j.user.id)||'';SB.email=email;
  await sbLoadBiz();
  sbStore();
  return true;
}
async function sbLoadBiz(){
  const r=await fetch(SB.url+'/rest/v1/memberships?select=business_id&limit=1',{headers:sbH()});
  const j=await r.json();
  if(Array.isArray(j)&&j.length){SB.biz=j[0].business_id;}
  else throw new Error('לא נמצא עסק למשתמש');
}
function sbLogout(){SB.token='';SB.refresh='';SB.uid='';SB.biz='';SB.email='';sbStore();location.reload();}
async function sbRefresh(){
  if(!SB.refresh)return false;
  try{
    const r=await fetch(SB.url+'/auth/v1/token?grant_type=refresh_token',
      {method:'POST',headers:{'apikey':SB.key,'Content-Type':'application/json'},
       body:JSON.stringify({refresh_token:SB.refresh})});
    const j=await r.json();
    if(!r.ok||!j.access_token)return false;
    SB.token=j.access_token;if(j.refresh_token)SB.refresh=j.refresh_token;
    sbStore();return true;
  }catch(e){return false;}
}
async function sbRest(method,path,body,extra,_retried){
  const r=await fetch(SB.url+'/rest/v1/'+path,{method,headers:Object.assign(sbH(),extra||{}),body:body?JSON.stringify(body):undefined});
  if((r.status===401||r.status===403)&&!_retried){
    if(await sbRefresh())return sbRest(method,path,body,extra,true);
    throw new Error('__RELOGIN__');
  }
  const txt=await r.text();
  if(!r.ok){
    let t=txt;
    try{const j=JSON.parse(txt);t=j.message||j.hint||j.error||txt;}catch(e){}
    throw new Error('('+r.status+') '+String(t).slice(0,140));
  }
  /* GET עם גוף ריק = רשימה ריקה, לא null (מונע כשל אצל הקורא).
     POST/DELETE עם return=minimal מחזירים ריק — שם null תקין. */
  if(!txt)return (method==='GET')?[]:null;
  try{return JSON.parse(txt);}catch(e){return (method==='GET')?[]:null;}
}
async function sbPull(){
  const bid=SB.biz;
  /* עותק בטיחות — אם המשיכה תיכשל באמצע, לא נשאר עם מצב חלקי */
  const _before=sbFingerprint();
  const _bk={entries:state.entries,shipments:state.shipments,labels:state.labels,
    settings:JSON.parse(JSON.stringify(state.settings||{})),
    tasks2:state.tasks2,board:state.board,supply:state.supply,routes:state.routes,
    boardCats:state.boardCats,supplyItems:state.supplyItems,grid:state.grid};
  try{
  const [invT,shipT,lblT,st]=await Promise.all([
    sbFetchTable('inventory'),sbFetchTable('shipments'),sbFetchTable('labels'),
    sbRest('GET','app_state?select=key,value&business_id=eq.'+bid)
  ]);
  _sbMap.inventory=invT.map;_sbMap.shipments=shipT.map;_sbMap.labels=lblT.map;
  const inv=invT.list.map(d=>({data:d})),ship=shipT.list.map(d=>({data:d})),lbl=lblT.list.map(d=>({data:d}));
  let cloudEmpty=false;
  if(inv&&inv.length)state.entries=inv.map(r=>r.data); else if(state.entries&&state.entries.length)cloudEmpty=true;
  if(ship&&ship.length)state.shipments=ship.map(r=>r.data); else if(!(state.shipments||[]).length)state.shipments=[];
  if(lbl&&lbl.length)state.labels=lbl.map(r=>r.data); else if(!(state.labels||[]).length)state.labels=[];
  if((!ship||!ship.length)&&(state.shipments||[]).length)cloudEmpty=true;
  if((!lbl||!lbl.length)&&(state.labels||[]).length)cloudEmpty=true;
  const kv={};(st||[]).forEach(r=>kv[r.key]=r.value);
  if(kv.__ver)_sbVer=kv.__ver;              /* מסתנכרנים עם גרסת הענן */
  if(kv.settings)Object.assign(state.settings,kv.settings);
  if(kv.tasks)state.tasks=kv.tasks;
  if(Array.isArray(kv.tasks2))state.tasks2=kv.tasks2;
  if(kv.board)state.board=kv.board;
  if(Array.isArray(kv.boardCats)&&kv.boardCats.length)state.boardCats=kv.boardCats;
  if(kv.grid)state.grid=kv.grid;
  if(kv.taskCats)state.taskCats=kv.taskCats;
  if(kv.weekLabels)state.weekLabels=kv.weekLabels;
  if(kv.dayCats)state.dayCats=kv.dayCats;
  if(kv.customCats){state.customCats=kv.customCats;loadCustomCats();}
  if(Array.isArray(kv.routes))state.routes=kv.routes;
  if(Array.isArray(kv.supply))state.supply=kv.supply;
  if(Array.isArray(kv.supplyItems)&&kv.supplyItems.length)state.supplyItems=kv.supplyItems;
  if(typeof sanitizeState==='function')sanitizeState();
  ensureRowIds();
  SB_TABLES.forEach(([t])=>sbCaptureRows(t));
  /* תמונת המצב נלקחת רק ממה שבאמת הגיע מהענן.
     מפתח שחסר בענן (למשל משימות בהתחברות ראשונה) חייב להישלח אליו. */
  try{
    sbStateKV().forEach(([k,v])=>{
      if(kv[k]!==undefined)_sbStateSnap[k]=JSON.stringify(v);
      else{
        delete _sbStateSnap[k];
        const hasLocal=Array.isArray(v)?v.length:(v&&typeof v==='object'?Object.keys(v).length:!!v);
        if(hasLocal)cloudEmpty=true;          /* יש מקומית ואין בענן → להעלות */
      }
    });
  }catch(e){}
  _sbSnap=sbSnapshot();
  localStorage.setItem(KEY,JSON.stringify(state));
  /* מרעננים את המסך הנוכחי רק אם התוכן באמת השתנה (ולא רק המספרים) */
  const _after=sbFingerprint();
  if(_before!==_after){refresh();applyBrand();}
  if(cloudEmpty){                       // בענן חסר מה שיש מקומית — מעלים במקום לאבד
    _sbSnap=null;_sbMap={};_sbRowSnap={};
    sbSyncMsg('מעלה נתונים מקומיים…');setTimeout(()=>sbPushChanged(true),300);
  }
  }catch(err){
    Object.keys(_bk).forEach(k=>{if(_bk[k]!==undefined)state[k]=_bk[k];});
    localStorage.setItem(KEY,JSON.stringify(state));
    throw err;
  }
}
function sbRows(arr){return arr.map(x=>({business_id:SB.biz,data:x}));}
function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}


/* ============ זיהוי שינוי מהיר ============
   במקום למשוך את כל הנתונים כל כמה שניות, נבדק מפתח גרסה אחד וזעיר.
   רק אם הוא השתנה — מתבצעת משיכה מלאה. */
function sbFingerprint(){
  try{
    return JSON.stringify(state.entries)+'|'+JSON.stringify(state.shipments)+'|'+
           JSON.stringify(state.labels)+'|'+JSON.stringify(state.tasks2||[])+'|'+
           JSON.stringify(state.board||{})+'|'+JSON.stringify(state.supply||[]);
  }catch(e){return String(Math.random());}
}
let _sbVer=null;                       /* הגרסה שאנחנו מכירים */
async function sbBumpVer(){
  if(!sbLoggedIn())return;
  _sbVer='v'+Date.now()+'-'+Math.floor(Math.random()*9999);
  try{await sbRest('POST','app_state',[{business_id:SB.biz,key:'__ver',value:_sbVer}],
    {'Prefer':'resolution=merge-duplicates,return=minimal'});}catch(e){}
}
async function sbCheckVer(){
  if(!sbLoggedIn()||_sbSyncing||document.hidden)return;
  try{
    const r=await sbRest('GET','app_state?select=key,value&key=eq.__ver&business_id=eq.'+SB.biz);
    const row=(r||[]).find(x=>x.key==='__ver');
    const v=row?row.value:null;
    if(v&&v!==_sbVer){_sbVer=v;await sbAutoSync(true);}       /* מישהו אחר שינה */
  }catch(e){}
}
/* ============ סנכרון רקע אוטומטי ============
   בלי זה, שינוי שבוצע במכשיר אחר (בעיקר מחיקה) מגיע רק בלחיצה ידנית על "משוך מהענן". */
let _sbLastSync=0,_sbSyncing=false;
async function sbAutoSync(force){
  if(!sbLoggedIn()||_sbSyncing)return;
  if(!force&&Date.now()-_sbLastSync<45000)return;      /* לא יותר מפעם ב-45 שניות */
  if(document.hidden)return;
  _sbSyncing=true;
  try{
    /* קודם דוחפים שינויים מקומיים, ואז מושכים — כדי לא לאבד עריכה שלא נשמרה */
    if(typeof sbPushChanged==='function')await sbPushChanged(true);
    await sbPull();
    _sbLastSync=Date.now();
    /* מיישרים את הגרסה המקומית עם הענן — אחרת נחשוב שוב ושוב שיש שינוי */
    try{
      const r=await sbRest('GET','app_state?select=key,value&key=eq.__ver&business_id=eq.'+SB.biz);
      const row=(r||[]).find(x=>x.key==='__ver');
      if(row&&row.value)_sbVer=row.value; else await sbBumpVer();
    }catch(e){}
  }catch(e){
    if(e&&e.message==='__RELOGIN__'){sbRenderLogin&&sbRenderLogin();sbShowLogin&&sbShowLogin();}
  }
  finally{_sbSyncing=false;}
}
/* בדיקה קלה כל 5 שניות (בקשה זעירה אחת), ומשיכה מלאה רק כשיש שינוי */
setInterval(()=>sbCheckVer(),5000);
/* חזרה למסך / החלפת לשונית → סנכרון */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sbAutoSync();});
window.addEventListener('focus',()=>sbAutoSync());
/* וגם כל 60 שניות בזמן שהאפליקציה פתוחה */
setInterval(()=>sbAutoSync(),60000);
