/* ============ גיבויים ב-Supabase (10 אחרונים) ============ */
const SB_MAX_BACKUPS=10;
function sbSnapshotObj(){
  const st={};sbStateKV().forEach(([k,v])=>{st[k]=v;});
  return {v:1,at:new Date().toISOString(),entries:state.entries,shipments:state.shipments,labels:state.labels,state:st};
}
async function sbBackupNow(silent){
  if(!sbLoggedIn())return false;
  try{
    await sbRest('POST','backups',[{business_id:SB.biz,snapshot:sbSnapshotObj()}],{'Prefer':'return=minimal'});
    const rows=await sbRest('GET','backups?select=id&business_id=eq.'+SB.biz+'&order=id.desc');
    if(Array.isArray(rows)&&rows.length>SB_MAX_BACKUPS){
      const old=rows.slice(SB_MAX_BACKUPS).map(r=>r.id);
      await sbRest('DELETE','backups?business_id=eq.'+SB.biz+'&id=in.('+old.join(',')+')');
    }
    localStorage.setItem('sb_lastbk',new Date().toISOString());
    if(!silent)toast('גיבוי נשמר בענן ✓');
    return true;
  }catch(e){if(!silent)toast('הגיבוי נכשל: '+e.message);return false;}
}
function sbMaybeDailyBackup(){
  if(!sbLoggedIn())return;
  const last=localStorage.getItem('sb_lastbk');
  const t=last?new Date(last).getTime():0;
  if(Date.now()-t>20*60*60*1000)setTimeout(()=>sbBackupNow(true),4000);
}
async function sbOpenRestore(){
  const box=document.getElementById('modalbox');box.className='box';
  box.innerHTML='<h3>שחזור נתונים</h3><div class="hint">טוען גרסאות…</div>';
  document.getElementById('modal').classList.add('open');
  try{
    const rows=await sbRest('GET','backups?select=id,created_at&business_id=eq.'+SB.biz+'&order=id.desc&limit='+SB_MAX_BACKUPS);
    let h='<h3>שחזור נתונים</h3><div class="hint">'+SB_MAX_BACKUPS+' הגרסאות האחרונות שנשמרו בענן. שחזור יחליף את הנתונים הנוכחיים בכל המכשירים.</div>';
    if(!rows||!rows.length)h+='<div class="hint" style="margin-top:8px">אין עדיין גיבויים. לחץ "גבה עכשיו".</div>';
    else h+='<div class="bklist">'+rows.map(r=>`<div class="bkrow"><span>${new Date(r.created_at).toLocaleString('he-IL')}</span>
      <button class="btn sm" onclick="sbDoRestore(${r.id})">שחזר</button></div>`).join('')+'</div>';
    h+='<div class="actions"><button class="btn ghost" onclick="sbBackupNow()">גבה עכשיו</button><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
    box.innerHTML=h;
  }catch(e){
    box.innerHTML='<h3>שחזור נתונים</h3><div class="hint">שגיאה: '+e.message+'</div><div class="actions"><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
  }
}
async function sbDoRestore(id){
  if(!confirm('לשחזר את הגרסה הזו? הנתונים הנוכחיים יוחלפו.'))return;
  if(!confirm('אישור אחרון — לשחזר?'))return;
  try{
    await sbBackupNow(true);                       // גיבוי בטיחות לפני שחזור
    const rows=await sbRest('GET','backups?select=snapshot&id=eq.'+id);
    const sn=rows&&rows[0]&&rows[0].snapshot;
    if(!sn)throw new Error('הגיבוי לא נמצא');
    if(Array.isArray(sn.entries))state.entries=sn.entries;
    if(Array.isArray(sn.shipments))state.shipments=sn.shipments;
    if(Array.isArray(sn.labels))state.labels=sn.labels;
    const st=sn.state||{};
    if(st.settings)Object.assign(state.settings,st.settings);
    if(st.tasks)state.tasks=st.tasks;
    if(Array.isArray(st.tasks2))state.tasks2=st.tasks2;
    if(st.board)state.board=st.board;
    if(Array.isArray(st.boardCats)&&st.boardCats.length)state.boardCats=st.boardCats;
    if(st.grid)state.grid=st.grid;
    if(Array.isArray(st.taskCats))state.taskCats=st.taskCats;
    if(st.weekLabels)state.weekLabels=st.weekLabels;
    if(st.dayCats)state.dayCats=st.dayCats;
    if(Array.isArray(st.customCats)){state.customCats=st.customCats;loadCustomCats();}
    localStorage.setItem(KEY,JSON.stringify(state));
    _sbSnap=null;_sbMap={};_sbRowSnap={};           // כפה העלאה מלאה של המצב המשוחזר
    closeModal();applyBrand();refresh();
    await sbPushChanged(true);
    toast('הנתונים שוחזרו ✓');
  }catch(e){toast('השחזור נכשל: '+e.message);}
}


/* שמות ציבוריים (בעבר נותבו דרך מערכת הסנכרון הישנה) */
function backupNow(silent){return sbBackupNow(silent);}
function maybeDailyBackup(){return sbMaybeDailyBackup();}
function openRestore(){return sbOpenRestore();}
function doRestore(id){return sbDoRestore(id);}
