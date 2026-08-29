/* ============ settings / modal / io ============ */
function openSettings(){
  const s=state.settings;const box=document.getElementById('modalbox');box.className='box';
  const online=(typeof sbLoggedIn==='function'&&sbLoggedIn());
  box.innerHTML=`<h3>הגדרות</h3>
   <div class="field"><label>שם האפליקציה / היקב</label><input id="set_title" value="${esc(s.title)}"></div>
   <div class="field"><label>כותרת משנה</label><input id="set_sub" value="${esc(s.sub)}"></div>
   <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
   <div class="field"><label>☁︎ ענן</label>
     <div class="hint" style="margin:0 0 6px">${online?('מחובר כ־'+(SB.email||'')+'. הנתונים נשמרים אוטומטית ומסונכרנים לכל המכשירים.'):'לא מחובר — הנתונים נשמרים במכשיר זה בלבד.'}</div>
     ${online?`<div class="actions"><button class="btn sm" onclick="sbPushChanged()">⬆ שמור עכשיו</button>
       <button class="btn sm" onclick="sbPull()">⬇ משוך מהענן</button></div>`:''}
   </div>
   <div class="field"><label>גיבוי לקובץ</label>
     <button class="btn ghost" onclick="exportJSON()">ייצוא גיבוי (JSON)</button>
     <button class="btn ghost" onclick="document.getElementById('imp').click()">ייבוא גיבוי</button></div>
   <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
   <details class="adv"><summary>⚙ הגדרות מתקדמות</summary>
     <div class="field" style="margin-top:10px"><label>כמויות וצבעים</label>
       <div class="hint" style="margin:0 0 6px">⚠️ שינוי כאן משפיע על חישוב הארגזים והמשטחים בכל המסכים. לשנות רק לאחר אימות מול המציאות.</div>
       <button class="btn ghost" onclick="closeModal();openCatUnits()">📦 כמויות לפי קטגוריה</button>
       <button class="btn ghost" onclick="closeModal();openCapSettings()">🎨 קפסולות וצבעים</button></div>
     <div class="field"><label>שחזור נתונים</label>
       <div class="hint" style="margin:0 0 6px">10 הגרסאות האחרונות שנשמרו בענן.</div>
       <button class="btn ghost" onclick="openRestore()">🕘 שחזור גרסה קודמת</button>
       <button class="btn ghost" onclick="backupNow()">גבה עכשיו</button></div>
     <div class="field"><label>בדיקת תקינות</label>
       <div class="hint" style="margin:0 0 6px">בודק שכל חלקי המערכת עובדים ושאין בעיות בנתונים. כדאי להריץ אחרי כל עדכון גרסה.</div>
       <button class="btn ghost" onclick="openDiagnostics()">🩺 הרץ בדיקה</button></div>
     <div class="field"><label>איפוס מיקומים במפה</label>
       <div class="hint" style="margin:0 0 6px">מנקה את השיבוץ (שורה/עמודה/מפלס) כדי לשבץ מחדש מאפס. <b>המלאי עצמו נשמר</b> — יחידות, קטגוריות והכול.</div>
       <button class="btn ghost" onclick="openResetSpots()">🗺️ איפוס מיקומים</button></div>
     <div class="field"><label>מסוכן</label><button class="btn warn" onclick="resetData()">איפוס לנתוני התחלה</button></div>
   </details>
   <div class="actions"><button class="btn" onclick="(function(){const _t=document.getElementById('set_title'),_s=document.getElementById('set_sub');if(_t)state.settings.title=_t.value||'יקב טורא';if(_s)state.settings.sub=_s.value||'';save();applyBrand();closeModal();toast('נשמר');})()">שמירה</button><button class="btn ghost" onclick="closeModal()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
}

/* ============ איפוס שיבוץ המיקומים במפה ============ */
let _rsType='',_rsCat='';
function spotsPlaced(f){
  return (state.entries||[]).filter(e=>(+e.prow>0&&+e.pcol>0)
    &&(!f||!f.type||e.type===f.type)&&(!f||!f.cat||e.category===f.cat));
}
function openResetSpots(){
  const box=document.getElementById('modalbox');box.className='box';
  const types=distinct(state.entries||[],e=>e.type);
  const cats=distinct(state.entries||[],e=>e.category);
  const sel=spotsPlaced({type:_rsType,cat:_rsCat});
  const total=spotsPlaced().length;
  box.innerHTML=`<h3>איפוס מיקומים במפה</h3>
   <div class="hint">מנקה את השורה/עמודה/מפלס של הפריטים שנבחרו, כדי שתוכל לשבץ אותם מחדש. <b>שום פריט לא נמחק</b> — היחידות, הקטגוריות וכל שאר הנתונים נשארים.</div>
   <div class="tk-row3" style="margin-top:10px">
     <div class="fld"><label>סוג</label><select onchange="_rsType=this.value;openResetSpots()">
       <option value="">כל הסוגים</option>${types.map(t=>`<option ${_rsType===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
     <div class="fld"><label>קטגוריה</label><select onchange="_rsCat=this.value;openResetSpots()">
       <option value="">כל הקטגוריות</option>${cats.map(c=>`<option ${_rsCat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
     <div class="fld"><label>&nbsp;</label>${(_rsType||_rsCat)?`<button class="btn ghost sm" onclick="_rsType='';_rsCat='';openResetSpots()">נקה סינון</button>`:''}</div>
   </div>
   <div class="kpis k2" style="margin:10px 0">
     ${kpi('ייבחרו לאיפוס',sel.length,'', sel.length?'var(--warn)':'var(--muted)')}
     ${kpi('משובצים במפה כרגע',total,'','var(--navy)')}</div>
   ${sel.length?`<div class="tablewrap" style="max-height:200px"><table><thead><tr><th>קטגוריה</th><th>בציר</th><th>סוג</th><th>מיקום</th><th>יחידות</th></tr></thead><tbody>
     ${sel.slice(0,60).map(e=>`<tr><td>${esc(e.category||'')}</td><td>${esc(e.vintage||'')}</td><td>${esc(e.type||'')}</td>
       <td>${e.prow}-${e.pcol} · ${LEVELNAME[e.plevel]||''}</td><td>${Math.round(+e.units||0).toLocaleString()}</td></tr>`).join('')}
     ${sel.length>60?`<tr><td colspan=5 style="color:var(--muted)">…ועוד ${sel.length-60}</td></tr>`:''}
     </tbody></table></div>`:`<div class="hint">אין פריטים משובצים בבחירה הזו.</div>`}
   <div class="actions">
     ${sel.length?`<button class="btn warn" onclick="doResetSpots()">🗺️ אפס ${sel.length} מיקומים</button>`:''}
     <button class="btn ghost" onclick="closeModal()">ביטול</button></div>`;
  document.getElementById('modal').classList.add('open');
}
async function doResetSpots(){
  const sel=spotsPlaced({type:_rsType,cat:_rsCat});
  if(!sel.length)return;
  const what=(_rsType||_rsCat)?('הפריטים שנבחרו ('+sel.length+')'):('כל '+sel.length+' המיקומים');
  if(!confirm('לאפס את השיבוץ של '+what+' במפה?\n\nהמלאי עצמו יישמר — רק המיקום יתרוקן.'))return;
  if(!confirm('אישור אחרון — לאפס?'))return;
  try{ if(typeof sbLoggedIn==='function'&&sbLoggedIn()){toast('יוצר גיבוי…');await sbBackupNow(true);} }catch(e){}
  const ids={};sel.forEach(e=>ids[e.id]=1);
  let n=0;
  (state.entries||[]).forEach(e=>{if(ids[e.id]){e.prow=0;e.pcol=0;e.plevel=0;n++;}});
  save();closeModal();refresh();
  toast('אופסו '+n+' מיקומים — אפשר לשבץ מחדש');
}
function modalForm(title,fields,onsave,preset){
  const box=document.getElementById('modalbox');
  box.innerHTML=`<h3>${esc(title)}</h3>`+fields.map(([f,lab,t,opts])=>{
    if(t==='select')return`<div class="field"><label>${esc(lab)}</label><select id="mf_${f}">${opts.map(o=>`<option ${preset===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    const val=(typeof opts==='string')?opts:'';
    return`<div class="field"><label>${esc(lab)}</label><input id="mf_${f}" type="${t==='number'?'number':'text'}" value="${esc(val)}"></div>`;}).join('')
   +`<div class="actions"><button class="btn" id="mf_ok">שמירה</button><button class="btn ghost" onclick="closeModal()">ביטול</button></div>`;
  document.getElementById('modal').classList.add('open');
  document.getElementById('mf_ok').onclick=()=>{const v={};fields.forEach(([f])=>v[f]=document.getElementById('mf_'+f).value);closeModal();onsave(v);};
}
function closeModal(){document.getElementById('modal').classList.remove('open');}
document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal();};
/* full backup */
function exportJSON(){dl(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),(state.settings.title||'warehouse')+'-גיבוי.json');toast('יוצא גיבוי');}
function importJSON(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const s=JSON.parse(r.result);if(s.entries){state=Object.assign(defaults(),s);if(typeof seedCatDefaults==='function')seedCatDefaults();save();applyBrand();closeModal();activate(curTab);refresh();toast('הנתונים יובאו — כל המסכים עודכנו');}else alert('קובץ לא תקין');}catch(e){alert('שגיאה בקריאה');}};r.readAsText(f);ev.target.value='';}
/* per-screen CSV */
function csvFrom(rows){return '\uFEFF'+rows.map(r=>r.map(c=>`"${(''+(c??'')).replace(/"/g,'""')}"`).join(',')).join('\n');}
function exportScreenCSV(which){
  let rows,name;
  if(which==='loc'||which==='inv'){name=which==='loc'?'מיקום-במחסן':'מלאי-מחסן';
    rows=[['קטגוריה','בציר','סוג','מבושל/לא מבושל','תיוות','קפסולה','יחידות','ארגזים','משטחים','שורה','עמודה','מפלס','ברקוד','הערות']];
    const src=(which==='loc'&&typeof locVisible==='function')?locVisible()
             :(which==='inv'&&typeof invVisible==='function')?invVisible()
             :state.entries;
    src.forEach(e=>{const d=derive(e);rows.push([e.category,e.vintage,e.type,e.cooked,e.label,capDisp(e)[0],e.units,d.boxes.toFixed(1),d.pallets.toFixed(2),e.prow,e.pcol,LEVELNAME[e.plevel]||'',barcodeOf(e),e.notes||'']);});
  } else if(which==='ship'){name='משלוחים';rows=[SHCOLS.map(c=>c[1])];
    const shSrc=(typeof shipVisible==='function')?shipVisible():state.shipments;
    shSrc.forEach(s=>{const b=bpb(s.category,s.label||'מתוות');const bx=(+s.units||0)/b;rows.push(SHCOLS.map(c=>{const f=c[0];if(f==='boxes')return bx.toFixed(1);if(f==='pallets')return (bx/bpp(s.category)).toFixed(2);if(f==='capsule')return capOf(s.category)[0];return s[f]??'';}));});}
  dl(new Blob([csvFrom(rows)],{type:'text/csv'}),name+'.csv');toast('יוצא ל-Excel');
}
/* per-screen image */
function exportScreenImg(viewId,name){
  const el=document.getElementById(viewId);
  toast('מכין תמונה…');
  const run=()=>html2canvas(el,{backgroundColor:'#F7F3EC',scale:2}).then(cv=>{cv.toBlob(b=>{dl(b,name+'.png');toast('התמונה יוצאה');});}).catch(()=>toast('שגיאה בייצוא תמונה'));
  needLib('html2canvas').then(run).catch(()=>toast('טעינת רכיב הייצוא נכשלה'));
}
function dl(b,n){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();}
function resetData(){if(!confirm('לאפס לנתוני ההתחלה? כל השינויים יימחקו.'))return;if(!confirm('אזהרה אחרונה — הפעולה בלתי הפיכה. להמשיך באיפוס?'))return;localStorage.removeItem(KEY);state=defaults();if(typeof seedCatDefaults==='function'){delete state.settings.catSeed2;seedCatDefaults();}applyBrand();closeModal();activate(0);toast('הנתונים אופסו');}

