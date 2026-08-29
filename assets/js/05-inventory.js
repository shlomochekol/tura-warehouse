/* ============ INVENTORY ============ */
let invF={},invSort=null,_invRows=null;
function shipVisible(){return (window._shipRows&&window._shipRows.length!==undefined)?window._shipRows:(state.shipments||[]);}
function invVisible(){return (window._invRows&&window._invRows.length!==undefined)?window._invRows:(state.entries||[]);}
let shipF={},shipSort=null;
const SHCOLS=[['shipdate','תאריך משלוח','date'],['kind','משלוחים','select',['משלוחי חו"ל','תיוות מלאי','משלוח מקומי']],
 ['client','שם לקוח','text'],['category','קטגוריה','catsel'],['cook','מבושל/לא מבושל','cooksel'],
 ['vintage','בציר','text'],['units','יחידות','num'],['boxes','ארגזים','calc'],['pallets','משטחים','calc'],
 ['taste','סעימות','num'],['capsule','קפסולה','capcalc'],['lang','שפה','select',LANGS],
 ['label','תיוות','select',LABELS],
 ['status','סטטוס','select',['בהמתנה','הועמס','בוצע','בוטל']],['labeldate','תאריך לתיוות','date'],
 ['notes','הערות','text']];

const INVDEFS=()=>[
 {key:'category',label:'קטגוריה',get:e=>e.category,values:distinct(state.entries,e=>e.category)},
 {key:'vintage',label:'בציר',get:e=>e.vintage,values:distinct(state.entries,e=>e.vintage)},
 {key:'type',label:'סוג',get:e=>e.type,values:distinct(state.entries,e=>e.type)},
 {key:'cooked',label:'מבושל/לא',get:e=>e.cooked,values:COOKED},
 {key:'label',label:'תיוות',get:e=>e.label,values:LABELS}];
function invFilter(k,v){if(k==='__clear__'){invF={};}else{invF[k]=v;}renderInv();}
function invSortBy(col){const map={category:e=>e.category,vintage:e=>+e.vintage||0,type:e=>e.type,cooked:e=>e.cooked,label:e=>e.label,units:e=>+e.units,boxes:e=>derive(e).boxes,pallets:e=>derive(e).pallets};
  if(invSort&&invSort.col===col)invSort.dir=invSort.dir==='asc'?'desc':'asc';else invSort={col,dir:'asc'};invSort.val=map[col];renderInv();}
