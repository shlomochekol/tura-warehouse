/* ============ DASHBOARD ============ */
let dashFilter={type:'',category:'',vintage:'',label:''},dashComp='',alertF={};
const COLORHEX={brown:'#9C5A2C',yellow:'#E0AE35',pink:'#E39BB0',black:'#262626',red:'#BE2230',gray:'#9A938E',none:'#cfcfcf'};
function renderDash(){
  const E=state.entries,sum=(a,f)=>a.reduce((s,e)=>s+f(e),0);
  const mk=E.filter(e=>e.type==='יין שיווק');
  const mkP=sum(mk,e=>derive(e).pallets),mkU=sum(mk,e=>+e.units),totU=sum(E,e=>+e.units),totP=sum(E,e=>derive(e).pallets);
  const f=dashFilter,anyF=f.type||f.category||f.vintage||f.label;
  const sel=E.filter(e=>(!f.type||e.type===f.type)&&(!f.category||e.category===f.category)&&(!f.vintage||String(e.vintage)===String(f.vintage))&&(!f.label||(f.label==='מתוות'?isLabeled(e):!isLabeled(e))));
  const selP=sum(sel,e=>derive(e).pallets),selU=sum(sel,e=>+e.units),selB=sum(sel,e=>derive(e).boxes);
  const vints=[...new Set(E.map(e=>e.vintage).filter(Boolean))].sort();
  const cats=[...new Set(E.map(e=>e.category))].sort();
  const base=anyF?sel:E;
  const byCat={};base.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+derive(e).pallets;});
  const catBars=Object.entries(byCat).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>({label:k,value:v}));
  // composition by chosen dimension, summed by UNITS
  const dimGet={'תיוות':e=>isLabeled(e)?'מתוות':'לא מתוות','סוג':e=>e.type,'קטגוריה':e=>e.category,'בציר':e=>e.vintage||'—','מבושל/לא מבושל':e=>e.cooked||'—'};
  const dimKeys=Object.keys(dimGet);if(!dashComp)dashComp='סוג';
  const comp={};E.forEach(e=>{const k=dimGet[dashComp](e);comp[k]=(comp[k]||0)+(+e.units||0);});
  const palette=['#7B1E2B','#C8A24B','#1F3864','#4F7A36','#9C5A2C','#BE2230','#E0AE35','#6B4E9E','#9A938E','#2E8B8B','#B0414E','#3A4A66'];
  const compItems=Object.entries(comp).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>({label:k,value:v,color:palette[i%palette.length]}));
  const ws=weekStart(0);const now=new Date();
  // shipments board
  let board=state.shipments.filter(s=>s.status==='בוצע'||s.status==='בהמתנה');
  /* סינון לפי תקופה */
  let periodLabel='כל התקופות',pFrom='',pTo='';
  if(shipPeriod!=='all'){
    const n=new Date();
    if(shipPeriod==='week'){const ws=weekStart(shipOff);const we=new Date(ws);we.setDate(ws.getDate()+6);
      pFrom=localDate(ws);pTo=localDate(we);
      periodLabel=ws.toLocaleDateString('he-IL',{day:'numeric',month:'short'})+'–'+we.toLocaleDateString('he-IL',{day:'numeric',month:'short'});}
    else if(shipPeriod==='month'){const m0=new Date(n.getFullYear(),n.getMonth()+shipOff,1);
      pFrom=localDate(m0);pTo=localDate(new Date(m0.getFullYear(),m0.getMonth()+1,0));
      periodLabel=m0.toLocaleDateString('he-IL',{month:'long',year:'numeric'});}
    else{const y=n.getFullYear()+shipOff;pFrom=y+'-01-01';pTo=y+'-12-31';periodLabel=String(y);}
    board=board.filter(s=>{const d=String(s.shipdate||'');return d&&d>=pFrom&&d<=pTo;});
  }
  const nDone=board.filter(s=>s.status==='בוצע').length,nPend=board.filter(s=>s.status==='בהמתנה').length;
  // tasks
  const taskCount=(from,to)=>{
    let n=0;
    (state.tasks2||[]).forEach(t=>{
      if(!t||t.status==='done')return;
      const dt=parseD(t.due);
      if(dt&&dt>=from&&dt<=to)n++;
    });
    /* גם רישומים בלוח השבועי/חודשי */
    Object.entries(state.board||{}).forEach(([day,cats])=>{
      const dt=parseD(day);
      if(dt&&dt>=from&&dt<=to&&cats&&Object.values(cats).some(v=>String(v||'').trim()))n++;
    });
    return n;};
  const we=new Date(ws);we.setDate(ws.getDate()+6);
  const m0=new Date(now.getFullYear(),now.getMonth(),1),m1=new Date(now.getFullYear(),now.getMonth()+1,0);
  // alerts + filters
  const adefs=[{key:'category',label:'קטגוריה',get:e=>e.category,values:distinct(E,e=>e.category)},
   {key:'vintage',label:'בציר',get:e=>e.vintage,values:distinct(E,e=>e.vintage)},
   {key:'cooked',label:'מבושל/לא',get:e=>e.cooked,values:COOKED}];
  /* התראות: רק יין שיווק מתוות, מסוכם לפי קטגוריה+בציר+מבושל, פחות מ-2 משטחים */
  const AGG={};
  E.filter(e=>e.type==='יין שיווק'&&isLabeled(e)&&passF(e,adefs,alertF)).forEach(e=>{
    const k=[e.category,e.vintage||'',e.cooked||''].join('\u0001');
    const d=derive(e);
    if(!AGG[k])AGG[k]={category:e.category,vintage:e.vintage||'',cooked:e.cooked||'',units:0,boxes:0,pallets:0,spots:0};
    AGG[k].units+=+e.units||0;AGG[k].boxes+=d.boxes;AGG[k].pallets+=d.pallets;AGG[k].spots++;
  });
  const alertGroups=Object.values(AGG).filter(g=>g.pallets<2).sort((a,b)=>a.pallets-b.pallets);
  const flagged=[];

  let h=`<div class="dashhead"><div><h2 style="color:var(--wine);margin:0">סקירת מחסן</h2><div class="hint" style="margin:0">${new Date().toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div>
     <span class="exp">⬇ <button class="btn ghost sm" onclick="exportScreenImg('v-dash','דשבורד')">תמונה</button></span></div>

   <div class="kpis">
    ${kpi('יין שיווק · משטחים',mkP.toFixed(1),'🍷','var(--gold)')}
    ${kpi('יין שיווק · יחידות',Math.round(mkU).toLocaleString(),'📦','var(--wine)')}
    ${kpi('סה"כ יחידות · כל היינות',Math.round(totU).toLocaleString(),'🗄️','var(--navy)')}
    ${kpi('סה"כ משטחים',totP.toFixed(0),'🧱','#4F7A36')}
   </div>

   <div class="panel wide-panel"><h2>הרכב המלאי</h2><div class="bar"><label class="flt"><span>חלוקה לפי</span>
      <select onchange="dashComp=this.value;renderDash()">${dimKeys.map(k=>`<option ${dashComp===k?'selected':''}>${esc(k)}</option>`).join('')}</select></label>
      <span class="hint" style="margin:0">לפי יחידות</span></div>${donut(compItems,'יח׳')}</div>
    ${typeof supplyPanelHTML==='function'?supplyPanelHTML():''}

   <div class="panel"><h2>חקירת נתונים</h2><div class="hint">שלב מסננים — למשל יין שיווק · קברנה סוביניון · 2023 · מתוות.</div>
    <div class="bar">
     <select onchange="dashFilter.type=this.value;renderDash()"><option value="">כל הסוגים</option>${TYPES.map(t=>`<option ${f.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
     <select onchange="dashFilter.category=this.value;renderDash()"><option value="">כל הקטגוריות</option>${cats.map(t=>`<option ${f.category===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
     <select onchange="dashFilter.vintage=this.value;renderDash()"><option value="">כל הבצירים</option>${vints.map(t=>`<option ${String(f.vintage)===String(t)?'selected':''}>${esc(t)}</option>`).join('')}</select>
     <select onchange="dashFilter.label=this.value;renderDash()"><option value="">תיוות: הכל</option><option ${f.label==='מתוות'?'selected':''}>מתוות</option><option ${f.label==='לא מתוות'?'selected':''}>לא מתוות</option></select>
     <button class="btn ghost" onclick="dashFilter={type:'',category:'',vintage:'',label:''};renderDash()">נקה</button></div>
    <div class="kpis k3" style="margin:4px 0 14px">
     ${kpi('משטחים',selP.toFixed(1),'','var(--gold)')}${kpi('ארגזים',Math.round(selB).toLocaleString(),'','var(--wine)')}${kpi('יחידות',Math.round(selU).toLocaleString(),'','var(--navy)')}${kpi('מק"טים',sel.length,'','#4F7A36')}</div>
    <div class="seg"><b>משטחים לפי קטגוריה${anyF?' (בבחירה)':''}</b></div>${bars(catBars)}</div>

   <div class="grid2">
    <div class="panel"><h2>התראות מלאי</h2>
     <div class="hint">יין שיווק <b>מתוות</b> בלבד — סכום כל המשטחים לפי קטגוריה, בציר ומבושל. מוצג כאשר סה"כ קטן מ-2 משטחים.</div>
     <div class="kpis k2" style="margin-bottom:8px">${kpi('⚠ מתחת ל-2 משטחים',alertGroups.length,'','var(--warn)')}${kpi('סה"כ משטחים בהתראה',alertGroups.reduce((t,g)=>t+g.pallets,0).toFixed(2),'','#B58A1E')}</div>
     ${filterControls(adefs,alertF,'alertFilter')}
     <div class="tablewrap" style="max-height:260px"><table><thead><tr><th>קטגוריה</th><th>בציר</th><th>מבושל/לא</th><th>יחידות</th><th>ארגזים</th><th>משטחים</th><th>מיקומים</th></tr></thead><tbody>
     ${alertGroups.length?alertGroups.map(g=>`<tr class="warn-row"><td>${esc(g.category)}</td><td>${esc(g.vintage||'—')}</td><td>${cookTag(g.cooked)}</td><td>${Math.round(g.units).toLocaleString()}</td><td>${g.boxes.toFixed(1)}</td><td><b>${g.pallets.toFixed(2)}</b></td><td>${esc(g.spots)}</td></tr>`).join(''):'<tr><td colspan=7>אין התראות — לכל יין שיווק מתוות יש 2 משטחים ומעלה.</td></tr>'}</tbody></table></div></div>

    <div class="panel"><h2>לוח משלוחים</h2>
     <div class="bar"><label class="flt"><span>תקופה</span>
       <select onchange="shipPeriod=this.value;shipOff=0;renderDash()">
         <option value="all" ${shipPeriod==='all'?'selected':''}>הכל</option>
         <option value="week" ${shipPeriod==='week'?'selected':''}>שבוע</option>
         <option value="month" ${shipPeriod==='month'?'selected':''}>חודש</option>
         <option value="year" ${shipPeriod==='year'?'selected':''}>שנה</option></select></label>
       ${shipPeriod!=='all'?`<button class="btn ghost sm" onclick="shipOff--;renderDash()">‹</button>
         <span class="hint" style="margin:0"><b>${esc(periodLabel)}</b></span>
         <button class="btn ghost sm" onclick="shipOff++;renderDash()">›</button>
         ${shipOff!==0?`<button class="btn ghost sm" onclick="shipOff=0;renderDash()">היום</button>`:''}`:''}
       <span class="hint" style="margin:0">${board.length} משלוחים</span></div>
     <div class="chips"><span class="chip chip-ok">בוצע · ${nDone}</span><span class="chip chip-wait">בהמתנה · ${nPend}</span></div>
     <div class="tablewrap" style="max-height:260px;margin-top:8px"><table><thead><tr><th>שם לקוח</th><th>תאריך משלוח</th><th>קטגוריה</th><th>יחידות</th><th>כמות משטחים</th><th>סטטוס</th></tr></thead><tbody>
     ${board.length?board.slice().sort((a,b)=>(parseD(a.shipdate)||0)-(parseD(b.shipdate)||0)).map(s=>{const d=parseD(s.shipdate);const days=d?Math.ceil((d-new Date().setHours(0,0,0,0))/86400000):null;const soon=(s.status==='בהמתנה'&&days!==null&&days>=0&&days<=7);
        const c=shipCalc(s);
        return `<tr class="${soon?'warn-row':''}"><td>${soon?'⏰ ':''}${s.client||'—'}</td><td>${s.shipdate||'—'}</td><td>${esc(s.category||'')}</td><td>${c.units?Math.round(c.units).toLocaleString():'—'}</td><td>${c.pallets?c.pallets.toFixed(2):'—'}</td><td><span class="chip ${s.status==='בוצע'?'chip-ok':'chip-wait'}">${esc(s.status)}</span></td></tr>`;}).join(''):'<tr><td colspan=6>אין משלוחים פעילים.</td></tr>'}</tbody></table></div></div></div>`;
  document.getElementById('v-dash').innerHTML=h;
}
/* חישוב ארגזים/משטחים למשלוח — זהה למסך "משלוחים" */
let shipPeriod='all',shipOff=0;
function shipCalc(s){
  /* אם הוזן תיוות במשלוח — לפיו. אחרת ברירת מחדל: מתוות (סחורה יוצאת) */
  const b=bpb(s.category,s.label||'מתוות');
  const units=+s.units||0;
  const boxes=units/b;
  const pallets=boxes/bpp(s.category);
  return {units,boxes,pallets};
}
function alertFilter(k,v){if(k==='__clear__'){alertF={};}else{alertF[k]=v;}renderDash();}
function kpi(k,v,icon,accent){return `<div class="kpi" style="--ac:${accent}"><div class="kpi-k">${esc(k)}</div><div class="kpi-v">${esc(v)}</div>${icon?`<div class="kpi-i">${esc(icon)}</div>`:''}</div>`;}
function emptyChart(msg){return `<div class="empty-chart">📊 ${msg}</div>`;}
function bars(items){const max=Math.max(1,...items.map(i=>i.value));
  if(!items.length||max<=0)return '<div class="empty-chart">אין נתונים בבחירה זו.</div>';
  return '<div class="bars">'+items.map(i=>`<div class="brow"><div class="blab" title="${esc(i.label)}">${esc(i.label)}</div><div class="btrack"><div class="bfill" style="width:${Math.round(i.value/max*100)}%"></div></div><div class="bval">${i.value%1?i.value.toFixed(1):i.value}</div></div>`).join('')+'</div>';}
function svgCols(items,color){const max=Math.max(1,...items.map(i=>i.value));const W=Math.max(320,items.length*64+30),H=170,pad=26,bw=34;
  let g='';for(let i=0;i<=3;i++){const y=pad+(H-2*pad)*i/3;g+=`<line x1="20" y1="${y}" x2="${W-10}" y2="${y}" stroke="#EadFce" stroke-width="1"/>`;}
  let bars='';items.forEach((it,i)=>{const x=30+i*64;const bh=(H-2*pad)*(it.value/max);const y=H-pad-bh;
    bars+=`<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0,bh)}" rx="4" fill="${color}"/>
      <text x="${x+bw/2}" y="${y-5}" text-anchor="middle" font-size="11" font-weight="700" fill="#5A1620">${it.value%1?it.value.toFixed(1):it.value}</text>
      <text x="${x+bw/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="#6b5e57">${esc(it.label)}</text>`;});
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="max-height:180px">${g}${bars}</svg>`;}
function donut(items,unit){if(!items.length)return '<div class="empty-chart">אין נתונים.</div>';
  const u=unit||'מ׳';const tot=items.reduce((s,i)=>s+(+i.value||0),0);
  if(!tot)return '<div class="empty-chart">אין נתונים בבחירה זו.</div>';
  let acc=0;const stops=items.map(i=>{const a=acc/tot*360;acc+=i.value;const b=acc/tot*360;return `${i.color} ${a}deg ${b}deg`;}).join(',');
  const leg=items.slice().sort((a,b)=>b.value-a.value).map(i=>`<div class="lgi"><span class="sw" style="background:${i.color}"></span>${i.label} · <b>${Math.round(i.value).toLocaleString()}</b> ${u} <span class="pct">(${(()=>{const v=i.value/tot*100;
    return v>=10?Math.round(v):(v>=1?v.toFixed(1):(v>0?v.toFixed(2):'0'));})()}%)</span></div>`).join('');
  return `<div class="donutwrap"><div class="donut" style="background:conic-gradient(${stops})"><div class="donut-h"><span>${tot>=1000?Math.round(tot/1000)+'k':Math.round(tot)}</span><small>${esc(u)}</small></div></div><div class="donut-leg">${leg}</div></div>`;}

