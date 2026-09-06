/* ============ יומן תנועות מלאי ============
   כל שינוי בכמות (יחידות) בפריט במסך "מיקום במחסן" נרשם כאן: לפני/אחרי/סיבה.
   נקרא מ-04-location.js (עריכה ידנית), 23-deduct.js (ניכוי/החזרה) ו-10-csv.js (ייבוא). */
const INVLOG_REASONS={manual:'עריכה ידנית',deduct:'ניכוי ממשלוח',return:'החזרה',import:'ייבוא'};
function invLogArr(){if(!Array.isArray(state.invLog))state.invLog=[];return state.invLog;}
function invLocStr(e){if(!e)return'';return(e.prow>0?e.prow+'-'+e.pcol:'ללא מיקום')+(e.plevel?' · '+(LEVELNAME[e.plevel]||''):'');}
/* מפתח לזיהוי אותו "מיקום/פריט" בין שתי גרסאות של המלאי (למשל לפני/אחרי ייבוא) —
   מזהי הפריטים עצמם מתחלפים בייבוא, אז מזהים לפי המאפיינים והמיקום */
function invKeyOf(e){return[e.category||'',e.vintage||'',e.type||'',e.prow||0,e.pcol||0,e.plevel||0].join('|');}
function logInv(e,before,after,reason,note){
  before=Math.round((+before||0)*100)/100;after=Math.round((+after||0)*100)/100;
  if(before===after)return null;
  const rec={id:Date.now()+Math.floor(Math.random()*1e6),ts:new Date().toISOString(),
    entryId:(e&&e.id!==undefined)?e.id:null,
    category:(e&&e.category)||'',vintage:(e&&e.vintage)||'',type:(e&&e.type)||'',
    loc:invLocStr(e),
    before,after,delta:Math.round((after-before)*100)/100,
    reason:INVLOG_REASONS[reason]?reason:'manual',
    note:note||''};
  invLogArr().push(rec);
  if(invLogArr().length>5000)state.invLog=invLogArr().slice(-5000);   /* מגבלת גודל סבירה */
  return rec;
}
/* ייבוא מחליף את כל state.entries — מזהים פריטים תואמים לפי invKeyOf ומשווים כמויות */
function logImportDiff(oldArr,newArr,note){
  const oldB={},newB={};
  (oldArr||[]).forEach(e=>{const k=invKeyOf(e);(oldB[k]=oldB[k]||[]).push(e);});
  (newArr||[]).forEach(e=>{const k=invKeyOf(e);(newB[k]=newB[k]||[]).push(e);});
  const keys=new Set(Object.keys(oldB).concat(Object.keys(newB)));
  keys.forEach(k=>{
    const ao=oldB[k]||[],an=newB[k]||[],n=Math.max(ao.length,an.length);
    for(let i=0;i<n;i++){
      const oe=ao[i],ne=an[i];
      logInv(ne||oe,oe?(+oe.units||0):0,ne?(+ne.units||0):0,'import',note);
    }
  });
}
/* ============ מסך היומן ============ */
let invLogF={},invLogSort={col:'ts',dir:'desc',val:r=>Date.parse(r.ts)||0};
const INVLOGDEFS=()=>[
 {key:'day',label:'תאריך',get:r=>(r.ts||'').slice(0,10),values:distinct(invLogArr(),r=>(r.ts||'').slice(0,10)).sort().reverse()},
 {key:'category',label:'קטגוריה',get:r=>r.category,values:distinct(invLogArr(),r=>r.category)},
 {key:'reason',label:'סוג פעולה',get:r=>INVLOG_REASONS[r.reason]||r.reason,values:Object.values(INVLOG_REASONS)}];
function invLogFilter(k,v){if(k==='__clear__'){invLogF={};}else{invLogF[k]=v;}renderInvLog();}
function invLogSortBy(col){
  const map={ts:r=>Date.parse(r.ts)||0,category:r=>r.category,before:r=>+r.before,after:r=>+r.after,delta:r=>+r.delta};
  if(invLogSort&&invLogSort.col===col)invLogSort.dir=invLogSort.dir==='asc'?'desc':'asc';else invLogSort={col,dir:'asc'};
  invLogSort.val=map[col];renderInvLog();
}
function renderInvLog(){
  const defs=INVLOGDEFS();
  let rows=invLogArr().filter(r=>passF(r,defs,invLogF));
  rows=sortList(rows,invLogSort);
  const added=rows.reduce((t,r)=>t+(r.delta>0?r.delta:0),0);
  const removed=rows.reduce((t,r)=>t+(r.delta<0?-r.delta:0),0);
  let h=`<div class="panel"><h2>יומן תנועות מלאי</h2>
   <div class="hint">כל שינוי בכמות פריט במסך "מיקום במחסן" — עריכה ידנית, ניכוי ממשלוח, החזרה או ייבוא — נרשם כאן אוטומטית עם תאריך, שעה, לפני/אחרי וסיבה.</div>
   <div class="kpis k3" style="margin-bottom:10px">
    ${kpi('רשומות בתצוגה',rows.length,'','var(--navy)')}${kpi('נוספו',Math.round(added).toLocaleString(),'','var(--ok)')}${kpi('ירדו',Math.round(removed).toLocaleString(),'','var(--warn)')}</div>
   ${filterControls(defs,invLogF,'invLogFilter')}
   <div class="tablewrap"><table><thead><tr>
   ${sTh('תאריך ושעה','ts',invLogSort,'invLogSortBy')}${sTh('קטגוריה','category',invLogSort,'invLogSortBy')}<th>פריט</th>
   ${sTh('לפני','before',invLogSort,'invLogSortBy')}${sTh('אחרי','after',invLogSort,'invLogSortBy')}${sTh('שינוי','delta',invLogSort,'invLogSortBy')}
   <th>סיבה</th><th>הערה</th></tr></thead><tbody>`;
  rows.forEach(r=>{
    h+=`<tr><td>${esc(new Date(r.ts).toLocaleString('he-IL'))}</td><td>${esc(r.category)}</td>
     <td>${esc(r.vintage||'')} ${esc(r.type||'')} · ${esc(r.loc||'')}</td>
     <td>${esc(r.before)}</td><td>${esc(r.after)}</td>
     <td style="color:${r.delta>0?'var(--ok)':r.delta<0?'var(--warn)':'inherit'}">${r.delta>0?'+':''}${esc(r.delta)}</td>
     <td>${esc(INVLOG_REASONS[r.reason]||r.reason)}</td><td>${esc(r.note||'')}</td></tr>`;
  });
  h+=`</tbody></table></div><div class="hint">${rows.length} מתוך ${invLogArr().length} רשומות</div></div>`;
  document.getElementById('v-invlog').innerHTML=h;
}
