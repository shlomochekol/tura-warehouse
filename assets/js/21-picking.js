/* ============ דף ליקוט + היסטוריית מסלולים ============ */
/* מזהה את קטגוריית WINECATS של שם מוצר חופשי — קודם ניסיון ישיר, ואם לא
   הצליח מנסה שוב אחרי canonicalizeCategoryText (16-lionwheel.js) כדי
   שתוויות ישנות שיובאו לפני התיקון (איות שגוי/שם אנגלי) עדיין ימצאו
   מיקום במחסן ויתמזגו נכון בדף הליקוט, לא רק ייבוא חדש. */
function pickCategoryOf(n){
  n=String(n||'');
  let cat=null;
  (WINECATS||[]).forEach(c=>{if(!cat&&n.indexOf(c)>=0)cat=c;});
  if(!cat&&typeof canonicalizeCategoryText==='function'){
    const fixed=canonicalizeCategoryText(n);
    (WINECATS||[]).forEach(c=>{if(!cat&&fixed.indexOf(c)>=0)cat=c;});
  }
  return cat;
}
/* מבחין בין צורות אריזה שונות של אותו יין (בקבוק רגיל / מגנום / דאבל
   מגנום וכד') כדי שלא יתמזגו יחד בטעות — רק איות/שפה שונים של אותה
   קטגוריה+בציר+צורת אריזה מתמזגים. */
const PICK_TYPE_HINTS=[['דאבל מגנום','דאבל מגנומים'],['מגנום','מגנומים'],['מלכיאור','מלכיאור'],['18 ליטר','18 ליטר'],['ארכיון','ארכיון']];
function pickTypeHint(n){
  n=String(n||'');
  for(const [needle,label] of PICK_TYPE_HINTS)if(n.indexOf(needle)>=0)return label;
  return '';
}
/* מפתח איחוד: ברקוד זהה = אותו יין (הכי אמין — לא תלוי איות/שפה של
   השם בכלל), ואם אין ברקוד — קטגוריה מזוהה + בציר + צורת אריזה. אם גם
   קטגוריה לא זוהתה (מוצר לא-יין, או טקסט לא מוכר) — נשארים על הטקסט
   הגולמי, כדי לא לאחד שני דברים שונים בניחוש. */
function pickGroupKey(n,barcode){
  const bc=typeof normBc==='function'?normBc(barcode):String(barcode||'').trim();
  if(bc)return 'bc:'+bc;
  const cat=pickCategoryOf(n);
  if(!cat)return String(n||'');
  const m=String(n||'').match(/\b(19|20)\d\d\b/);
  return cat+'|'+(m?m[0]:'')+'|'+pickTypeHint(n);
}
/* מאגד את כל המוצרים של מסלול ומצרף להם את המיקום במחסן. שם התצוגה
   משודרג לאיות הקנוני (WINECATS) ברגע שמופיעה גרסה שכבר כתובה נכון בין
   השורות המתמזגות — למשל "קברנה סובניון 2022" ו"קברנה סוביניון 2022"
   עם אותו ברקוד מתמזגים לשורה אחת עם הכמות המשותפת, מוצגת תחת השם
   התקין. תוויות שיובאו לפני שברקוד נשמר על כל שורת מוצר (b.prods[].b)
   ממשיכות להתמזג לפי הקטגוריה המזוהה, כמו קודם. */
