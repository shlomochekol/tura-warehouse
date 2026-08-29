/* ============ MAP ============ */
let mapSearch='',pickId=null;
function gridRows(){return state.grid?state.grid.rows:13;}
function gridCols(){return state.grid?state.grid.cols:15;}
function addRow(){state.grid.rows++;save();renderMap();}
function delRow(){const r=state.grid.rows;if(r<=6){toast('מינימום 6 שורות');return;}if(state.entries.some(e=>e.prow===r)){toast('יש משטחים בשורה האחרונה');return;}state.grid.rows--;save();renderMap();}
function addCol(){state.grid.cols++;save();renderMap();}
function delCol(){const c=state.grid.cols;if(c<=8){toast('מינימום 8 עמודות');return;}if(state.entries.some(e=>e.pcol===c)){toast('יש משטחים בעמודה האחרונה');return;}state.grid.cols--;save();renderMap();}
/* שני סרגלי הגלילה נעים יחד */
let _mapSyncing=false;
function mapSyncTop(el){if(_mapSyncing)return;_mapSyncing=true;
  const m=document.querySelector('#v-map .mapscroll');
  if(m&&m.scrollLeft!==el.scrollLeft)m.scrollLeft=el.scrollLeft;
  _mapSyncing=false;}
function mapSyncBottom(el){if(_mapSyncing)return;_mapSyncing=true;
  const t=document.querySelector('#v-map .mapscroll-top');
  if(t&&t.scrollLeft!==el.scrollLeft)t.scrollLeft=el.scrollLeft;
  _mapSyncing=false;}
