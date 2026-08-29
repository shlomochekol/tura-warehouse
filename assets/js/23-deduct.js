/* ============ ניכוי מלאי ממשלוח ============
   נפתח כשמשלוח עובר ל"הועמס". המשתמש בוחר מאיזה מיקום לרדת וכמה. */
let _dedShip=null,_dedPick={},_dedDone=null;

/* מיקומים מתאימים למשלוח — לפי קטגוריה, ואם צוין גם בציר/מבושל/תיוות */
function dedCandidates(s){
  if(!s||!s.category)return [];
  const v=String(s.vintage||'').trim();
  const ck=String(s.cook||s.cooked||'').trim();
  const lb=String(s.label||'').trim();
  return (state.entries||[]).filter(e=>{
    if(e.category!==s.category)return false;
    if((+e.units||0)<=0)return false;
    if(v&&String(e.vintage||'').trim()!==v)return false;
    if(ck&&String(e.cooked||'').trim()!==ck)return false;
    if(lb&&String(e.label||'').trim()&&String(e.label||'').trim()!==lb)return false;
    return true;
  }).sort((a,b)=>{
    /* ברירת מחדל להצגה: בציר ישן קודם, ואז מיקום */
    const va=String(a.vintage||''),vb=String(b.vintage||'');
    if(va!==vb)return va.localeCompare(vb);
    return (a.prow-b.prow)||(a.pcol-b.pcol);
  });
}
function dedNeeded(){return Math.max(0,Math.round(+(_dedShip&&_dedShip.units)||0));}
function dedPicked(){return Object.values(_dedPick).reduce((t,v)=>t+(+v||0),0);}

