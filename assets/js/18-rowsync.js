/* ============ סנכרון ברמת שורה (במקום דריסת טבלה שלמה) ============ */
const SB_TABLES=[['inventory','entries'],['shipments','shipments'],['labels','labels']];
let _sbMap={},_sbRowSnap={};          // טבלה → מפתח → {rid,upd} / מפתח → JSON אחרון שסונכרן
function ensureRowIds(){
  let ch=false;
  (state.shipments||[]).forEach(s=>{if(!s._id){s._id=Date.now()+Math.floor(Math.random()*1e6);ch=true;}});
  (state.labels||[]).forEach(l=>{if(!l.id){l.id=Date.now()+Math.floor(Math.random()*1e6);ch=true;}});
  if(ch)localStorage.setItem(KEY,JSON.stringify(state));
}
function sbKey(table,o){
  if(!o)return '';
  if(table==='shipments')return String(o._id||'');
  return String(o.id||'');
}
function sbArr(table){return table==='inventory'?(state.entries||[]):table==='shipments'?(state.shipments||[]):(state.labels||[]);}
function sbSetArr(table,arr){
  if(table==='inventory')state.entries=arr;
  else if(table==='shipments')state.shipments=arr;
  else state.labels=arr;
}
async function sbFetchTable(table){
  /* order=id.asc חיוני: בלעדיו PostgreSQL מחזיר שורה שעודכנה בסוף,
     והלקוח שנערך היה קופץ לסוף רשימת ההפצה. */
  const rows=await sbRest('GET',table+'?select=id,data,updated_at&business_id=eq.'+SB.biz+'&order=id.asc');
  const map={},list=[];
  (rows||[]).forEach(r=>{
    const k=sbKey(table,r.data);
    if(!k)return;
    map[k]={rid:r.id,upd:r.updated_at};
    list.push(r.data);
  });
  return {map,list};
}
function sbRowSnapOf(table){return _sbRowSnap[table]||(_sbRowSnap[table]={});}
function sbCaptureRows(table){
  const snap={};sbArr(table).forEach(o=>{const k=sbKey(table,o);if(k)snap[k]=JSON.stringify(o);});
  _sbRowSnap[table]=snap;
}
/* מסנכרן טבלה אחת: שולח רק שורות שהשתנו, וממזג שינויים שהגיעו ממכשיר אחר */
async function sbSyncTable(table){
  ensureRowIds();
  const cur={},order=[];
  sbArr(table).forEach(o=>{const k=sbKey(table,o);if(k&&!cur[k]){cur[k]=o;order.push(k);}});
  const snap=sbRowSnapOf(table);
  const known=_sbMap[table]||{};

  const server=await sbFetchTable(table);
  const sMap=server.map;

  /* איתור שינויים שהגיעו ממכשיר אחר */
  let merged=false;const sData={};
  server.list.forEach(d=>{const k=sbKey(table,d);if(k)sData[k]=d;});
  Object.keys(sData).forEach(k=>{
    const localChanged = (cur[k]!==undefined) && (JSON.stringify(cur[k])!==(snap[k]||''));
    const localDeleted = (snap[k]!==undefined) && (cur[k]===undefined);
    const serverChanged = JSON.stringify(sData[k])!==(snap[k]||'');
    if(serverChanged && !localChanged && !localDeleted){   // רק הם שינו → לוקחים את שלהם
      if(cur[k]===undefined)order.push(k);
      cur[k]=sData[k];merged=true;
    }
  });
  /* שורה שנמחקה בענן — נמחקת גם מקומית, אלא אם ערכתי אותה מאז הסנכרון האחרון */
  Object.keys(snap).forEach(k=>{
    if(sData[k]!==undefined)return;                       // עדיין קיימת בענן
    if(cur[k]===undefined)return;                         // כבר לא אצלי
    const localChanged=JSON.stringify(cur[k])!==(snap[k]||'');
    if(!localChanged){                                    // לא נגעתי → מקבלים את המחיקה
      delete cur[k];
      const i=order.indexOf(k);if(i>=0)order.splice(i,1);
      merged=true;
    }
  });
  if(merged)sbSetArr(table,order.map(k=>cur[k]).filter(Boolean));

  /* חישוב הפעולות */
  const add=[],upd=[],del=[];
  order.forEach(k=>{
    const js=JSON.stringify(cur[k]);
    if(!sMap[k]){
      /* לא קיימת בענן — או חדשה אצלי, או שנמחקה שם ואני ערכתי אותה מאז */
      add.push(cur[k]);
    }
    else if(js!==(snap[k]||''))upd.push({k,o:cur[k],rid:sMap[k].rid});
  });
  Object.keys(snap).forEach(k=>{
    if(cur[k]===undefined){const r=sMap[k]||known[k];if(r&&r.rid)del.push(r.rid);}
  });

  /* ביצוע */
  const nowIso=new Date().toISOString();
  if(add.length>60||upd.length>60){                       // הרבה שינויים — כתיבה מרוכזת
    await sbReplace(table,sbArr(table));
  }else{
    for(const part of chunk(add.map(o=>({business_id:SB.biz,data:o,updated_at:nowIso})),200))
      if(part.length)await sbRest('POST',table,part,{'Prefer':'return=minimal'});
    for(const u of upd){
      if(u.rid)await sbRest('PATCH',table+'?id=eq.'+u.rid,{data:u.o,updated_at:nowIso},{'Prefer':'return=minimal'});
      else await sbRest('POST',table,[{business_id:SB.biz,data:u.o,updated_at:nowIso}],{'Prefer':'return=minimal'});
    }
    if(del.length)await sbRest('DELETE',table+'?business_id=eq.'+SB.biz+'&id=in.('+del.join(',')+')');
  }
  const after=await sbFetchTable(table);
  _sbMap[table]=after.map;
  sbCaptureRows(table);
  return {merged,add:add.length,upd:upd.length,del:del.length};
}