function mapSizeTopBar(){
  const m=document.querySelector('#v-map .mapscroll'),t=document.querySelector('#v-map .mapscroll-top');
  if(!m||!t)return;
  const sp=t.querySelector('.mapscroll-spacer');
  if(sp)sp.style.width=m.scrollWidth+'px';
  t.style.display=(m.scrollWidth>m.clientWidth+4)?'block':'none';
}
function renderMap(){
  const ROWS=gridRows(),COLS=gridCols();
  const leg=Object.entries({brown:'MP/בלק/פורטורא',yellow:'סנואו/ואלי/פינו',pink:'רוזה',black:'שרדונה/שיראז',red:'ויסטה/הרטלנד/סובניון/דולצ\'טו/לימיטד',gray:'מרלו/קב"ס/פרנק'}).map(([k,v])=>`<span class="tag c-${k}">${COLORNAME[k]}: ${v}</span>`).join('');
  let h=`<div class="panel"><h2>מפת מחסן חזותית</h2>
   <div class="hint">בכל מיקום עד 3 מפלסים (תחתון/אמצע/עליון). גרור משטח לתא אחר כדי להזיז — או הקש על משטח ואז על היעד. כל הזזה מתעדכנת ב"מיקום במחסן". ✓ = מתוות.</div>
   <div class="bar">
     <input type="search" id="mapsearch" placeholder="חיפוש: קטגוריה / בציר / קוד / שורה-עמודה (2-3)" value="${esc(mapSearch)}" oninput="mapSearch=this.value;highlightMap()" style="min-width:240px">
     <button class="btn ghost sm" onclick="exportMapImg()">⬇ הורד מפה</button>
     <button class="btn ghost sm" onclick="printMap()">🖨️ הדפס מפה</button>
     <span class="gridctl">שורות: <button onclick="delRow()">−</button><b>${esc(ROWS)}</b><button onclick="addRow()">+</button></span>
     <span class="gridctl">עמודות: <button onclick="delCol()">−</button><b>${esc(COLS)}</b><button onclick="addCol()">+</button></span>
     ${pickId?'<span class="pillmove">משטח נבחר — הקש על תא יעד · <a href="#" onclick="pickId=null;renderMap();return false">ביטול</a></span>':''}</div>
   <div class="maplegend">${leg}</div>`;
  /* סרגל גלילה אופקי גם מעל המפה — לא רק מתחתיה */
  h+=`<div class="mapscroll-top" onscroll="mapSyncTop(this)"><div class="mapscroll-spacer"></div></div>`;
  h+=`<div class="mapscroll" onscroll="mapSyncBottom(this)"><div class="floor" style="grid-template-columns:46px repeat(${COLS},minmax(126px,1fr))">`;
  h+=`<div class="cell colhdr corner">שו׳</div>`;for(let c=1;c<=COLS;c++)h+=`<div class="cell colhdr">${esc(c)}</div>`;
  const renderRow=(r)=>{
    h+=`<div class="cell rowlabel">${rowLabel(r)}</div>`;
    for(let c=1;c<=COLS;c++){
      if(isMachine(r,c)){if(r===7&&c===1)h+=machineCell();continue;}
      if(isTable(r,c)){if(r===6)h+=`<div class="cell fixture tablefx" style="grid-row:span 3">שולחן עבודה</div>`;continue;}
      /* אזורי מעבר — ניתנים לשיבוץ כמו כל מיקום, עם סימון ויזואלי */
      if(isAisle(r,c)){h+=slotCell(r,c,'aislecell');continue;}
      h+=slotCell(r,c);
    }
  };
  for(let r=1;r<=Math.min(5,ROWS);r++)renderRow(r);
  if(ROWS>=6){
    /* פס הכניסה — צר, ומעליו אפשר לשבץ */
    /* שורת הכניסה — משבצות רגילות עם סימון, כדי שאפשר יהיה לשבץ גם שם */
    h+=`<div class="cell rowlabel entrance-lbl" title="אזור הכניסה למחסן">כניסה</div>`;
    for(let c=1;c<=COLS;c++)h+=slotCell(ENTRANCE_ROW,c,'entrancecell');
  }
  for(let r=6;r<=ROWS;r++)renderRow(r);
  h+=`</div></div></div>`;
  document.getElementById('v-map').innerHTML=h;
  setTimeout(mapSizeTopBar,0);
  setTimeout(highlightMap,0);
}
function machineCell(){return `<div class="cell fixture machinefx" style="grid-column:span 3;grid-row:span 2">
  <svg viewBox="0 0 90 50" width="86" height="46" aria-label="מכונת תיוות">
   <rect x="6" y="10" width="58" height="30" rx="3" fill="#d9c7ec" stroke="#fff" stroke-width="1.5"/>
   <rect x="64" y="18" width="18" height="14" rx="2" fill="#b79de0" stroke="#fff"/>
   <circle cx="22" cy="25" r="9" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="22" cy="25" r="3" fill="#fff"/>
   <circle cx="46" cy="25" r="7" fill="none" stroke="#fff" stroke-width="2.5"/>
   <rect x="33" y="20" width="11" height="9" fill="#fff" opacity=".85"/>
   <line x1="6" y1="42" x2="82" y2="42" stroke="#fff" stroke-width="2.5"/></svg>
  <span>מכונת התיוות</span></div>`;}
