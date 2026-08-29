/* ==================== מסך משימות מחסן (v2) ==================== */
const TZONES=['הפצה','הכנת הפצה','ליקוט','קבלה','אריזה','ספירת מלאי','תיוות','תחזוקה','כוח אדם','אחר'];
const TPRIO=[{k:'urgent',t:'דחוף',c:'#C0392B'},{k:'high',t:'גבוהה',c:'#E07A1F'},{k:'med',t:'בינונית',c:'#2C6FBB'},{k:'low',t:'נמוכה',c:'#6B7F8A'}];
const TSTAT={todo:'לביצוע',doing:'בתהליך',done:'בוצע'};
function prioOf(k){return TPRIO.find(p=>p.k===k)||TPRIO[2];}
function tasks(){if(!Array.isArray(state.tasks2))state.tasks2=[];return state.tasks2;}
let tkView='open',tkZone='',tkPrio='',tkQ='',tkSel=[],tkSort='due',tkMode='day',tkFiltOpen=false,tkDayOff=0;

/* ---------- helpers ---------- */
function tkToday(){return localDate();}
function tkWeekEnd(){const d=new Date();d.setDate(d.getDate()+7);return localDate(d);}
function tkNew(o){
  const t=Object.assign({id:Date.now()+Math.floor(Math.random()*999),title:'',zone:'אחר',priority:'med',
    status:'todo',due:'',time:'',tags:[],subs:[],notes:'',photos:[],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),log:[]},o||{});
  t.log=[{t:new Date().toISOString(),a:'נוצרה'}];
  t.updatedAt=new Date().toISOString();
  return t;
}
function tkTouch(t){if(t)t.updatedAt=new Date().toISOString();return t;}
function tkLog(t,txt){tkTouch(t);(t.log=t.log||[]).push({t:new Date().toISOString(),a:txt});if(t.log.length>40)t.log=t.log.slice(-40);}
function tkFind(id){return tasks().find(x=>x.id===id);}
function tkOverdue(t){return t.status!=='done'&&t.due&&t.due<tkToday();}
function tkProgress(t){const s=t.subs||[];if(!s.length)return null;return s.filter(x=>x.done).length+'/'+s.length;}

/* ---------- filtering ---------- */
function tkList(){
  const q=tkQ.trim();
  let L=tasks().filter(t=>{
    if(tkView==='done')      {if(t.status!=='done')return false;}
    else if(tkView==='open') {if(t.status==='done')return false;}
    /* 'all' — הכל, כולל שבוצעו */
    if(tkZone&&t.zone!==tkZone)return false;
    if(tkPrio&&t.priority!==tkPrio)return false;
    if(q){const hay=(t.title+' '+t.notes+' '+(t.tags||[]).join(' ')+' '+(t.subs||[]).map(s=>s.t).join(' ')).toLowerCase();
      if(hay.indexOf(q.toLowerCase())<0)return false;}
    return true;
  });
  const rank={urgent:0,high:1,med:2,low:3};
  L.sort((a,b)=>{
    if(tkSort==='prio')return rank[a.priority]-rank[b.priority];
    if(tkSort==='zone')return (a.zone||'').localeCompare(b.zone||'','he');
    const ad=a.due||'9999',bd=b.due||'9999';
    return ad===bd?rank[a.priority]-rank[b.priority]:(ad<bd?-1:1);
  });
  return L;
}

