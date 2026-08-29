/* ============ אספקה משילה ============ */
const SUPPLY_CAT='אספקה משילה';
function supplyItems(){
  if(!Array.isArray(state.supplyItems)||!state.supplyItems.length)
    state.supplyItems=['יין','שמן זית','בקבוקים ריקים','ארגזים','פקקים','מדבקות'];
  return state.supplyItems;
}
function supply(){if(!Array.isArray(state.supply))state.supply=[];return state.supply;}
function supplyOf(date){return supply().filter(x=>x.date===date);}
function supplyTotals(from,to){
  const agg={};
  supply().forEach(s=>{
    if(from&&s.date<from)return; if(to&&s.date>to)return;
    if(!agg[s.item])agg[s.item]={item:s.item,units:0,boxes:0,n:0};
    agg[s.item].units+=+s.units||0;agg[s.item].boxes+=+s.boxes||0;agg[s.item].n++;
  });
  return Object.values(agg).sort((a,b)=>b.units-a.units);
}
/* ---------- הזנה ליום ---------- */
function openSupplyDay(date){
  const box=document.getElementById('modalbox');box.className='box';
  const items=supplyItems(),rows=supplyOf(date);
  const val=(it,f)=>{const r=rows.find(x=>x.item===it);return r?(r[f]||''):'';};
  box.innerHTML=`<h3>אספקה משילה · ${esc(date)}</h3>
   <div class="hint">רושמים כמה התקבל מכל פריט. הנתונים מסוכמים בדשבורד לפי שבוע וחודש.</div>
   <table class="itemtbl" style="margin-top:8px"><thead><tr><th>פריט</th><th>יחידות</th><th>ארגזים</th></tr></thead><tbody>
   ${items.map(it=>`<tr><td>${esc(it)}</td>
     <td><input type="number" min="0" style="width:90px" value="${val(it,'units')}" onchange="setSupply('${date}','${it.replace(/'/g,"\\'")}','units',this.value)"></td>
     <td><input type="number" min="0" style="width:90px" value="${val(it,'boxes')}" onchange="setSupply('${date}','${it.replace(/'/g,"\\'")}','boxes',this.value)"></td></tr>`).join('')}
   </tbody></table>
   <div class="actions"><button class="btn" onclick="closeModal();renderTasks();if(document.getElementById('v-dash').innerHTML)renderDash()">שמור וסגור</button>
     <button class="btn ghost" onclick="openSupplyItems()">⚙ ערוך פריטים</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function setSupply(date,item,field,v){
  const n=parseFloat(v)||0;
  const S=supply();
  let r=S.find(x=>x.date===date&&x.item===item);
  if(!r){ if(!n)return; r={id:Date.now()+Math.floor(Math.random()*999),date,item,units:0,boxes:0};S.push(r); }
  r[field]=n;
  if(!r.units&&!r.boxes)state.supply=S.filter(x=>x!==r);
  save();
}
/* ---------- עריכת הפריטים (כותרות המשנה) ---------- */
function openSupplyItems(){
  const box=document.getElementById('modalbox');box.className='box';
  const items=supplyItems();
  box.innerHTML=`<h3>פריטי אספקה משילה</h3>
   <div class="hint">כותרות המשנה שמופיעות בהזנה היומית ובדשבורד.</div>
   <table class="itemtbl"><tbody>
   ${items.map((it,i)=>`<tr><td><input value="${esc(it)}" onchange="renameSupplyItem(${i},this.value)"></td>
     <td style="width:86px">${i>0?`<button class="btn ghost sm" onclick="moveSupplyItem(${i},-1)">↑</button>`:''}${i<items.length-1?`<button class="btn ghost sm" onclick="moveSupplyItem(${i},1)">↓</button>`:''}</td>
     <td style="width:34px"><button class="del" onclick="delSupplyItem(${i})">✕</button></td></tr>`).join('')}
   </tbody></table>
   <button class="btn ghost sm" onclick="addSupplyItem()">+ הוסף פריט</button>
   <div class="actions"><button class="btn" onclick="closeModal();renderTasks()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function addSupplyItem(){const n=(prompt('שם הפריט:')||'').trim();if(!n)return;supplyItems().push(n);save();openSupplyItems();}
function renameSupplyItem(i,v){v=(v||'').trim();if(!v)return;
  const items=supplyItems(),old=items[i];items[i]=v;
  supply().forEach(s=>{if(s.item===old)s.item=v;});save();}
function moveSupplyItem(i,dir){
  const items=supplyItems(),j=i+dir;
  if(j<0||j>=items.length)return;
  const t=items[i];items[i]=items[j];items[j]=t;
  save();openSupplyItems();
}
function delSupplyItem(i){const items=supplyItems();
  if(items.length<=1){toast('חייב להישאר פריט אחד');return;}
  if(!confirm('למחוק את "'+items[i]+'"? הרישומים שלו יימחקו.'))return;
  const old=items[i];items.splice(i,1);
  state.supply=supply().filter(s=>s.item!==old);save();openSupplyItems();}
/* ---------- פאנל בדשבורד ---------- */
let supplyView='week',supplyOff=0;
function supplyPanelHTML(){
  const now=new Date();
  let from,to,label;
  if(supplyView==='week'){
    const ws=weekStart(supplyOff);const we=new Date(ws);we.setDate(ws.getDate()+6);
    from=localDate(ws);to=localDate(we);
    label=(supplyOff===0?'השבוע · ':(supplyOff===-1?'שבוע שעבר · ':(supplyOff===1?'שבוע הבא · ':'')))+
      ws.toLocaleDateString('he-IL',{day:'numeric',month:'short'})+'–'+we.toLocaleDateString('he-IL',{day:'numeric',month:'short'});
  }else if(supplyView==='month'){
    const m0=new Date(now.getFullYear(),now.getMonth()+supplyOff,1);
    from=localDate(m0);
    to=localDate(new Date(m0.getFullYear(),m0.getMonth()+1,0));
    label=(supplyOff===0?'החודש · ':'')+m0.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  }else{from='';to='';label='כל התקופה';}
  const T=supplyTotals(from,to);
  const tu=T.reduce((s,x)=>s+x.units,0),tb=T.reduce((s,x)=>s+x.boxes,0);
  /* מגמה לפי תאריכים — כל עמודה יום אחד, כך שרואים בדיוק מתי הייתה אספקה */
  const trend=[];
  if(supplyView==='all'){
    /* בתצוגת "הכל" — רק הימים שבהם באמת הייתה אספקה */
    const byDay={};
    supply().forEach(x=>{byDay[x.date]=(byDay[x.date]||0)+(+x.units||0);});
    Object.keys(byDay).sort().slice(-14).forEach(d=>{
      const dt=new Date(d+'T12:00:00');
      trend.push({label:dt.getDate()+'/'+(dt.getMonth()+1),value:byDay[d]});
    });
  }else{
    /* שבוע = 7 ימים · חודש = כל ימי החודש */
    const start=new Date(from+'T12:00:00'),end=new Date(to+'T12:00:00');
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      const ds=localDate(d);
      const tot=supply().filter(x=>x.date===ds).reduce((a,x)=>a+(+x.units||0),0);
      trend.push({label:d.getDate()+'/'+(d.getMonth()+1),value:tot});
    }
  }
  return `<div class="panel"><h2>אספקה משילה</h2>
    <div class="bar"><label class="flt"><span>תצוגה</span>
      <select onchange="supplyView=this.value;supplyOff=0;renderDash()">
        <option value="week" ${supplyView==='week'?'selected':''}>השבוע</option>
        <option value="month" ${supplyView==='month'?'selected':''}>החודש</option>
        <option value="all" ${supplyView==='all'?'selected':''}>הכל</option></select></label>
      ${supplyView!=='all'?`<button class="btn ghost sm" onclick="supplyOff--;renderDash()" title="אחורה">‹</button>`:''}
      <span class="hint" style="margin:0"><b>${esc(label)}</b></span>
      ${supplyView!=='all'?`<button class="btn ghost sm" onclick="supplyOff++;renderDash()" title="קדימה">›</button>`:''}
      ${(supplyView!=='all'&&supplyOff!==0)?`<button class="btn ghost sm" onclick="supplyOff=0;renderDash()">היום</button>`:''}
      <button class="btn ghost sm" onclick="openSupplyDay(localDate())">+ רישום להיום</button></div>
    <div class="kpis k2" style="margin:8px 0">
      ${kpi('סה"כ יחידות',Math.round(tu).toLocaleString(),'','var(--navy)')}
      ${kpi('סה"כ ארגזים',Math.round(tb).toLocaleString(),'','var(--gold-d)')}</div>
    ${T.length?`<div class="tablewrap" style="max-height:220px"><table><thead><tr>
      <th>פריט</th><th>יחידות</th><th>ארגזים</th><th>רישומים</th></tr></thead><tbody>
      ${T.map(x=>`<tr><td>${esc(x.item)}</td><td><b>${Math.round(x.units).toLocaleString()}</b></td>
        <td>${Math.round(x.boxes).toLocaleString()}</td><td style="color:var(--muted)">${esc(x.n)}</td></tr>`).join('')}
      </tbody></table></div>`:`<div class="hint" style="padding:14px;text-align:center">אין רישומי אספקה בתקופה זו.</div>`}
    ${trend.some(x=>x.value)?`<div class="seg" style="margin-top:10px"><b>${supplyView==='all'?'ימי אספקה אחרונים':'לפי יום'} · יחידות</b>
      <span class="hint" style="margin:0 6px">כל עמודה = תאריך</span></div>
      ${svgCols(trend,'var(--gold)')}`:''}
  </div>`;
}
