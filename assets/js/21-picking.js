/* ============ דף ליקוט + היסטוריית מסלולים ============ */
/* מאגד את כל המוצרים של מסלול ומצרף להם את המיקום במחסן */
function pickingRows(batches){
  const agg={};
  batches.forEach(b=>{
    (b.prods&&b.prods.length?b.prods:[]).forEach(p=>{
      const k=p.n;
      if(!agg[k])agg[k]={name:k,qty:0,clients:{}};
      agg[k].qty+=+p.q||0;
      agg[k].clients[b.client]=(agg[k].clients[b.client]||0)+(+p.q||0);
    });
    /* לקוח שאין לו רשימת הזמנה — לפי תוכן הארגזים */
    if(!(b.prods&&b.prods.length)){
      (b.items||[]).forEach(it=>(it.contents||[]).forEach(c=>{
        if(!agg[c])agg[c]={name:c,qty:0,clients:{}};
        agg[c].qty+=+it.count||0;
        agg[c].clients[b.client]=(agg[c].clients[b.client]||0)+(+it.count||0);
      }));
    }
  });
  /* איתור מיקומים במחסן לכל מוצר */
  return Object.values(agg).map(a=>{
    const locs=matchLocations(a.name);
    return {...a,locs,sortKey:locs.length?(locs[0].prow*1000+locs[0].pcol):999999};
  }).sort((x,y)=>x.sortKey-y.sortKey);
}
/* מוצא פריטי מלאי שתואמים לשם מוצר מ-LionWheel */
function matchLocations(prodName){
  const n=String(prodName||'');
  const m=n.match(/\b(19|20)\d\d\b/);
  const vint=m?m[0]:'';
  let cat=null;
  (typeof PRODUCTS!=='undefined'?PRODUCTS:[]).forEach(p=>{if(!cat&&p.n===n&&p.c)cat=p.c;});
  if(!cat){                                   // התאמה לפי שם הקטגוריה בתוך המחרוזת
    (WINECATS||[]).forEach(c=>{if(!cat&&n.indexOf(c)>=0)cat=c;});
    if(!cat&&/Mountain\s*Peak|מאונטין/i.test(n))cat='MP';
  }
  if(!cat)return [];
  return (state.entries||[]).filter(e=>e.category===cat&&(!vint||String(e.vintage)===vint)
      &&(+e.prow>0&&+e.pcol>0)&&(+e.units>0))
    .sort((a,b)=>(a.prow-b.prow)||(a.pcol-b.pcol))
    .map(e=>({prow:e.prow,pcol:e.pcol,plevel:e.plevel,units:+e.units||0,type:e.type,label:e.label}));
}
function openPicking(){
  const bs=(state.labels||[]).filter(b=>batchTotal(b)>0);
  if(!bs.length){toast('אין מסלול פעיל');return;}
  const rows=pickingRows(bs);
  const date=bs[0].date||tkToday();
  const box=document.getElementById('modalbox');box.className='box wide';
  const totBoxes=bs.reduce((t,b)=>t+batchTotal(b),0);
  const noLoc=rows.filter(r=>!r.locs.length).length;
  box.innerHTML=`<h3>דף ליקוט · ${esc(date)}</h3>
   <div class="hint">כל המוצרים של המסלול, <b>ממוינים לפי מיקום במחסן</b> — כך אוספים במסלול אחד. ${noLoc?('<b style="color:#c33">'+noLoc+' מוצרים ללא מיקום</b> — בדוק אותם ידנית.'):''}</div>
   <div class="kpis k2" style="margin:10px 0">
     ${kpi('לקוחות',bs.length,'','var(--navy)')}${kpi('ארגזים',totBoxes,'','var(--gold-d)')}</div>
   <div class="tablewrap" style="max-height:320px"><table><thead><tr>
     <th>מיקום</th><th>מוצר</th><th>כמות</th><th>לקוחות</th><th>✓</th></tr></thead><tbody>
   ${rows.map(r=>`<tr class="${r.locs.length?'':'warn-row'}">
     <td><b>${r.locs.length?r.locs.slice(0,3).map(l=>l.prow+'-'+l.pcol).join(', '):'—'}</b></td>
     <td>${esc(r.name)}</td><td><b>${esc(r.qty)}</b></td>
     <td style="font-size:11px;color:var(--muted)">${Object.entries(r.clients).map(([c,q])=>esc(c)+' ('+q+')').join(' · ')}</td>
     <td>☐</td></tr>`).join('')}
   </tbody></table></div>
   <div class="actions">
     <button class="btn" onclick="printPicking()">🖨️ הדפס דף ליקוט</button>
     <button class="btn ghost" onclick="closeModal()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
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
           <button class="del" onclick="delRoute(${r.id})">✕</button></td></tr>`).join('')}
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
