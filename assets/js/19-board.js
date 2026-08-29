/* ============ לוח שבועי / חודשי (כוח אדם ותפעול יומי) ============ */
const BOARDCATS_DEF=['כוח אדם','הפצה','הכנת הפצה','ליקוט','תיוות','אספקה משילה','הערות'];
function boardCats(){if(!Array.isArray(state.boardCats)||!state.boardCats.length)state.boardCats=BOARDCATS_DEF.slice();return state.boardCats;}
function bData(){if(!state.board||typeof state.board!=='object')state.board={};return state.board;}
function bCell(d,c){const b=bData()[d];return (b&&b[c])?b[c]:'';}
function bSet(d,c,v){const b=bData();if(!b[d])b[d]={};if(v)b[d][c]=v;else delete b[d][c];if(!Object.keys(b[d]).length)delete b[d];save();}
function dstr(dt){return localDate(dt);}
function bWeekStart(dt){const d=new Date(dt);d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());return d;}
const DAYNAMES=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
let bWeekOff=0,bMonthOff=0;
function tasksDue(d){return tasks().filter(t=>t.due===d&&t.status!=='done');}

/* ---------- weekly ---------- */
function boardWeekHTML(){
  const ws=bWeekStart(new Date());ws.setDate(ws.getDate()+bWeekOff*7);
  const days=[];for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);days.push(d);}
  const cats=boardCats(),today=tkToday();
  let h=`<div class="bd-nav">
    <button class="btn ghost sm" onclick="bWeekOff--;renderTasks()">‹ שבוע קודם</button>
    <b>${days[0].toLocaleDateString('he-IL',{day:'numeric',month:'long'})} – ${days[6].toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'})}</b>
    <button class="btn ghost sm" onclick="bWeekOff++;renderTasks()">שבוע הבא ›</button>
    ${bWeekOff?`<button class="btn ghost sm" onclick="bWeekOff=0;renderTasks()">היום</button>`:''}
    <button class="btn ghost sm" onclick="bEditCats()">⚙ קטגוריות</button>
  </div>
  <div class="tablewrap"><table class="bdtbl"><thead><tr><th class="bd-cat">קטגוריה</th>
    ${days.map(d=>{const ds=dstr(d);const hol=HOLIDAYS[ds];const n=tasksDue(ds).length;
      return `<th class="${ds===today?'bd-today':''}"><div>${DAYNAMES[d.getDay()]}</div>
        <small>${d.getDate()}/${d.getMonth()+1}</small>
        ${hol?`<div class="bd-hol">${esc(hol)}</div>`:''}
        ${n?`<div class="bd-cnt">${n} משימות</div>`:''}</th>`;}).join('')}
  </tr></thead><tbody>`;
  cats.forEach(c=>{
    h+=`<tr><td class="bd-cat">${esc(c)}</td>`;
    days.forEach(d=>{const ds=dstr(d);
      if(c===SUPPLY_CAT){
        const rows=supplyOf(ds);
        const tu=rows.reduce((s,x)=>s+(+x.units||0),0),tb=rows.reduce((s,x)=>s+(+x.boxes||0),0);
        h+=`<td class="${ds===today?'bd-today':''}"><div class="sup-cell" onclick="openSupplyDay('${ds}')" title="הקש לרישום אספקה">
          ${rows.length?rows.map(r=>`<div class="sup-row"><span>${esc(r.item)}</span><b>${r.units?Math.round(r.units):''}${r.boxes?' · '+Math.round(r.boxes)+' ק':''}</b></div>`).join(''):'<span class="sup-add">+ רישום</span>'}
          ${rows.length>1?`<div class="sup-tot">${Math.round(tu)} יח׳${tb?' · '+Math.round(tb)+' ארגזים':''}</div>`:''}
        </div></td>`;
        return;
      }
      h+=`<td class="${ds===today?'bd-today':''}"><textarea class="bd-ta" rows="2" placeholder="—"
        oninput="bAuto(this)" onchange="bSet('${ds}','${c.replace(/'/g,"\\'")}',this.value)">${esc(bCell(ds,c))}</textarea></td>`;});
    h+=`</tr>`;});
  h+=`</tbody></table></div>`;
  return h;
}
/* ---------- monthly ---------- */
function boardMonthHTML(){
  const base=new Date();base.setDate(1);base.setMonth(base.getMonth()+bMonthOff);
  const y=base.getFullYear(),m=base.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const cells=[];for(let i=0;i<first.getDay();i++)cells.push(null);
  for(let d=1;d<=last.getDate();d++)cells.push(new Date(y,m,d,12));
  const today=tkToday(),main=boardCats()[0];
  let h=`<div class="bd-nav">
    <button class="btn ghost sm" onclick="bMonthOff--;renderTasks()">‹ חודש קודם</button>
    <b>${first.toLocaleDateString('he-IL',{month:'long',year:'numeric'})}</b>
    <button class="btn ghost sm" onclick="bMonthOff++;renderTasks()">חודש הבא ›</button>
    ${bMonthOff?`<button class="btn ghost sm" onclick="bMonthOff=0;renderTasks()">החודש</button>`:''}
    <span class="hint" style="margin:0">מוצג: <b>${esc(main)}</b> · לחיצה על יום פותחת את כל הקטגוריות</span>
  </div>
  <div class="bd-mgrid">${DAYNAMES.map(n=>`<div class="bd-dh">${esc(n)}</div>`).join('')}`;
  cells.forEach(d=>{
    if(!d){h+=`<div class="bd-day bd-empty"></div>`;return;}
    const ds=dstr(d),hol=HOLIDAYS[ds],n=tasksDue(ds).length,txt=bCell(ds,main);
    h+=`<div class="bd-day ${ds===today?'bd-today':''}" onclick="bOpenDay('${ds}')">
      <div class="bd-dnum">${d.getDate()}${hol?`<span class="bd-hol">${esc(hol)}</span>`:''}</div>
      ${txt?`<div class="bd-txt">${esc(txt)}</div>`:''}
      ${n?`<div class="bd-cnt">${n} משימות</div>`:''}</div>`;});
  h+=`</div>`;
  return h;
}
function bOpenDay(ds){
  const cats=boardCats(),box=document.getElementById('modalbox');box.className='box';
  const d=new Date(ds+'T12:00:00');
  const due=tasksDue(ds);
  box.innerHTML=`<h3>${DAYNAMES[d.getDay()]} · ${d.toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'})}</h3>
   ${HOLIDAYS[ds]?`<div class="bd-hol" style="margin-bottom:6px">${esc(HOLIDAYS[ds])}</div>`:''}
   ${cats.map(c=>c===SUPPLY_CAT?`<div class="fld"><label>${esc(c)}</label>
     <button class="btn ghost sm" onclick="closeModal();openSupplyDay('${ds}')">📦 רישום אספקה (${supplyOf(ds).length})</button></div>`:`<div class="fld"><label>${esc(c)}</label>
     <textarea rows="2" onchange="bSet('${ds}','${c.replace(/'/g,"\\'")}',this.value)">${esc(bCell(ds,c))}</textarea></div>`).join('')}
   ${due.length?`<div class="fld"><label>משימות ליום זה (${due.length})</label>
     <div class="bd-dtasks">${due.map(t=>`<div onclick="closeModal();tkOpen(${t.id})"><span class="tk-prio" style="background:${prioOf(t.priority).c}">${prioOf(t.priority).t}</span> ${esc(t.title)}</div>`).join('')}</div></div>`:''}
   <div class="actions"><button class="btn" onclick="closeModal();renderTasks()">שמור וסגור</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function bEditCats(){
  const cats=boardCats(),box=document.getElementById('modalbox');box.className='box';
  box.innerHTML=`<h3>קטגוריות הלוח</h3>
   <div class="hint">השורות שמופיעות בלוח השבועי. הראשונה מוצגת גם בלוח החודשי.</div>
   <table class="itemtbl"><tbody>
   ${cats.map((c,i)=>`<tr><td><input value="${esc(c)}" onchange="bRenameCat(${i},this.value)"></td>
     <td style="width:90px">${i>0?`<button class="btn ghost sm" onclick="bMoveCat(${i},-1)">↑</button>`:''}${i<cats.length-1?`<button class="btn ghost sm" onclick="bMoveCat(${i},1)">↓</button>`:''}</td>
     <td style="width:36px"><button class="del" onclick="bDelCat(${i})">✕</button></td></tr>`).join('')}
   </tbody></table>
   <button class="btn ghost sm" onclick="bAddCat()">+ הוסף קטגוריה</button>
   <div class="actions"><button class="btn" onclick="closeModal();renderTasks()">סגור</button>
     <button class="btn ghost" onclick="state.boardCats=BOARDCATS_DEF.slice();save();bEditCats()">אפס</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function bAddCat(){const n=(prompt('שם הקטגוריה:')||'').trim();if(!n)return;boardCats().push(n);save();bEditCats();}
function bRenameCat(i,v){v=(v||'').trim();if(!v)return;const c=boardCats(),old=c[i];c[i]=v;
  const b=bData();Object.keys(b).forEach(d=>{if(b[d][old]!==undefined){b[d][v]=b[d][old];delete b[d][old];}});
  save();}
function bDelCat(i){const c=boardCats();if(c.length<=1){toast('חייבת להישאר קטגוריה אחת');return;}
  if(!confirm('למחוק את הקטגוריה "'+c[i]+'"? הטקסטים שנרשמו בה יימחקו.'))return;
  const old=c[i];c.splice(i,1);const b=bData();Object.keys(b).forEach(d=>{delete b[d][old];if(!Object.keys(b[d]).length)delete b[d];});
  save();bEditCats();}
function bMoveCat(i,dir){const c=boardCats(),j=i+dir;if(j<0||j>=c.length)return;const t=c[i];c[i]=c[j];c[j]=t;save();bEditCats();}
function bAuto(el){if(!el||!el.style)return;el.style.height='auto';el.style.height=(el.scrollHeight+2)+'px';}