/* ---------- main render ---------- */
function renderTasks(){
  const L=tkList(),all=tasks();
  const cnt={today:all.filter(t=>t.status!=='done'&&(t.due===tkToday()||tkOverdue(t))).length,
             urgent:all.filter(t=>t.status!=='done'&&(t.priority==='urgent'||t.priority==='high')).length,
             open:all.filter(t=>t.status!=='done').length,
             done:all.filter(t=>t.status==='done').length};
  const views=[['open','פתוחות',cnt.open],['done','בוצעו',cnt.done],['all','הכל','']];
  let h=`<div class="panel"><h2>משימות מחסן</h2>
   <div class="tk-modes">
     <button class="${tkMode==='day'?'on':''}" onclick="tkMode='day';renderTasks()">📅 יום</button>
     <button class="${tkMode==='list'?'on':''}" onclick="tkMode='list';renderTasks()">📋 רשימה</button>
     <button class="${tkMode==='week'?'on':''}" onclick="tkMode='week';renderTasks()">🗓️ שבוע</button>
     <button class="${tkMode==='month'?'on':''}" onclick="tkMode='month';renderTasks()">📆 חודש</button>
   </div>`;
  if(tkMode==='day'){
    h+=tkDayHTML()+`</div>`;
    document.getElementById('v-tasks').innerHTML=h;
    return;
  }
  if(tkMode!=='list'){
    h+=(tkMode==='week'?boardWeekHTML():boardMonthHTML())+`</div>`;
    document.getElementById('v-tasks').innerHTML=h;
    if(tkMode==='week')document.querySelectorAll('#v-tasks .bd-ta').forEach(bAuto);
    return;
  }
  h+=`
   <div class="tk-add">
     <input id="tk_q" placeholder="משימה חדשה… (למשל: להכין מסלול הפצה למחר)" onkeydown="if(event.key==='Enter')tkQuickAdd()">
     <button class="btn" onclick="tkQuickAdd()">+ הוסף</button>
     <button class="btn ghost" id="tk_mic" onclick="tkVoice()" title="הקלטה קולית">🎤</button>
     <button class="btn ghost" onclick="tkTemplates()">📋 תבניות</button>
   </div>
   <div class="tk-views">${views.map(([k,t,c])=>`<button class="${tkView===k?'on':''}" onclick="tkView='${k}';tkSel=[];renderTasks()">${t}${c!==''&&c>0?` <b>${esc(c)}</b>`:''}</button>`).join('')}</div>
   <div class="tk-filterbar">
     <input class="tk-search" placeholder="🔍 חיפוש" value="${esc(tkQ)}" oninput="tkQ=this.value;tkRerender()">
     <button class="btn ghost sm ${tkFiltCount()?'on':''}" onclick="tkFiltOpen=!tkFiltOpen;renderTasks()">
       ⚙ סינון${tkFiltCount()?' · '+tkFiltCount():''}</button>
     ${tkFiltCount()?`<button class="btn ghost sm" onclick="tkZone='';tkPrio='';tkSort='due';renderTasks()">נקה</button>`:''}
   </div>
   <div class="tk-filters" style="display:${tkFiltOpen||tkFiltCount()?'flex':'none'}">
     <select onchange="tkZone=this.value;renderTasks()"><option value="">כל האזורים</option>${TZONES.map(z=>`<option ${tkZone===z?'selected':''}>${esc(z)}</option>`).join('')}</select>
     <select onchange="tkPrio=this.value;renderTasks()"><option value="">כל העדיפויות</option>${TPRIO.map(p=>`<option value="${esc(p.k)}" ${tkPrio===p.k?'selected':''}>${esc(p.t)}</option>`).join('')}</select>
     <select onchange="tkSort=this.value;renderTasks()">
       <option value="due" ${tkSort==='due'?'selected':''}>מיון: תאריך</option>
       <option value="prio" ${tkSort==='prio'?'selected':''}>מיון: עדיפות</option>
       <option value="zone" ${tkSort==='zone'?'selected':''}>מיון: אזור</option></select>
     ${(tkZone||tkPrio||tkQ)?`<button class="btn ghost sm" onclick="tkZone='';tkPrio='';tkQ='';renderTasks()">נקה</button>`:''}
   </div>`;
  if(tkSel.length)h+=`<div class="tk-bulk"><b>${tkSel.length} נבחרו</b>
     <button class="btn ghost sm" onclick="tkBulk('done')">✓ סמן כבוצע</button>
     <button class="btn ghost sm" onclick="tkBulk('doing')">בתהליך</button>
     <select onchange="tkBulkSet('zone',this.value);this.value=''"><option value="">שנה אזור…</option>${TZONES.map(z=>`<option>${esc(z)}</option>`).join('')}</select>
     <select onchange="tkBulkSet('priority',this.value);this.value=''"><option value="">שנה עדיפות…</option>${TPRIO.map(p=>`<option value="${esc(p.k)}">${esc(p.t)}</option>`).join('')}</select>
     <button class="btn ghost sm" onclick="tkBulkDel()">🗑 מחק</button>
     <button class="btn ghost sm" onclick="tkSel=[];renderTasks()">בטל בחירה</button></div>`;
  h+=`<div class="tk-list" id="tk_list">${tkGroupedHTML(L)}</div>`;
  h+=`<div class="tk-foot"><button class="btn ghost sm" onclick="tkFromAlerts()">⚠ צור משימות מהתראות מלאי</button>
      <button class="btn ghost sm" onclick="tkPurge()">נקה משימות שבוצעו</button></div></div>`;
  document.getElementById('v-tasks').innerHTML=h;
}
/* קיבוץ הרשימה לפי תאריך — כותרת לכל יום, כדי שאפשר יהיה לסרוק מהר */
function tkGroupedHTML(L){
  if(!L.length)return `<div class="hint" style="padding:18px;text-align:center">אין משימות בתצוגה הזו.</div>`;
  if(tkSort!=='due')return L.map(tkCard).join('');      /* קיבוץ רק כשממיינים לפי תאריך */
  const today=localDate();
  const tomorrow=localDate(new Date(Date.now()+864e5));
  const groups=[],idx={};
  L.forEach(t=>{
    const k=String(t.due||'')||'__none__';
    if(idx[k]===undefined){idx[k]=groups.length;groups.push({k,items:[]});}
    groups[idx[k]].items.push(t);
  });
  const label=k=>{
    if(k==='__none__')return 'ללא תאריך';
    if(k===today)return 'היום · '+k;
    if(k===tomorrow)return 'מחר · '+k;
    const d=parseD(k);
    if(!d)return k;
    const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    const late=k<today;
    return (late?'⚠ באיחור · ':'')+'יום '+days[d.getDay()]+' · '+k;
  };
  return groups.map(g=>{
    const done=g.items.filter(t=>t.status==='done').length;
    const cls=g.k==='__none__'?'tk-day none':(g.k<today?'tk-day late':(g.k===today?'tk-day today':'tk-day'));
    return `<div class="${cls}"><span>${esc(label(g.k))}</span>
      <b>${g.items.length}${done?' · '+done+' בוצעו':''}</b></div>`+g.items.map(tkCard).join('');
  }).join('');
}
function tkRerender(){const el=document.getElementById('tk_list');if(el)el.innerHTML=tkGroupedHTML(tkList());}
/* כמה מסננים פעילים */
function tkFiltCount(){let n=0;if(tkZone)n++;if(tkPrio)n++;if(tkSort!=='due')n++;return n;}
/* ---------- תצוגת יום ---------- */
function tkDayDate(){return localDate(new Date(Date.now()+tkDayOff*864e5));}
function tkDayHTML(){
  const ds=tkDayDate(),today=localDate();
  const d=parseD(ds)||new Date();
  const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const all=tasks();
  const dayTasks=all.filter(t=>t.due===ds);
  const late=tkDayOff===0?all.filter(t=>t.status!=='done'&&t.due&&t.due<today):[];
  const open=dayTasks.filter(t=>t.status!=='done'),done=dayTasks.filter(t=>t.status==='done');
  const board=(state.board||{})[ds]||{};
  const boardRows=Object.keys(board).filter(k=>String(board[k]||'').trim());
  const sup=(typeof supplyOf==='function')?supplyOf(ds):[];
  const ships=(state.shipments||[]).filter(s=>s.shipdate===ds);
  const label=tkDayOff===0?'היום':(tkDayOff===1?'מחר':(tkDayOff===-1?'אתמול':''));
  return `<div class="tk-daybar">
      <button class="btn ghost sm" onclick="tkDayOff--;renderTasks()">‹</button>
      <div class="tk-daytitle"><b>${label?label+' · ':''}יום ${days[d.getDay()]}</b><span>${ds}</span></div>
      <button class="btn ghost sm" onclick="tkDayOff++;renderTasks()">›</button>
      ${tkDayOff!==0?`<button class="btn ghost sm" onclick="tkDayOff=0;renderTasks()">היום</button>`:''}
      <button class="btn sm" onclick="tkAddForDay('${ds}')">+ משימה ליום זה</button>
    </div>
    ${late.length?`<div class="tk-day late"><span>⚠ באיחור מימים קודמים</span><b>${late.length}</b></div>
      ${late.map(tkCard).join('')}`:''}
    <div class="tk-day ${tkDayOff===0?'today':''}"><span>משימות היום</span><b>${open.length} פתוחות${done.length?' · '+done.length+' בוצעו':''}</b></div>
    ${dayTasks.length?dayTasks.map(tkCard).join(''):`<div class="hint" style="padding:14px;text-align:center">אין משימות ליום זה.</div>`}
    ${(boardRows.length||sup.length||ships.length)?`<div class="tk-day"><span>מה עוד מתוכנן ליום זה</span><b></b></div>
      <div class="tk-dayinfo">
        ${boardRows.map(k=>`<div><b>${esc(k)}:</b> ${esc(board[k])}</div>`).join('')}
        ${sup.length?`<div><b>אספקה משילה:</b> ${sup.map(x=>esc(x.item)+' '+Math.round(x.units)).join(' · ')}</div>`:''}
        ${ships.length?`<div><b>משלוחים:</b> ${ships.map(s=>esc(s.client||'')+(s.units?' ('+Math.round(s.units)+' יח׳)':'')).join(' · ')}</div>`:''}
      </div>`:''}`;
}
function tkAddForDay(ds){
  const title=(prompt('משימה חדשה ל-'+ds+':')||'').trim();
  if(!title)return;
  const t={id:Date.now(),title,zone:TZONES[0],priority:'med',status:'todo',due:ds,
    subs:[],tags:[],photos:[],notes:'',log:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  tasks().unshift(t);save();renderTasks();toast('נוספה משימה ל-'+ds);
}
function tkCard(t){
  const p=prioOf(t.priority),pr=tkProgress(t),od=tkOverdue(t);
  return `<div class="tk-card ${t.status==='done'?'is-done':''} ${od?'is-late':''}" style="border-inline-start:5px solid ${p.c}" title="עדיפות: ${esc(p.t)}">
    <label class="tk-chk"><input type="checkbox" ${tkSel.includes(t.id)?'checked':''} onclick="event.stopPropagation();tkToggleSel(${t.id})"></label>
    <button class="tk-done" onclick="event.stopPropagation();tkToggleDone(${t.id})" title="סמן כבוצע">${t.status==='done'?'✓':'○'}</button>
    <div class="tk-main" onclick="tkOpen(${t.id})">
      <div class="tk-title">${esc(t.title||'(ללא כותרת)')}</div>
      <div class="tk-meta">
        ${t.zone?`<span class="tk-zone">${esc(t.zone)}</span>`:''}
        ${(tkSort!=='due'&&t.due)?`<span class="tk-due ${od?'late':''}">${t.due}</span>`:''}
        ${pr?`<span class="tk-sub">☑ ${pr}</span>`:''}
        ${(t.photos||[]).length?`<span class="tk-ph">📷 ${(t.photos||[]).length}</span>`:''}
        ${t.status==='doing'?`<span class="tk-doing">בתהליך</span>`:''}
      </div>
    </div>
    <button class="tk-x" onclick="event.stopPropagation();tkDel(${t.id})">✕</button>
  </div>`;
}
/* ---------- create ---------- */
function tkQuickAdd(){
  const el=document.getElementById('tk_q');
  if(!el){tkMode='list';renderTasks();toast('עבור לתצוגת רשימה כדי להוסיף משימה');return;}
  const v=(el.value||'').trim();
  if(!v){toast('כתוב משימה');return;}
  const t=tkNew({title:v,zone:tkZone||tkGuessZone(v),priority:/דחוף|בהול/.test(v)?'urgent':'med',due:tkView==='today'?tkToday():''});
  tasks().unshift(t);el.value='';save();renderTasks();toast('נוספה');
}
function tkGuessZone(txt){
  const map={'הפצה':/הפצה|משלוח|מסלול|נהג/,'ליקוט':/ליקוט|לקט|איסוף/,'קבלה':/קבלה|נכנס|פריקה/,'אריזה':/אריז|ארגז/,
    'ספירת מלאי':/ספיר|מלאי|ספירה/,'תיוות':/תיוו|תייג|תיוג|מדבק|תווית/,'תחזוקה':/תחזוק|תיקון|מלגז/,'כוח אדם':/עובד|משמרת|כוח אדם/};
  for(const z in map)if(map[z].test(txt))return z;
  return 'אחר';
}
function tkVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('הדפדפן לא תומך בהקלטה קולית');return;}
  const r=new SR();r.lang='he-IL';r.interimResults=false;r.maxAlternatives=1;
  const btn=document.getElementById('tk_mic');
  if(!btn){tkMode='list';renderTasks();toast('עבור לתצוגת רשימה כדי להקליט');return;}
  btn.classList.add('rec');btn.textContent='●';
  const reset=()=>{const b2=document.getElementById('tk_mic');if(b2){b2.classList.remove('rec');b2.textContent='🎤';}};
  r.onresult=e=>{const txt=e.results[0][0].transcript;
    const q=document.getElementById('tk_q');if(q){q.value=txt;tkQuickAdd();}else toast('לא ניתן להוסיף בתצוגה זו');};
  r.onerror=()=>{toast('ההקלטה נכשלה — בדוק הרשאת מיקרופון');reset();};
  r.onend=reset;
  try{r.start();}catch(e){reset();}
}
/* ---------- edit ---------- */
function tkToggleDone(id){const t=tkFind(id);if(!t)return;
  t.status=t.status==='done'?'todo':'done';
  t.doneAt=t.status==='done'?new Date().toISOString():'';
  if(t.status==='done'&&(t.subs||[]).length)t.subs.forEach(s=>s.done=true);
  tkLog(t,t.status==='done'?'סומנה כבוצעה':'הוחזרה לביצוע');save();renderTasks();}