function pickingRows(batches){
  const agg={};
  const addTo=(rawName,qty,client,barcode)=>{
    const key=pickGroupKey(rawName,barcode);
    if(!agg[key])agg[key]={name:rawName,qty:0,clients:{},barcode:'',_canon:false};
    const row=agg[key];
    if(!row.barcode&&barcode)row.barcode=barcode;
    if(!row._canon){
      const cat=pickCategoryOf(rawName);
      if(cat&&rawName.indexOf(cat)>=0){row.name=rawName;row._canon=true;}
    }
    row.qty+=qty;
    row.clients[client]=(row.clients[client]||0)+qty;
  };
  batches.forEach(b=>{
    (b.prods&&b.prods.length?b.prods:[]).forEach(p=>addTo(p.n,+p.q||0,b.client,p.b));
    /* לקוח שאין לו רשימת הזמנה — לפי תוכן הארגזים (אין ברקוד ברמה הזו) */
    if(!(b.prods&&b.prods.length)){
      (b.items||[]).forEach(it=>(it.contents||[]).forEach(c=>addTo(c,+it.count||0,b.client,'')));
    }
  });
  /* איתור מיקומים במחסן לכל מוצר */
  return Object.values(agg).map(a=>{
    const locs=matchLocations(a.name,a.barcode);
    return {name:a.name,qty:a.qty,clients:a.clients,locs,sortKey:locs.length?(locs[0].prow*1000+locs[0].pcol):999999};
  }).sort((x,y)=>x.sortKey-y.sortKey);
}
/* מוצא פריטי מלאי שתואמים למוצר מ-LionWheel. אם יש ברקוד — הוא הדרך
   הראשית והאמינה ביותר: מזהים אותו קודם מול הקטלוג, ואם הוא לא שם, מול
   הברקוד שכבר רשום בפועל על פריטי מלאי (ברקוד קבוצתי/פריט בודד) —
   כך שגם אם הקטלוג לא מכיר את הברקוד הזה, מוצאים אותו לפי מה שבאמת
   רשום במחסן. רק אם אין ברקוד בכלל נופלים לזיהוי לפי טקסט השם. */
function matchLocations(prodName,barcode){
  const n=String(prodName||'');
  const m=n.match(/\b(19|20)\d\d\b/);
  const vint=m?m[0]:'';
  let cat=null,vintOverride=null;
  const bc=typeof normBc==='function'?normBc(barcode):String(barcode||'').trim();
  if(bc){
    const prod=typeof productByCode==='function'?productByCode(bc):null;
    if(prod&&prod.c){cat=prod.c;if(prod.v)vintOverride=prod.v;}
    if(!cat&&typeof barcodeOf==='function'){
      const hit=(state.entries||[]).find(e=>normBc(barcodeOf(e))===bc);
      if(hit){cat=hit.category;vintOverride=hit.vintage;}
    }
  }
  if(!cat)(typeof PRODUCTS!=='undefined'?PRODUCTS:[]).forEach(p=>{if(!cat&&p.n===n&&p.c)cat=p.c;});
  if(!cat)cat=pickCategoryOf(n);
  if(!cat)return [];
  if(vintOverride!=null)return matchLocationsFor(cat,String(vintOverride));
  return matchLocationsFor(cat,vint);
}
function matchLocationsFor(cat,vint){
  return (state.entries||[]).filter(e=>e.category===cat&&(!vint||String(e.vintage)===vint)
      &&(+e.prow>0&&+e.pcol>0)&&(+e.units>0))
    .sort((a,b)=>(a.prow-b.prow)||(a.pcol-b.pcol))
    .map(e=>({prow:e.prow,pcol:e.pcol,plevel:e.plevel,units:+e.units||0,type:e.type,label:e.label}));
}
/* התקדמות ליקוט — מסומן לפי תאריך+שם מוצר, נשמר ומסתנכרן כמו שאר ההגדרות
   (כך שאפשר לעקוב מהמשרד אחרי מה שכבר נלקט, ולהמשיך מכל מכשיר) */