function openDeduct(shipIdx,onDone){
  const s=(state.shipments||[])[shipIdx];
  if(!s){toast('משלוח לא נמצא');return;}
  _dedShip=s;_dedDone=onDone||null;_dedPick={};
  const list=dedCandidates(s);
  /* הצעה ראשונית: ממלאים לפי הסדר עד הכמות הנדרשת */
  let left=dedNeeded();
  list.forEach(e=>{ if(left<=0)return; const take=Math.min(left,Math.round(+e.units||0));
    if(take>0){_dedPick[e.id]=take;left-=take;} });
  dedRender();
}
function dedRender(){
  const s=_dedShip;if(!s)return;
  const box=document.getElementById('modalbox');box.className='box wide';
  const list=dedCandidates(s);
  const need=dedNeeded(),picked=dedPicked(),gap=need-picked;
  const avail=list.reduce((t,e)=>t+Math.round(+e.units||0),0);
  box.innerHTML=`<h3>ניכוי מלאי — ${esc(s.client||'משלוח')}</h3>
   <div class="hint">${esc(s.category||'')} ${esc(s.vintage||'')} ${esc(s.cook||'')} ${esc(s.label||'')} ·
     נדרש <b>${need.toLocaleString()}</b> יחידות. בחר מאיזה מיקום לרדת וכמה.</div>
   <div class="kpis k2" style="margin:10px 0">
     ${kpi('נבחר',picked.toLocaleString(),'',picked===need?'var(--ok)':'var(--navy)')}
     ${kpi(gap>0?'חסר':'עודף',Math.abs(gap).toLocaleString(),'',gap?'var(--warn)':'var(--muted)')}</div>
   ${avail<need?`<div class="hint" style="color:#c33"><b>⚠ אין מספיק מלאי במערכת</b> — קיימות ${avail.toLocaleString()} יחידות בלבד מתוך ${need.toLocaleString()}.</div>`:''}
   ${list.length?`<div class="tablewrap" style="max-height:300px"><table><thead><tr>
     <th>מיקום</th><th>בציר</th><th>מבושל</th><th>תיוות</th><th>יש</th><th>להוריד</th><th>יישאר</th></tr></thead><tbody>
   ${list.map(e=>{const have=Math.round(+e.units||0);const take=Math.round(+_dedPick[e.id]||0);
     return `<tr class="${take>0?'warn-row':''}">
       <td><b>${e.prow>0?e.prow+'-'+e.pcol:'ללא מיקום'}</b>${e.plevel?' · '+esc(LEVELNAME[e.plevel]||''):''}</td>
       <td>${esc(e.vintage||'')}</td><td>${esc(e.cooked||'')}</td><td>${esc(e.label||'')}</td>
       <td>${have.toLocaleString()}</td>
       <td><input type="number" min="0" max="${have}" value="${take||''}" style="width:95px"
            onchange="dedSet(${e.id},this.value)" placeholder="0"></td>
       <td>${(have-take).toLocaleString()}</td></tr>`;}).join('')}
   </tbody></table></div>`:`<div class="hint" style="padding:14px;text-align:center">
     לא נמצאו מיקומים תואמים ל${esc(s.category||'')}${s.vintage?' '+esc(s.vintage):''}.</div>`}
   <div class="actions">
     <button class="btn ghost sm" onclick="dedAuto()">מלא אוטומטית</button>
     <button class="btn ghost sm" onclick="dedClear()">נקה</button>
     <button class="btn" ${picked>0?'':'disabled'} onclick="dedApply()">✓ הורד ${picked.toLocaleString()} יחידות</button>
     <button class="btn ghost" onclick="dedCancel()">דלג</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function dedSet(id,v){
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
  let n=Math.round(parseFloat(v)||0);
  n=Math.max(0,Math.min(n,Math.round(+e.units||0)));
  if(n)_dedPick[id]=n;else delete _dedPick[id];
  dedRender();
}
function dedAuto(){
  _dedPick={};let left=dedNeeded();
  dedCandidates(_dedShip).forEach(e=>{if(left<=0)return;
    const take=Math.min(left,Math.round(+e.units||0));if(take>0){_dedPick[e.id]=take;left-=take;}});
  dedRender();
}
function dedClear(){_dedPick={};dedRender();}
function dedCancel(){_dedShip=null;_dedPick={};closeModal();if(_dedDone)_dedDone(false);_dedDone=null;}
function dedApply(){
  const need=dedNeeded(),picked=dedPicked();
  if(picked<need&&!confirm('נבחרו '+picked.toLocaleString()+' יחידות מתוך '+need.toLocaleString()+
     ' הנדרשות.\nלהוריד בכל זאת את מה שנבחר?'))return;
  if(picked>need&&!confirm('נבחרו '+picked.toLocaleString()+' יחידות — יותר מהנדרש ('+need.toLocaleString()+').\nלהמשיך?'))return;
  const lines=[],rec=[];
  Object.keys(_dedPick).forEach(id=>{
    const e=(state.entries||[]).find(x=>String(x.id)===String(id));if(!e)return;
    const take=Math.round(+_dedPick[id]||0);if(take<=0)return;
    const before=Math.round(+e.units||0);
    e.units=Math.max(0,before-take);
    rec.push({id:e.id,take});                    /* שומרים כדי שאפשר יהיה לבטל */
    lines.push(`${e.category} ${e.vintage||''} · ${e.prow>0?e.prow+'-'+e.pcol:'ללא מיקום'} · ${before}→${e.units}`);
  });
  if(rec.length)_dedShip.dedRec=rec;
  /* רישום בהערות המשלוח, כדי שיישאר תיעוד */
  if(lines.length){
    const stamp=localDate()+': ירד מהמלאי — '+lines.join(' | ');
    _dedShip.notes=(_dedShip.notes?_dedShip.notes+' ; ':'')+stamp;
    _dedShip.deducted=1;
  }
  save();closeModal();refresh();
  toast('ירדו '+dedPicked().toLocaleString()+' יחידות מהמלאי');
  if(_dedDone)_dedDone(true);
  _dedShip=null;_dedPick={};_dedDone=null;
}
/* נקרא ממסך המשלוחים כשהסטטוס משתנה */
function dedMaybeOnStatus(idx,status){
  if(status!=='הועמס')return;
  const s=(state.shipments||[])[idx];
  if(!s||!s.units||s.deducted)return;
  setTimeout(()=>openDeduct(idx),250);
}

/* ============ ביטול ניכוי (החזרה) ============
   מחזיר בדיוק את מה שירד, לאותם מיקומים. */
function dedUndo(idx){
  const s=(state.shipments||[])[idx];
  if(!s||!s.deducted){toast('לא בוצע ניכוי למשלוח זה');return;}
  const rec=s.dedRec||[];
  if(!rec.length){
    toast('אין פירוט ניכוי — עדכן ידנית במסך מיקום במחסן');return;
  }
  const tot=rec.reduce((t,r)=>t+(+r.take||0),0);
  const detail=rec.map(r=>{const e=(state.entries||[]).find(x=>x.id===r.id);
    return '• '+(e?(e.category+' '+(e.vintage||'')+' · '+(e.prow>0?e.prow+'-'+e.pcol:'ללא מיקום')):'פריט שנמחק')+' → +'+r.take;}).join('\n');
  if(!confirm('להחזיר '+tot.toLocaleString()+' יחידות למלאי?\n\n'+detail))return;
  let back=0,missing=0;
  rec.forEach(r=>{
    const e=(state.entries||[]).find(x=>x.id===r.id);
    if(!e){missing++;return;}
    e.units=Math.round((+e.units||0)+(+r.take||0));back+=(+r.take||0);
  });
  s.notes=(s.notes?s.notes+' ; ':'')+localDate()+': הוחזר למלאי — '+back.toLocaleString()+' יחידות';
  delete s.deducted;delete s.dedRec;
  save();refresh();
  toast('הוחזרו '+back.toLocaleString()+' יחידות'+(missing?' ('+missing+' פריטים לא נמצאו)':''));
}