function slotCell(r,c,extraCls){
  let inner='';
  for(let lv=3;lv>=1;lv--){
    const e=entryAt(r,c,lv);
    if(e){const col=colorOf(e.category);
      inner+=`<div class="lvl" style="${colorStyle(col)}" draggable="true" data-id="${esc(e.id)}" ondragstart="onDragStart(event,${e.id})" onclick="onPick(event,${e.id})" title="${esc(LEVELNAME[lv])}">
        ${isLabeled(e)?'<span class="bdg">✓</span>':''}
        <span class="ln">${esc(e.category)}</span><span class="lv">${esc(e.vintage||'')}</span>${e.cooked?`<span class="ckchip ${e.cooked==='מבושל'?'ck-r':'ck-b'}">${esc(e.cooked)}</span>`:''}<span class="bk">${brk(e)}</span></div>`;
    } else {
      inner+=`<div class="lvl empty" ondragover="event.preventDefault()" ondrop="event.stopPropagation();onDrop(event,${r},${c},${lv})" onclick="onDropClick(${r},${c},${lv})" title="${pickId?'הקש לשיבוץ המשטח שנבחר':'הקש כדי לשבץ פריט כאן'}">${pickId?'↓ שבץ כאן':'+ שבץ'}</div>`;
    }
  }
  const cls=(isShelf(r,c)?'slotwrap shelfwrap':'slotwrap')+(extraCls?' '+extraCls:'');
  return `<div class="cell ${cls}" data-cell="${r}-${c}" ondragover="event.preventDefault()" ondrop="onDrop(event,${r},${c},0)">${inner}</div>`;
}
function onDragStart(ev,id){ev.dataTransfer.setData('text/plain',id);pickId=id;}
function onDrop(ev,r,c,lv){ev.preventDefault();const id=pickId||+ev.dataTransfer.getData('text/plain');moveEntry(id,r,c,lv);pickId=null;}
function onPick(ev,id){ev.stopPropagation();if(pickId===id){pickId=null;}else{pickId=id;}renderMap();}
function onDropClick(r,c,lv){
  if(pickId){moveEntry(pickId,r,c,lv);pickId=null;return;}
  openAssign(r,c,lv);
}
/* ============ שיבוץ פריט למשבצת פנויה ============ */
let _asgQ='',_asgType='',_asgCat='',_asgOnly=true;
function assignCandidates(){
  return (state.entries||[]).filter(e=>{
    if(_asgOnly&&(+e.prow>0&&+e.pcol>0))return false;      // רק פריטים ללא מיקום
    if(_asgType&&e.type!==_asgType)return false;
    if(_asgCat&&e.category!==_asgCat)return false;
    if(_asgQ){
      const hay=[e.category,e.vintage,e.type,e.cooked,e.label,e.notes].join(' ').toLowerCase();
      if(hay.indexOf(_asgQ.toLowerCase())<0)return false;
    }
    return true;
  });
}
function openAssign(r,c,lv){
  const box=document.getElementById('modalbox');box.className='box';
  const L=assignCandidates();
  const unplaced=(state.entries||[]).filter(e=>!(+e.prow>0&&+e.pcol>0)).length;
  const types=distinct(state.entries||[],e=>e.type),cats=distinct(state.entries||[],e=>e.category);
  box.innerHTML=`<h3>שיבוץ למיקום ${r}-${c} · ${LEVELNAME[lv]||''}</h3>
   <div class="hint">בחר פריט לשיבוץ במשבצת הזו. ${unplaced?('<b>'+unplaced+'</b> פריטים ממתינים לשיבוץ.'):'כל הפריטים כבר משובצים.'}</div>
   <div class="tk-row3" style="margin-top:8px">
     <div class="fld"><label>חיפוש</label><input id="asg_q" value="${esc(_asgQ)}" placeholder="קטגוריה / בציר…" oninput="_asgQ=this.value;asgRefresh(${r},${c},${lv})"></div>
     <div class="fld"><label>סוג</label><select onchange="_asgType=this.value;openAssign(${r},${c},${lv})">
       <option value="">הכל</option>${types.map(t=>`<option ${_asgType===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
     <div class="fld"><label>קטגוריה</label><select onchange="_asgCat=this.value;openAssign(${r},${c},${lv})">
       <option value="">הכל</option>${cats.map(x=>`<option ${_asgCat===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
   </div>
   <label class="chk" style="margin:4px 0"><input type="checkbox" ${_asgOnly?'checked':''} onchange="_asgOnly=this.checked;openAssign(${r},${c},${lv})"> הצג רק פריטים ללא מיקום</label>
   <div id="asg_list">${assignListHTML(L,r,c,lv)}</div>
   <div class="actions">
     <button class="btn ghost" onclick="closeModal();addEntryAt(${r},${c},${lv})">+ פריט חדש כאן</button>
     <button class="btn ghost" onclick="closeModal()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
  const q=document.getElementById('asg_q');if(q&&_asgQ){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
function assignListHTML(L,r,c,lv){
  if(!L.length)return `<div class="hint" style="padding:14px;text-align:center">אין פריטים מתאימים.</div>`;
  return `<div class="tablewrap" style="max-height:300px"><table><thead><tr>
    <th>קטגוריה</th><th>בציר</th><th>סוג</th><th>מבושל</th><th>תיוות</th><th>יחידות</th><th>מיקום</th><th></th></tr></thead><tbody>
    ${L.slice(0,120).map(e=>`<tr>
      <td>${esc(e.category||'')}</td><td>${esc(e.vintage||'')}</td><td>${esc(e.type||'')}</td>
      <td>${esc(e.cooked||'')}</td><td>${esc(e.label||'')}</td>
      <td>${Math.round(+e.units||0).toLocaleString()}</td>
      <td>${(+e.prow>0)?(e.prow+'-'+e.pcol):'—'}</td>
      <td><button class="btn sm" onclick="assignTo(${e.id},${r},${c},${lv})">שבץ</button></td></tr>`).join('')}
    ${L.length>120?`<tr><td colspan=8 style="color:var(--muted)">…ועוד ${L.length-120}</td></tr>`:''}
    </tbody></table></div>`;
}
function asgRefresh(r,c,lv){const el=document.getElementById('asg_list');if(el)el.innerHTML=assignListHTML(assignCandidates(),r,c,lv);}
function assignTo(id,r,c,lv){
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
  if(entryAt(r,c,lv)){toast('המשבצת כבר תפוסה');return;}
  e.prow=r;e.pcol=c;e.plevel=lv;
  save();closeModal();refresh();
  toast(e.category+(e.vintage?' '+e.vintage:'')+' שובץ ל-'+r+'-'+c);
}
function addEntryAt(r,c,lv){
  const id=Math.max(0,...state.entries.map(e=>+e.id||0))+1;
  state.entries.push({id,code:'',origin:'',series:'',category:WINECATS[0],vintage:'',type:TYPES[0],
    cooked:'',label:'',units:0,prow:r,pcol:c,plevel:lv,notes:'',
    capsule:capOf(WINECATS[0])[0],capcolor:capOf(WINECATS[0])[1],color:colorOf(WINECATS[0])});
  save();refresh();toast('נוצר פריט חדש ב-'+r+'-'+c+' — עדכן אותו במסך מיקום במחסן');
}
function moveEntry(id,r,c,lv){
  const e=state.entries.find(x=>x.id===id);if(!e)return;
  if(!lv){const occ=[1,2,3].filter(l=>entryAt(r,c,l));lv=[1,2,3].find(l=>!entryAt(r,c,l))|| (occ.length?occ[occ.length-1]:1);}
  const tgt=entryAt(r,c,lv);
  const oldr=e.prow,oldc=e.pcol,oldl=e.plevel;
  if(tgt&&tgt.id!==e.id){tgt.prow=oldr;tgt.pcol=oldc;tgt.plevel=oldl;} // swap
  e.prow=r;e.pcol=c;e.plevel=lv;save();renderMap();toast('המשטח הוזז');
}
function highlightMap(){const q=mapSearch.trim().toLowerCase();const cells=document.querySelectorAll('#v-map .slotwrap');
  cells.forEach(cell=>{cell.classList.remove('hit','dim');});
  if(!q)return;
  let m=q.match(/^(\d{1,2})\s*[-,. ]\s*(\d{1,2})$/);let rc=m?(m[1]+'-'+m[2]):null;
  cells.forEach(cell=>{const key=cell.dataset.cell;const ents=entriesAt(+key.split('-')[0],+key.split('-')[1]);
    const hit=(rc&&key===rc)||ents.some(e=>(e.category+' '+e.vintage+' '+e.code).toLowerCase().includes(q));
    if(hit)cell.classList.add('hit');else cell.classList.add('dim');});}