function pickingProgress(){if(!state.pickingProgress||typeof state.pickingProgress!=='object')state.pickingProgress={};return state.pickingProgress;}
function pickKey(date,name){return date+'|'+name;}
let _pickState=null;
function openPicking(){
  const bs=(state.labels||[]).filter(b=>batchTotal(b)>0);
  if(!bs.length){toast('אין מסלול פעיל');return;}
  const rows=pickingRows(bs);
  const date=bs[0].date||tkToday();
  _pickState={date,rows};
  const box=document.getElementById('modalbox');box.className='box wide picking-modal';
  box.innerHTML=pickingModalHTML();
  document.getElementById('modal').classList.add('open');
}
/* רשימת כרטיסים גדולים למגע — לא טבלה — כדי שאפשר יהיה לסמן פריט תוך כדי הליקוט בטלפון */
function pickingModalHTML(){
  const {date,rows}=_pickState;
  const bs=(state.labels||[]).filter(b=>batchTotal(b)>0);
  const totBoxes=bs.reduce((t,b)=>t+batchTotal(b),0);
  const noLoc=rows.filter(r=>!r.locs.length).length;
  const prog=pickingProgress();
  const doneCount=rows.filter(r=>prog[pickKey(date,r.name)]).length;
  const pct=rows.length?Math.round(doneCount/rows.length*100):0;
  return `<h3>דף ליקוט · ${esc(date)}</h3>
   <div class="hint">כל המוצרים של המסלול, <b>ממוינים לפי מיקום במחסן</b> — לגעת בשורה כדי לסמן שנלקטה. ${noLoc?('<b style="color:#c33">'+noLoc+' מוצרים ללא מיקום</b> — בדוק אותם ידנית.'):''}</div>
   <div class="pick-progress"><div class="pick-progress-bar" style="width:${pct}%"></div></div>
   <div class="hint" style="margin:4px 0 10px">נלקטו <b>${doneCount}</b> מתוך <b>${rows.length}</b> מוצרים · ${bs.length} לקוחות · ${totBoxes} ארגזים</div>
   <div class="pick-list">
   ${rows.map(r=>{
     const checked=!!prog[pickKey(date,r.name)];
     const locTxt=r.locs.length?r.locs.slice(0,3).map(l=>l.prow+'-'+l.pcol).join(', '):'ללא מיקום';
     const nameEsc=r.name.replace(/'/g,"\\'");
     const clientCount=Object.keys(r.clients).length;
     const clientFull=Object.entries(r.clients).map(([c,q])=>c+' ('+q+')').join(' · ');
     /* פירוט לקוחות מלא רק ב-title (מוצג בהחזקה/ריחוף) — ברשימה עצמה מציגים
        רק מספר לקוחות, כדי שהכרטיס יישאר קריא תוך כדי הליקוט בפועל */
     return `<div class="pick-row ${checked?'done':''} ${r.locs.length?'':'warn-row'}" onclick="togglePicked('${date.replace(/'/g,"\\'")}','${nameEsc}')">
       <div class="pick-check">${checked?'✓':''}</div>
       <div class="pick-body">
         <span class="pick-loc">${esc(locTxt)}</span>
         <div class="pick-name">${esc(r.name)}</div>
         <div class="pick-clients" title="${esc(clientFull)}">${clientCount} ${clientCount===1?'לקוח':'לקוחות'}</div>
       </div>
       <div class="pick-qty">${esc(r.qty)}</div>
     </div>`;
   }).join('')}
   </div>
   <div class="actions">
     <button class="btn ghost sm" onclick="resetPicking()">איפוס סימונים</button>
     <button class="btn" onclick="printPicking()">🖨️ הדפס דף ליקוט</button>
     <button class="btn ghost" onclick="closeModal()">סגור</button></div>`;
}
function togglePicked(date,name){
  const p=pickingProgress(),k=pickKey(date,name);
  if(p[k])delete p[k];else p[k]=true;
  save();
  if(_pickState)document.getElementById('modalbox').innerHTML=pickingModalHTML();
}
function resetPicking(){
  if(!_pickState)return;
  if(!confirm('לאפס את כל הסימונים בדף הליקוט?'))return;
  const p=pickingProgress();
  _pickState.rows.forEach(r=>{delete p[pickKey(_pickState.date,r.name)];});
  save();
  document.getElementById('modalbox').innerHTML=pickingModalHTML();
}
function printPicking(){
  const bs=(state.labels||[]).filter(b=>batchTotal(b)>0);
  const rows=pickingRows(bs);
  const date=bs.length?(bs[0].date||''):'';
  const title=state.settings.title||'יקב טורא';
  const html=`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דף ליקוט</title><style>
    @page{size:A4;margin:12mm}
    body{font-family:Arial,sans-serif;direction:rtl;margin:0}
    h1{font-size:18px;color:#7B1E2B;margin:0 0 2px}
    .sub{font-size:12px;color:#555;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#1B2A4A;color:#fff;padding:6px 5px;text-align:right}
    td{border-bottom:1px solid #ccc;padding:6px 5px;vertical-align:top}
    .loc{font-weight:800;font-size:14px;white-space:nowrap}
    .qty{font-weight:800;font-size:14px;text-align:center}
    .cl{font-size:10px;color:#555}
    .chk{width:22px;height:22px;border:1.5px solid #333;display:inline-block;border-radius:3px}
    .noloc{background:#fdecec}
    tr{page-break-inside:avoid}
    .foot{margin-top:14px;font-size:11px;color:#666;display:flex;justify-content:space-between}
  </style></head><body>
   <h1>${esc(title)} — דף ליקוט</h1>
   <div class="sub">תאריך משלוח: <b>${esc(date)}</b> · ${bs.length} לקוחות · ${bs.reduce((t,b)=>t+batchTotal(b),0)} ארגזים · הודפס ${new Date().toLocaleString('he-IL')}</div>
   <table><thead><tr><th style="width:70px">מיקום</th><th>מוצר</th><th style="width:50px">כמות</th><th style="width:34%">לקוחות</th><th style="width:34px">✓</th></tr></thead><tbody>
   ${rows.map(r=>`<tr class="${r.locs.length?'':'noloc'}">
     <td class="loc">${r.locs.length?r.locs.slice(0,3).map(l=>l.prow+'-'+l.pcol).join('<br>'):'—'}</td>
     <td>${esc(r.name)}</td><td class="qty">${esc(r.qty)}</td>
     <td class="cl">${Object.entries(r.clients).map(([c,q])=>esc(c)+' ('+q+')').join(' · ')}</td>
     <td><span class="chk"></span></td></tr>`).join('')}
   </tbody></table>
   <div class="foot"><span>מלקט: ____________</span><span>שעת סיום: ________</span><span>חתימה: ____________</span></div>
  </body></html>`;
  printHTML(html);
}
/* ============ היסטוריית מסלולים ============ */
function routes(){if(!Array.isArray(state.routes))state.routes=[];return state.routes;}
function saveRoute(silent){
  const bs=(state.labels||[]).filter(b=>batchTotal(b)>0);
  if(!bs.length){if(!silent)toast('אין מסלול לשמירה');return null;}
  const date=bs[0].date||tkToday();
  const snap={id:Date.now(),date,savedAt:new Date().toISOString(),
    clients:bs.length,boxes:bs.reduce((t,b)=>t+batchTotal(b),0),
    labels:JSON.parse(JSON.stringify(bs))};
  const R=routes();
  const i=R.findIndex(r=>r.date===date);
  if(i>=0)R[i]=snap; else R.unshift(snap);
  R.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(R.length>60)state.routes=R.slice(0,60);
  save();
  if(!silent)toast('המסלול נשמר · '+date);
  return snap;
}
function openRoutes(){
  const R=routes();
  const box=document.getElementById('modalbox');box.className='box';
  box.innerHTML=`<h3>מסלולי הפצה שמורים</h3>
   <div class="hint">כל ייבוא מ-LionWheel נשמר אוטומטית לפי תאריך. אפשר לחזור למסלול ולהדפיס ממנו מדבקות או דף ליקוט.</div>
   ${R.length?`<div class="tablewrap" style="max-height:320px"><table><thead><tr>
     <th>תאריך משלוח</th><th>לקוחות</th><th>ארגזים</th><th>נשמר</th><th></th></tr></thead><tbody>
     ${R.map(r=>`<tr><td><b>${esc(r.date)}</b></td><td>${esc(r.clients)}</td><td>${esc(r.boxes)}</td>
       <td style="font-size:11px;color:var(--muted)">${new Date(r.savedAt).toLocaleDateString('he-IL')}</td>
       <td><button class="btn sm" onclick="loadRoute(${r.id})">טען</button>
           <button class="del" aria-label="מחיקה" onclick="delRoute(${r.id})">✕</button></td></tr>`).join('')}
     </tbody></table></div>`:'<div class="hint" style="margin-top:10px">אין עדיין מסלולים שמורים.</div>'}
   <div class="actions"><button class="btn ghost" onclick="saveRoute();openRoutes()">שמור את המסלול הנוכחי</button>
     <button class="btn" onclick="closeModal()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function loadRoute(id){
  const r=routes().find(x=>x.id===id);if(!r)return;
  if((state.labels||[]).some(b=>batchTotal(b)>0)&&!confirm('לטעון את המסלול של '+r.date+'?\nהמסלול הנוכחי יוחלף (הוא נשמר אוטומטית).'))return;
  saveRoute(true);
  state.labels=JSON.parse(JSON.stringify(r.labels));
  save();closeModal();renderLabels();toast('נטען מסלול '+r.date);
}
function delRoute(id){
  if(!confirm('למחוק את המסלול השמור?'))return;
  state.routes=routes().filter(r=>r.id!==id);save();openRoutes();
}