async function sbReplace(table,arr){
  // insert the new rows FIRST, then remove only the previously-existing ones,
  // so a failure can never leave the cloud empty
  let maxOld=0;
  try{
    const old=await sbRest('GET',table+'?select=id&business_id=eq.'+SB.biz+'&order=id.desc&limit=1');
    if(old&&old.length)maxOld=+old[0].id||0;
  }catch(e){}
  for(const part of chunk(sbRows(arr),400))if(part.length)await sbRest('POST',table,part,{'Prefer':'return=minimal'});
  if(maxOld){
    /* ניסיון חוזר — כשל במחיקה היה משאיר כפילויות בענן */
    let ok=false,err=null;
    for(let a=0;a<3&&!ok;a++){
      try{await sbRest('DELETE',table+'?business_id=eq.'+SB.biz+'&id=lte.'+maxOld);ok=true;}
      catch(e){err=e;await new Promise(r=>setTimeout(r,400*(a+1)));}
    }
    if(!ok){sbSyncMsg('אזהרה: ייתכנו כפילויות — לחץ לסנכרון חוזר');throw err||new Error('מחיקה נכשלה');}
  }
}
function sbStateKV(){return[
  ['settings',{title:state.settings.title,sub:state.settings.sub,labelTpl:state.settings.labelTpl,boxRules:state.settings.boxRules,catUnits:state.settings.catUnits,catPal:state.settings.catPal,capNums:state.settings.capNums,capColorMap:state.settings.capColorMap,capCatMap:state.settings.capCatMap,capColors:state.settings.capColors,catPalette:state.settings.catPalette,catColorMap:state.settings.catColorMap,barcodes:state.settings.barcodes}],
  ['tasks',state.tasks],['tasks2',state.tasks2||[]],['board',state.board||{}],['boardCats',state.boardCats||[]],['grid',state.grid],['taskCats',state.taskCats],
  ['weekLabels',state.weekLabels],['dayCats',state.dayCats||{}],['customCats',state.customCats||[]],['routes',state.routes||[]],['supply',state.supply||[]],['supplyItems',state.supplyItems||[]]];}
