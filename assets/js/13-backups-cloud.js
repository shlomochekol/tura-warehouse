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
  }catch(e){if(!silent)toast('הגיבוי נכשל: '+sbFriendlyError(e));return false;}
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
    else h+='<div class="bklist">'+rows.map(r=>{
      const others=rows.filter(x=>x.id!==r.id);
      const opts='<option value="current">המצב הנוכחי</option>'+
        others.map(o=>`<option value="${o.id}">גיבוי ${esc(new Date(o.created_at).toLocaleString('he-IL'))}</option>`).join('');
      return `<div class="bkrow"><span>${new Date(r.created_at).toLocaleString('he-IL')}</span>
      <span>השווה מול <select id="cmpto_${r.id}" class="mini">${opts}</select>
      <button class="btn sm ghost" onclick="sbCompareBackup(${r.id},document.getElementById('cmpto_${r.id}').value)">השווה</button>
      <button class="btn sm" onclick="sbDoRestore(${r.id})">שחזר</button></span></div>`;
    }).join('')+'</div>';
    h+='<div class="actions"><button class="btn ghost" onclick="sbBackupNow()">גבה עכשיו</button><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
    box.innerHTML=h;
  }catch(e){
    box.innerHTML='<h3>שחזור נתונים</h3><div class="hint">שגיאה: '+sbFriendlyError(e)+'</div><div class="actions"><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
  }
}
/* השוואה בלבד — לא משנה כלום. עוזר לאתר בדיוק אילו פריטים איבדו מיקום/כמות
   נכונים בלי לנחש ובלי לסכן שחזור מיותר (למשל אחרי אירוע סנכרון בעייתי).
   toId: 'current' (ברירת מחדל) להשוואה מול המצב החי, או מזהה גיבוי אחר —
   שימושי כשאין גיבוי "נקי" מיד לפני התקרית ורוצים להשוות שני גיבויים
   רצופים ולמצוא פריט ש"קפץ וחזר" (חתימת הבאג, בניגוד לשיבוץ ידני רגיל). */
async function sbCompareBackup(id,toId){
  toId=(toId===undefined||toId===null||toId==='')?'current':toId;
  const box=document.getElementById('modalbox');box.className='box';
  box.innerHTML='<h3>השוואה</h3><div class="hint">טוען…</div>';
  document.getElementById('modal').classList.add('open');
  try{
    const ids=(toId==='current')?[id]:[id,+toId];
    const rows=await sbRest('GET','backups?select=id,snapshot,created_at&id=in.('+ids.join(',')+')');
    const byId={};(rows||[]).forEach(r=>byId[r.id]=r);
    const fromRow=byId[id];
    if(!fromRow)throw new Error('הגיבוי לא נמצא');
    const fromByid={};((fromRow.snapshot||{}).entries||[]).forEach(e=>{if(e&&e.id!=null)fromByid[e.id]=e;});
    let toEntries,toLabel;
    if(toId==='current'){toEntries=state.entries||[];toLabel='המצב הנוכחי';}
    else{
      const toRow=byId[+toId];
      if(!toRow)throw new Error('הגיבוי השני לא נמצא');
      toEntries=(toRow.snapshot||{}).entries||[];
      toLabel='גיבוי מ-'+new Date(toRow.created_at).toLocaleString('he-IL');
    }
    const label=e=>[e.category,e.vintage,e.type].filter(Boolean).join(' ');
    const locStr=x=>(+x.prow>0)?(x.prow+'-'+x.pcol+(x.plevel?(' · רמה '+x.plevel):'')):'—';
    const diffs=[];
    (toEntries||[]).forEach(e=>{
      const o=fromByid[e.id];
      if(!o)return;                     // פריט חדש מאז ה"מ" — לא רלוונטי להשוואה
      const locChanged=(+o.prow||0)!==(+e.prow||0)||(+o.pcol||0)!==(+e.pcol||0)||(+o.plevel||0)!==(+e.plevel||0);
      const unitsChanged=(+o.units||0)!==(+e.units||0);
      if(locChanged||unitsChanged)diffs.push({e,o,locChanged,unitsChanged});
    });
    let h='<h3>השוואה</h3><div class="hint" style="margin:0 0 8px">'+
      esc('גיבוי '+new Date(fromRow.created_at).toLocaleString('he-IL'))+' ⟵⟶ '+esc(toLabel)+'</div>';
    h+='<div class="hint" style="margin:0 0 8px">משווה מיקום ויחידות. לא משנה כלום.</div>';
    if(!diffs.length)h+='<div class="hint" style="padding:14px;text-align:center">אין הבדלים במיקום או ביחידות בין השתיים.</div>';
    else{
      h+='<div class="tablewrap" style="max-height:340px"><table><thead><tr><th>פריט</th><th>ב-'+esc(new Date(fromRow.created_at).toLocaleTimeString('he-IL'))+'</th><th>ב-'+esc(toLabel)+'</th></tr></thead><tbody>'+
        diffs.map(d=>'<tr><td>'+esc(label(d.e))+'</td><td>'+
          (d.locChanged?('מיקום '+esc(locStr(d.o))+'<br>'):'')+
          (d.unitsChanged?(Math.round(+d.o.units||0)+' יח׳'):'')+'</td><td>'+
          (d.locChanged?('מיקום '+esc(locStr(d.e))+'<br>'):'')+
          (d.unitsChanged?(Math.round(+d.e.units||0)+' יח׳'):'')+'</td></tr>').join('')+
        '</tbody></table></div><div class="hint" style="margin-top:6px">'+diffs.length+' פריטים שונים.</div>';
    }
    h+='<div class="actions"><button class="btn ghost" onclick="sbOpenRestore()">⬅ חזרה לרשימה</button><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
    box.innerHTML=h;
  }catch(e){
    box.innerHTML='<h3>השוואה לגיבוי</h3><div class="hint">שגיאה: '+sbFriendlyError(e)+'</div><div class="actions"><button class="btn ghost" onclick="closeModal()">סגור</button></div>';
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
  }catch(e){toast('השחזור נכשל: '+sbFriendlyError(e));}
}


/* שמות ציבוריים (בעבר נותבו דרך מערכת הסנכרון הישנה) */
function backupNow(silent){return sbBackupNow(silent);}
function maybeDailyBackup(){return sbMaybeDailyBackup();}
function openRestore(){return sbOpenRestore();}
function doRestore(id){return sbDoRestore(id);}