function renderInv(){
  const defs=INVDEFS();
  let list=state.entries.filter(e=>passF(e,defs,invF));
  window._invRows=list;                    /* לייצוא CSV מסונן */
  list=sortList(list,invSort);
  const tot=list.reduce((s,e)=>{const d=derive(e);s.u+=+e.units;s.b+=d.boxes;s.p+=d.pallets;return s;},{u:0,b:0,p:0});
  let h=`<div class="panel"><h2>מלאי מחסן</h2><div class="hint">נגזר אוטומטית מ"מיקום במחסן". סנן בכל עמודה, ומיין בלחיצה על הכותרת.</div>
   <div class="kpis k3" style="margin-bottom:10px">
    ${kpi('מק"טים בתצוגה',list.length,'','var(--navy)')}${kpi('יחידות',Math.round(tot.u).toLocaleString(),'','var(--wine)')}${kpi('ארגזים',Math.round(tot.b).toLocaleString(),'','#4F7A36')}${kpi('משטחים',tot.p.toFixed(1),'','var(--gold)')}</div>
   <div class="toolrow"><span class="exp">⬇ ייצוא: <button class="btn ghost sm" onclick="exportScreenCSV('inv')">Excel</button> <button class="btn ghost sm" onclick="exportScreenImg('v-inv','מלאי-מחסן')">תמונה</button></span></div>
   ${filterControls(defs,invF,'invFilter')}
   <div class="tablewrap"><table><thead><tr>
   ${sTh('קטגוריה','category',invSort,'invSortBy')}${sTh('בציר','vintage',invSort,'invSortBy')}${sTh('סוג','type',invSort,'invSortBy')}
   ${sTh('מבושל/לא מבושל','cooked',invSort,'invSortBy')}${sTh('תיוות','label',invSort,'invSortBy')}<th>קפסולה</th>
   ${sTh('יחידות','units',invSort,'invSortBy')}${sTh('ארגזים','boxes',invSort,'invSortBy')}${sTh('משטחים','pallets',invSort,'invSortBy')}<th>מיקום</th><th>סטטוס</th></tr></thead><tbody>`;
  list.forEach(e=>{const d=derive(e);const a=alertOf(e);const cap=capDisp(e);
    h+=`<tr class="${a?'warn-row':''}"><td>${esc(e.category)}</td><td>${esc(e.vintage||'')}</td><td>${esc(e.type)}</td>
     <td>${cookTag(e.cooked)}</td><td class="${isLabeled(e)?'lbl-yes':'lbl-no'}">${esc(e.label)}</td>
     <td>${cap[0]?`<span class="cap" style="${capStyle(cap[1])}">${esc(cap[0])}</span>`:''}</td>
     <td>${Math.round(e.units).toLocaleString()}</td><td>${d.boxes.toFixed(1)}</td><td>${d.pallets.toFixed(2)}</td>
     <td>${e.prow?'ש'+e.prow+'-ע'+e.pcol+' ('+LEVELNAME[e.plevel]+')':'—'}</td><td>${a||'תקין'}</td></tr>`;});
  h+=`<tr class="totrow"><td colspan="6">סה"כ (${list.length})</td><td>${Math.round(tot.u).toLocaleString()}</td><td>${tot.b.toFixed(1)}</td><td>${tot.p.toFixed(1)}</td><td colspan="2"></td></tr>`;
  h+=`</tbody></table></div></div>`;document.getElementById('v-inv').innerHTML=h;
}
const cookTag=v=>v==='מבושל'?'<span class="cook-r">מבושל</span>':v==='לא מבושל'?'<span class="cook-b">לא מבושל</span>':'';