let _sbStateSnap={};                       // מה שנשלח בפעם האחרונה, לכל מפתח
/* ממזג רשימת משימות: לפי מזהה, המאוחר מנצח; פריט חדש בצד השני מתווסף */
function mergeTasks(mine,theirs,lastSyncedJson){
  const last={};(JSON.parse(lastSyncedJson||'[]')||[]).forEach(t=>last[t.id]=JSON.stringify(t));
  const out={},order=[];
  (theirs||[]).forEach(t=>{if(!out[t.id]){out[t.id]=t;order.push(t.id);}});
  (mine||[]).forEach(t=>{
    const js=JSON.stringify(t),iChanged=js!==(last[t.id]||'');
    if(!out[t.id]){out[t.id]=t;order.push(t.id);return;}          // חדש אצלי
    const theirJs=JSON.stringify(out[t.id]),theyChanged=theirJs!==(last[t.id]||'');
    if(iChanged&&!theyChanged)out[t.id]=t;                        // רק אני שיניתי
    else if(iChanged&&theyChanged){                               // שנינו — המאוחר מנצח
      const ts=x=>{const a=x&&x.updatedAt?Date.parse(x.updatedAt):NaN;
        if(isFinite(a))return a;
        const l=x&&x.log&&x.log.length?Date.parse(x.log[x.log.length-1].t):NaN;
        return isFinite(l)?l:0;};
      if(ts(t)>=ts(out[t.id]))out[t.id]=t;
    }
  });
  /* פריט שהיה בסנכרון הקודם, נמחק אצלי ולא שונה אצלם — נמחק */
  Object.keys(last).forEach(id=>{
    const mineHas=(mine||[]).some(t=>String(t.id)===String(id));
    if(!mineHas&&out[id]&&JSON.stringify(out[id])===last[id]){delete out[id];}
  });
  return order.map(id=>out[id]).filter(Boolean);
}
/* ממזג את לוח כוח האדם: תא ריק לא דורס תא מלא */
function mergeBoard(mine,theirs,lastJson){
  const last=JSON.parse(lastJson||'{}')||{},out=JSON.parse(JSON.stringify(theirs||{}));
  const blank=v=>v===undefined||v===null||String(v).trim()==='';   /* ריק = גם רווחים */
  Object.keys(mine||{}).forEach(day=>{
    out[day]=out[day]||{};
    Object.keys(mine[day]).forEach(cat=>{
      const mineV=mine[day][cat],lastV=(last[day]||{})[cat],theirV=out[day][cat];
      const norm=v=>String(v==null?'':v).trim();
      const iChanged=norm(mineV)!==norm(lastV);
      const theyChanged=norm(theirV)!==norm(lastV);
      if(iChanged&&theyChanged){
        /* שנינו שינינו — תוכן תמיד גובר על מחיקה */
        if(blank(mineV)&&!blank(theirV))return;                    /* שלהם תוכן, שלי ריק → שלהם */
        out[day][cat]=mineV;
        if(blank(mineV))delete out[day][cat];
      } else if(iChanged){
        if(blank(mineV))delete out[day][cat]; else out[day][cat]=mineV;
      } else if(blank(theirV)&&!blank(mineV)){
        out[day][cat]=mineV;                                       /* אצלם אין → שלי */
      }
    });
    if(out[day]&&!Object.keys(out[day]).length)delete out[day];
  });
  Object.keys(last).forEach(day=>{                                 // מחיקות שלי
    Object.keys(last[day]||{}).forEach(cat=>{
      const mineHas=(mine[day]||{})[cat]!==undefined;
      if(!mineHas&&out[day]&&out[day][cat]===last[day][cat])delete out[day][cat];
    });
    if(out[day]&&!Object.keys(out[day]).length)delete out[day];
  });
  return out;
}
async function sbPushState(){
  /* קורא את מצב הענן, ממזג רק את מה שהשתנה, ושולח רק מפתחות שהשתנו */
  let srv={};
  try{
    const rows=await sbRest('GET','app_state?select=key,value&business_id=eq.'+SB.biz);
    (rows||[]).forEach(r=>srv[r.key]=r.value);
  }catch(e){}
  let mergedTasks=false;
  if(srv.tasks2!==undefined){
    const before=JSON.stringify(state.tasks2||[]);
    state.tasks2=mergeTasks(state.tasks2||[],srv.tasks2||[],_sbStateSnap.tasks2);
    if(JSON.stringify(state.tasks2)!==before)mergedTasks=true;
  }
  if(srv.board!==undefined){
    const before=JSON.stringify(state.board||{});
    state.board=mergeBoard(state.board||{},srv.board||{},_sbStateSnap.board);
    if(JSON.stringify(state.board)!==before)mergedTasks=true;
  }
  if(mergedTasks){localStorage.setItem(KEY,JSON.stringify(state));
    if(typeof renderTasks==='function'&&document.getElementById('v-tasks'))try{renderTasks();}catch(e){}
    toast('אוחדו משימות ממכשיר אחר');}
  const kv=sbStateKV().filter(([k,v])=>JSON.stringify(v)!==(_sbStateSnap[k]||'\u0000'));
  if(kv.length){
    await sbRest('POST','app_state',kv.map(([key,value])=>({business_id:SB.biz,key,value})),
      {'Prefer':'resolution=merge-duplicates,return=minimal'});
  }
  sbStateKV().forEach(([k,v])=>{_sbStateSnap[k]=JSON.stringify(v);});
}
function sbSnapshot(){return{inv:JSON.stringify(state.entries),ship:JSON.stringify(state.shipments),lbl:JSON.stringify(state.labels),st:JSON.stringify(sbStateKV())};}
let _sbSnap=null,_sbTimer=null,_sbBusy=false,_sbQueued=false;
async function sbPushChanged(silent){
  if(!sbLoggedIn())return;
  if(_sbBusy){_sbQueued=true;return;}
  _sbBusy=true;sbSyncMsg('מסנכרן…');
  try{
    const now=sbSnapshot(),was=_sbSnap||{};
    let mergedAny=false,ops=0;
    if(now.inv!==was.inv){const r=await sbSyncTable('inventory');mergedAny=mergedAny||r.merged;ops+=r.add+r.upd+r.del;}
    if(now.ship!==was.ship){const r=await sbSyncTable('shipments');mergedAny=mergedAny||r.merged;ops+=r.add+r.upd+r.del;}
    if(now.lbl!==was.lbl){const r=await sbSyncTable('labels');mergedAny=mergedAny||r.merged;ops+=r.add+r.upd+r.del;}
    if(now.st!==was.st)await sbPushState();
    if(mergedAny){                                   // הגיעו שינויים ממכשיר אחר — מוזגו
      localStorage.setItem(KEY,JSON.stringify(state));refresh();
      toast('אוחדו שינויים ממכשיר אחר');
    }
    _sbSnap=sbSnapshot();
    if(ops||mergedAny||now.st!==was.st){try{await sbBumpVer();}catch(e){}}   /* מסמן לשאר המכשירים */
    sbSyncMsg('מסונכרן ✓ '+new Date().toLocaleTimeString('he-IL')+(ops?' ('+ops+' שורות)':''));
    if(!silent)toast('נשמר בענן ✓');
  }catch(e){
    if(e.message==='__RELOGIN__'){sbSyncMsg('נדרשת כניסה מחדש');toast('פג תוקף ההתחברות — התחבר מחדש');sbRenderLogin();sbShowLogin();}
    else{sbSyncMsg('שגיאת ענן');toast('שמירה נכשלה: '+e.message);}
  }
  finally{_sbBusy=false;if(_sbQueued){_sbQueued=false;setTimeout(()=>sbPushChanged(true),200);}}
}
function sbAutoPush(){if(!sbLoggedIn())return;clearTimeout(_sbTimer);_sbTimer=setTimeout(()=>sbPushChanged(true),1500);}
function sbSyncMsg(m){const e=document.getElementById('syncStatus');if(e){e.style.display='inline-block';e.textContent=m;e.style.cursor='pointer';e.title='לחץ כדי לנסות לסנכרן שוב';e.onclick=function(){sbPushChanged();};}}