function tkToggleSel(id){const i=tkSel.indexOf(id);if(i<0)tkSel.push(id);else tkSel.splice(i,1);renderTasks();}
function tkDel(id){const t=tkFind(id);if(!t)return;if(!confirm('למחוק את המשימה?'))return;
  state.tasks2=tasks().filter(x=>x.id!==id);tkSel=tkSel.filter(x=>x!==id);save();renderTasks();}
function tkSet(id,f,v){const t=tkFind(id);if(!t)return;t.updatedAt=new Date().toISOString();
  if(f==='tags')v=String(v).split(/[,\s]+/).map(x=>x.replace(/^#/,'').trim()).filter(Boolean);
  t[f]=v;tkLog(t,'עודכן: '+f);save();tkOpen(id,true);}
function tkBulk(st){tkSel.forEach(id=>{const t=tkFind(id);if(t){tkTouch(t);t.status=st;if(st==='done')t.doneAt=new Date().toISOString();tkLog(t,'עודכן במרוכז: '+TSTAT[st]);}});tkSel=[];save();renderTasks();toast('עודכן');}
function tkBulkSet(f,v){if(!v)return;tkSel.forEach(id=>{const t=tkFind(id);if(t){tkTouch(t);t[f]=v;tkLog(t,'עודכן במרוכז');}});save();renderTasks();toast('עודכן');}
function tkBulkDel(){if(!confirm('למחוק '+tkSel.length+' משימות?'))return;
  state.tasks2=tasks().filter(t=>!tkSel.includes(t.id));tkSel=[];save();renderTasks();}
function tkPurge(){const n=tasks().filter(t=>t.status==='done').length;if(!n){toast('אין משימות שבוצעו');return;}
  if(!confirm('למחוק '+n+' משימות שבוצעו?'))return;state.tasks2=tasks().filter(t=>t.status!=='done');save();renderTasks();}
/* ---------- details modal ---------- */
function tkOpen(id,keep){
  const t=tkFind(id);if(!t)return;
  const box=document.getElementById('modalbox');box.className='box';
  const p=prioOf(t.priority);
  box.innerHTML=`<h3>פרטי משימה</h3>
   <div class="fld"><label>כותרת</label><input value="${esc(t.title)}" onchange="tkSet(${id},'title',this.value)"></div>
   <div class="tk-row3">
     <div class="fld"><label>אזור</label><select onchange="tkSet(${id},'zone',this.value)">${TZONES.map(z=>`<option ${t.zone===z?'selected':''}>${esc(z)}</option>`).join('')}</select></div>
     <div class="fld"><label>עדיפות</label><select onchange="tkSet(${id},'priority',this.value)">${TPRIO.map(x=>`<option value="${esc(x.k)}" ${t.priority===x.k?'selected':''}>${esc(x.t)}</option>`).join('')}</select></div>
     <div class="fld"><label>סטטוס</label><select onchange="tkSet(${id},'status',this.value)">${Object.keys(TSTAT).map(k=>`<option value="${esc(k)}" ${t.status===k?'selected':''}>${esc(TSTAT[k])}</option>`).join('')}</select></div>
   </div>
   <div class="tk-row3">
     <div class="fld"><label>תאריך יעד</label><input type="date" value="${esc(t.due||'')}" onchange="tkSet(${id},'due',this.value)"></div>
     </div>
   <div class="fld"><label>תתי-משימות ${tkProgress(t)?'· '+tkProgress(t):''}</label>
     <div class="tk-subs">${(t.subs||[]).map((sx,i)=>`<div class="tk-subrow">
        <input type="checkbox" ${sx.done?'checked':''} onchange="tkSubToggle(${id},${i})">
        <input value="${esc(sx.t)}" class="${sx.done?'sdone':''}" onchange="tkSubText(${id},${i},this.value)">
        <button class="del" onclick="tkSubDel(${id},${i})">✕</button></div>`).join('')}</div>
     <button class="btn ghost sm" onclick="tkSubAdd(${id})">+ הוסף תת-משימה</button></div>
   <div class="fld"><label>הערות</label><textarea rows="3" onchange="tkSet(${id},'notes',this.value)">${esc(t.notes||'')}</textarea></div>
   <div class="fld"><label>תמונות</label>
     <div class="tk-photos">${(t.photos||[]).map((src,i)=>`<div class="tk-phw"><img src="${src}"><button class="del" onclick="tkPhotoDel(${id},${i})">✕</button></div>`).join('')}</div>
     <input type="file" accept="image/*" capture="environment" onchange="tkPhotoAdd(${id},event)"></div>
   <details class="tk-log"><summary>יומן פעילות (${(t.log||[]).length})</summary>
     ${(t.log||[]).slice().reverse().map(l=>`<div class="tk-logrow"><span>${new Date(l.t).toLocaleString('he-IL')}</span> ${esc(l.a)}</div>`).join('')||'—'}</details>
   <div class="actions"><button class="btn" onclick="closeModal();renderTasks()">שמור וסגור</button>
     <button class="btn ghost" onclick="tkDup(${id})">שכפל</button>
     <button class="btn warn" onclick="closeModal();tkDel(${id})">מחק</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function tkSubAdd(id){const t=tkFind(id);if(!t)return;tkTouch(t);(t.subs=t.subs||[]).push({t:'',done:false});save();tkOpen(id);}
function tkSubToggle(id,i){const t=tkFind(id);if(!t)return;tkTouch(t);t.subs[i].done=!t.subs[i].done;
  if((t.subs||[]).length&&t.subs.every(s=>s.done)&&t.status!=='done'){t.status='doing';}
  tkLog(t,'תת-משימה עודכנה');save();tkOpen(id);}
function tkSubText(id,i,v){const t=tkFind(id);if(!t)return;tkTouch(t);t.subs[i].t=v;save();}
function tkSubDel(id,i){const t=tkFind(id);if(!t)return;tkTouch(t);t.subs.splice(i,1);save();tkOpen(id);}
function tkDup(id){const t=tkFind(id);if(!t)return;
  const c=tkNew({title:t.title+' (עותק)',zone:t.zone,priority:t.priority,due:t.due,time:t.time,
    tags:(t.tags||[]).slice(),subs:(t.subs||[]).map(s=>({t:s.t,done:false})),notes:t.notes});
  tasks().unshift(c);save();closeModal();renderTasks();toast('שוכפלה');}
function tkPhotoAdd(id,ev){
  const f=ev.target.files[0];if(!f)return;const t=tkFind(id);if(!t)return;
  if((t.photos||[]).length>=4){toast('עד 4 תמונות למשימה');return;}
  const r=new FileReader();
  r.onload=()=>{const img=new Image();
    img.onload=()=>{const M=900,sc=Math.min(1,M/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      (t.photos=t.photos||[]).push(c.toDataURL('image/jpeg',0.6));
      tkLog(t,'נוספה תמונה');save();tkOpen(id);toast('התמונה נוספה');};
    img.src=r.result;};
  r.readAsDataURL(f);ev.target.value='';
}
function tkPhotoDel(id,i){const t=tkFind(id);if(!t)return;tkTouch(t);t.photos.splice(i,1);save();tkOpen(id);}
/* ---------- templates ---------- */
const TTPL=[
 {n:'הכנת מסלול הפצה',z:'הכנת הפצה',p:'high',s:['הדפסת רשימת לקוחות','ליקוט הסחורה לפי לקוח','הדפסת מדבקות הפצה','סריקת העמסה לרכב','עדכון סטטוס במערכת']},
 {n:'קליטת משלוח נכנס',z:'קבלה',p:'high',s:['בדיקת תעודת משלוח','ספירת ארגזים','בדיקת שברים/נזק','שיבוץ מיקום במחסן','עדכון יחידות במערכת']},
 {n:'ספירת מלאי לאזור',z:'ספירת מלאי',p:'med',s:['הדפסת דוח מלאי לאזור','ספירה בפועל','רישום פערים','עדכון המערכת']},
 {n:'תיוות סדרה',z:'תיוות',p:'med',s:['הוצאת המשטח מהמיקום','הכנת מכונת התיוות','תיוות הארגזים','החזרה למיקום','עדכון תיוות במערכת']},
 {n:'פירוק והרכבת משטח',z:'אריזה',p:'med',s:['פירוק המשטח','מיון לפי סוג','הרכבה מחדש','עטיפה וסימון','עדכון מיקום']},
 {n:'תחזוקת מלגזה',z:'תחזוקה',p:'low',s:['בדיקת סוללה/דלק','בדיקת שמן ולחץ אוויר','ניקיון','רישום שעות עבודה']},
 {n:'סידור משמרת',z:'כוח אדם',p:'med',s:['בדיקת זמינות עובדים','חלוקת אזורים','עדכון העובדים']}
];
function tkTemplates(){
  const box=document.getElementById('modalbox');box.className='box';
  box.innerHTML=`<h3>תבניות משימה</h3><div class="hint">לחיצה יוצרת משימה עם כל תתי-המשימות שלה.</div>
   <div class="tk-tpls">${TTPL.map((x,i)=>`<button class="tk-tpl" onclick="tkApplyTpl(${i})">
     <b>${esc(x.n)}</b><span>${x.z} · ${x.s.length} שלבים</span></button>`).join('')}</div>
   <div class="actions"><button class="btn ghost" onclick="closeModal()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function tkApplyTpl(i){
  const x=TTPL[i];
  const t=tkNew({title:x.n,zone:x.z,priority:x.p,due:tkToday(),subs:x.s.map(s=>({t:s,done:false}))});
  tasks().unshift(t);save();closeModal();renderTasks();toast('נוצרה משימה: '+x.n);
}
/* ---------- auto-generated from warehouse events ---------- */
function tkFromAlerts(){
  const G={};
  (state.entries||[]).filter(e=>e.type==='יין שיווק'&&isLabeled(e)).forEach(e=>{
    const k=[e.category,e.vintage||'',e.cooked||''].join('\u0001');
    if(!G[k])G[k]={category:e.category,vintage:e.vintage||'',cooked:e.cooked||'',pallets:0};
    G[k].pallets+=derive(e).pallets;});
  const low=Object.values(G).filter(g=>g.pallets<2);
  if(!low.length){toast('אין התראות מלאי');return;}
  let added=0;
  low.forEach(g=>{
    const title='מלאי נמוך: '+g.category+(g.vintage?' '+g.vintage:'')+(g.cooked?' · '+g.cooked:'')+' — '+g.pallets.toFixed(2)+' משטחים';
    if(tasks().some(t=>t.title===title&&t.status!=='done'))return;
    tasks().unshift(tkNew({title,zone:'ספירת מלאי',priority:'high',due:tkToday(),tags:['מלאי-נמוך'],
      subs:[{t:'לאמת את המלאי בפועל',done:false},{t:'לתכנן תיוות/מילוי',done:false}]}));added++;});
  save();renderTasks();toast(added?('נוצרו '+added+' משימות'):'כל ההתראות כבר קיימות כמשימות');
}
function tkFromRoute(n,date){
  const title='הכנת מסלול הפצה · '+n+' לקוחות'+(date?' · '+date:'');
  if(tasks().some(t=>t.title===title&&t.status!=='done'))return;
  tasks().unshift(tkNew({title,zone:'הכנת הפצה',priority:'high',due:date||tkToday(),tags:['הפצה'],
    subs:TTPL[0].s.map(s=>({t:s,done:false}))}));
  save();
}