function weekStart(off){const t=new Date();const d=new Date(t);d.setDate(t.getDate()-t.getDay()+off*7);d.setHours(0,0,0,0);return d;}
const parseD=s=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:d;};
function renderShip(){
  const defs=[
   {key:'kind',label:'משלוחים',get:s=>s.kind,values:['משלוחי חו"ל','תיוות מלאי','משלוח מקומי']},
   {key:'client',label:'לקוח',get:s=>s.client,values:distinct(state.shipments,s=>s.client)},
   {key:'category',label:'קטגוריה',get:s=>s.category,values:WINECATS},
   {key:'cook',label:'מבושל/לא',get:s=>s.cook,values:COOKED},
   {key:'lang',label:'שפה',get:s=>s.lang,values:LANGS},
   {key:'status',label:'סטטוס',get:s=>s.status,values:['בהמתנה','הועמס','בוצע','בוטל']}];
  const idx=state.shipments.map((s,i)=>({s,i})).filter(o=>passF(o.s,defs,shipF));
  window._shipRows=idx.map(o=>o.s).filter(Boolean);   /* idx הוא {s,i} */
  const tot=idx.reduce((t,o)=>{const s=o.s;const b=bpb(s.category,s.label||'מתוות');const bx=(+s.units||0)/b;t.u+=+s.units||0;t.b+=bx;t.p+=bx/bpp(s.category);t.t+=+s.taste||0;return t;},{u:0,b:0,p:0,t:0});
  let h=`<div class="panel"><h2>טבלת משלוחים</h2><div class="hint">הזנת יחידות מחשבת ארגזים ומשטחים אוטומטית. סנן בכל עמודה — הסיכום מתעדכן לפי המוצג.</div>
   <div class="toolrow"><button class="btn" onclick="addShip()">+ משלוח</button>
     <span class="exp">⬇ ייצוא: <button class="btn ghost sm" onclick="exportScreenCSV('ship')">Excel</button> <button class="btn ghost sm" onclick="exportScreenImg('v-ship','משלוחים')">תמונה</button> · ⬆ <button class="btn ghost sm" onclick="document.getElementById('impShip').click()">ייבוא Excel</button></span></div>
   ${filterControls(defs,shipF,'shipFilter')}
   <div class="tablewrap"><table><thead><tr>${SHCOLS.map(c=>`<th>${esc(c[1])}</th>`).join('')}<th></th></tr></thead><tbody>`;
  idx.forEach(o=>{const s=o.s,i=o.i;const b=bpb(s.category,s.label||'מתוות');const boxes=(+s.units||0)/b;const pallets=boxes/bpp(s.category);const cap=capOf(s.category);
    h+=`<tr>`;SHCOLS.forEach(col=>{const[f,,t,opts]=col;const v=s[f]??'';
      if(t==='select')h+=`<td><select onchange="setShip(${i},'${f}',this.value)">${['',...opts].map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select></td>`;
      else if(t==='catsel')h+=`<td><select onchange="setShip(${i},'${f}',this.value)"><option></option>${WINECATS.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select></td>`;
      else if(t==='cooksel')h+=`<td><select class="${v==='מבושל'?'cook-r':v==='לא מבושל'?'cook-b':''}" onchange="setShip(${i},'${f}',this.value)"><option></option>${COOKED.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select></td>`;
      else if(t==='calc')h+=`<td class="calc">${f==='boxes'?boxes.toFixed(1):pallets.toFixed(2)}</td>`;
      else if(t==='capcalc')h+=`<td>${cap[0]?`<span class="cap" style="${capStyle(cap[1])}">${esc(cap[0])}</span>`:''}</td>`;
      else if(t==='num')h+=`<td><input type="number" value="${esc(v)}" onchange="setShip(${i},'${f}',this.value)"></td>`;
      else h+=`<td><input type="${t}" value="${esc(v)}" onchange="setShip(${i},'${f}',this.value)"></td>`;});
    h+=`<td>${s.deducted
      ?`<button class="btn ghost sm" title="ירד מהמלאי — הקש כדי להחזיר" onclick="dedUndo(${i})">↩ החזר</button>`
      :`<button class="btn ghost sm" title="הורד מהמלאי" onclick="openDeduct(${i})">📉</button>`}
      <button class="del" onclick="delShip(${i})">✕</button></td></tr>`;});
  // totals row aligned under columns: date,kind,client,category,cook,vintage,units,boxes,pallets,taste,capsule,lang,status,labeldate,shipdate,notes
  /* חישוב עמיד: כמה עמודות לפני 'יחידות' וכמה אחרי 'סעימות' */
  const _nc=SHCOLS.length+1;
  const _iU=SHCOLS.findIndex(c=>c[0]==='units'),_iT=SHCOLS.findIndex(c=>c[0]==='taste');
  const _pre=Math.max(1,_iU>=0?_iU:1);
  const _post=Math.max(0,_nc-_pre-4);
  h+=`<tr class="totrow"><td colspan="${_pre}">סה"כ (${idx.length})</td><td>${Math.round(tot.u).toLocaleString()}</td><td>${tot.b.toFixed(1)}</td><td>${tot.p.toFixed(2)}</td><td>${Math.round(tot.t).toLocaleString()}</td><td colspan="${_post}"></td></tr>`;
  h+=`</tbody></table></div>${state.shipments.length?'':'<div class="hint">אין משלוחים — הוסף את הראשון.</div>'}</div>`;
  document.getElementById('v-ship').innerHTML=h;
}
function shipFilter(k,v){if(k==='__clear__'){shipF={};}else{shipF[k]=v;}renderShip();}
function setShip(i,f,v){
  const s=state.shipments[i];if(!s)return;
  s[f]=v;
  if(f==='category'){const cp=capOf(v);s.capsule=cp[0];}
  save();
  /* שדות שמשנים חישוב — רינדור מלא. השאר: עדכון שורת הסיכום בלבד,
     כדי לא לאבד פוקוס תוך כדי הקלדה. */
  if(['units','category','cook','shipdate','status'].includes(f))renderShip();
  if(f==='status'&&typeof dedMaybeOnStatus==='function')dedMaybeOnStatus(i,v);
}
function addShip(){state.shipments.push({status:'בהמתנה',shipdate:localDate()});save();renderShip();}
function delShip(i){state.shipments.splice(i,1);save();renderShip();}