/* ---------- login UI ---------- */
function sbShowLogin(){document.getElementById('loginov').style.display='flex';document.body.classList.add('login-lock');}
function sbHideLogin(){document.getElementById('loginov').style.display='none';document.body.classList.remove('login-lock');}
let _sbMode='login';
function sbToggleMode(){_sbMode=_sbMode==='login'?'signup':'login';sbRenderLogin();}
function sbRenderLogin(){
  const signup=_sbMode==='signup';
  document.getElementById('lg_title').textContent=signup?'הרשמה — עסק חדש':'כניסה';
  document.getElementById('lg_bizwrap').style.display=signup?'block':'none';
  document.getElementById('lg_submit').textContent=signup?'צור חשבון':'כניסה';
  document.getElementById('lg_toggle').textContent=signup?'כבר יש לי חשבון — כניסה':'אין לי חשבון — הרשמה';
  document.getElementById('lg_msg').textContent='';
}
async function sbSubmitLogin(){
  const email=(document.getElementById('lg_email').value||'').trim();
  const pw=document.getElementById('lg_pw').value||'';
  const biz=(document.getElementById('lg_biz').value||'').trim();
  const msg=document.getElementById('lg_msg');
  if(!email||!pw){msg.textContent='מלא אימייל וסיסמה';return;}
  if(pw.length<6){msg.textContent='הסיסמה חייבת 6 תווים לפחות';return;}
  msg.textContent='מתחבר…';
  const btn=document.getElementById('lg_submit');btn.disabled=true;
  try{
    await sbAuth(_sbMode,email,pw,biz);
    msg.textContent='טוען נתונים…';
    await sbPull();
    sbHideLogin();
    document.getElementById('logoutBtn').style.display='inline-block';
    sbMaybeDailyBackup();sbLoadPlan();
    toast('שלום '+email);
  }catch(e){msg.textContent=e.message;}
  finally{btn.disabled=false;}
}

