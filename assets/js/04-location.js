/* ============ LOCATION ============ */
let locF={},locSort=null,_locRows=null;
function locVisible(){return (window._locRows&&window._locRows.length!==undefined)?window._locRows:(state.entries||[]);}
const LOCDEFS=()=>[
 {key:'type',label:'סוג',get:e=>e.type,values:distinct(state.entries,e=>e.type)},
 {key:'category',label:'קטגוריה',get:e=>e.category,values:distinct(state.entries,e=>e.category)},
 {key:'vintage',label:'בציר',get:e=>e.vintage,values:distinct(state.entries,e=>e.vintage)},
 {key:'cooked',label:'מבושל/לא',get:e=>e.cooked,values:COOKED},
 {key:'label',label:'תיוות',get:e=>e.label,values:LABELS},
 {key:'prow',label:'שורה',get:e=>e.prow,values:distinct(state.entries,e=>e.prow)}];
function locFilter(k,v){if(k==='__clear__'){locF={};}else{locF[k]=v;}renderLoc();}
function locSortBy(col){const map={type:e=>e.type,category:e=>e.category,vintage:e=>+e.vintage||0,units:e=>+e.units,boxes:e=>derive(e).boxes,pallets:e=>derive(e).pallets,prow:e=>e.prow,pcol:e=>e.pcol,label:e=>e.label,cooked:e=>e.cooked};
  if(locSort&&locSort.col===col)locSort.dir=locSort.dir==='asc'?'desc':'asc';else locSort={col,dir:'asc'};locSort.val=map[col];renderLoc();}
function openCatUnits(){
  const box=document.getElementById('modalbox');box.className='box';
  const cats=[...new Set(WINECATS.concat((state.entries||[]).map(e=>e.category)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
  const cu=catUnits();
  const cp=catPal();
  const uOf=c=>{const v=cu[c];return (v&&typeof v==='object')?(v.u||''):(v||'');};
  const lOf=c=>{const v=cu[c];return (v&&typeof v==='object')?(v.l||''):'';};
  let h=`<h3>כמויות לפי קטגוריה</h3>
   <div class="hint">כמה בקבוקים נכנסים ל<b>ארגז</b> (בנפרד למלאי <b>מתוות</b> ו<b>לא מתוות</b>), וכמה ארגזים נכנסים ל<b>משטח</b>. משפיע מיד על כל המסכים ומסתנכרן לכל המכשירים. שדה ריק = ברירת המחדל. אם עמודת "מתוות" ריקה — משתמשים בערך של "לא מתוות".</div>
   <div class="actions" style="margin:8px 0"><button class="btn ghost sm" onclick="setAllCatUnits(6)">ארגז: הכל 6</button>
     <button class="btn ghost sm" onclick="setAllCatUnits(12)">ארגז: הכל 12</button>
     <button class="btn ghost sm" onclick="setAllCatPal(75)">משטח: הכל 75</button>
     <button class="btn ghost sm" onclick="resetCatUnits()">אפס לברירת מחדל</button></div>
   <table class="itemtbl"><thead><tr><th>קטגוריה</th><th>בארגז — לא מתוות</th><th>בארגז — מתוות</th><th>ארגזים במשטח</th><th>בשימוש</th></tr></thead><tbody>`;
  cats.forEach(c=>{
    const used=(state.entries||[]).filter(e=>e.category===c).length;
    const cur=cu[c]||'';
    h+=`<tr><td>${esc(c)}</td>
      <td><input type="number" min="1" style="width:74px" value="${uOf(c)}" placeholder="${defaultBpb(c)}" onchange="setCatUnits('${c.replace(/'/g,"\\'")}',this.value,'u')"></td>
      <td><input type="number" min="1" style="width:74px" value="${lOf(c)}" placeholder="${defaultBpb(c)}" onchange="setCatUnits('${c.replace(/'/g,"\\'")}',this.value,'l')"></td>
      <td><input type="number" min="1" style="width:74px" value="${esc(cp[c]||'')}" placeholder="${esc(DEFAULT_BPP)}" onchange="setCatPal('${c.replace(/'/g,"\\'")}',this.value)"></td>
      <td style="color:var(--muted);font-size:11px">${used?used+' מיקומים':'—'}</td></tr>`;});
  h+=`</tbody></table><div class="actions"><button class="btn" onclick="closeModal()">סגור</button></div>`;
  box.innerHTML=h;document.getElementById('modal').classList.add('open');
}
function setCatUnits(cat,v,slot){
  const cu=catUnits(),n=parseInt(v);
  let cur=cu[cat];
  if(typeof cur!=='object')cur=(cur?{u:+cur}:{});
  if(!n||n<1)delete cur[slot||'u']; else cur[slot||'u']=n;
  if(!cur.u&&!cur.l)delete cu[cat]; else cu[cat]=cur;
  save();refresh();
}
function setAllCatUnits(n){
  const cats=[...new Set(WINECATS.concat((state.entries||[]).map(e=>e.category)).filter(Boolean))];
  const cu=catUnits();cats.forEach(c=>cu[c]={u:n,l:n});save();refresh();openCatUnits();toast('עודכן');
}
function setCatPal(cat,v){const n=parseInt(v);if(!n||n<1)delete catPal()[cat];else catPal()[cat]=n;save();refresh();}
function setAllCatPal(n){const cats=[...new Set(WINECATS.concat((state.entries||[]).map(e=>e.category)).filter(Boolean))];
  const cp=catPal();cats.forEach(c=>cp[c]=n);save();refresh();openCatUnits();toast('עודכן');}
function resetCatUnits(){if(!confirm('לאפס את כל הקטגוריות לברירת המחדל?'))return;state.settings.catUnits={};state.settings.catPal={};save();refresh();openCatUnits();}
function openCapSettings(){
  const box=document.getElementById('modalbox');box.className='box wide';
  const cc=capColors(),cm=capColorMap(),cat=capCatMap(),nums=capNums();
  const colorNames=Object.keys(cc);
  const cats=[...new Set(WINECATS.concat((state.entries||[]).map(e=>e.category)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
  const colorSel=(val,onch)=>`<select onchange="${onch}">${colorNames.map(n=>`<option ${val===n?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
  const pal=catPalette(),ccm=catColorMap();
  const palKeys=Object.keys(pal);
  let h=`<h3>קפסולות וצבעים</h3>
   <div class="hint"><b>קפסולה</b> = מספר הקפסולה על הבקבוק וצבעה. <b>צבע קטגוריה</b> = הצבע שבו הקטגוריה מוצגת בטבלאות ובמפת המחסן — שני דברים נפרדים. הכל מסתנכרן לכל המכשירים.</div>
   <div class="capgrid">
    <div>
      <div class="seg"><b>קפסולות</b></div>
      <table class="itemtbl"><thead><tr><th>קפסולה</th><th>צבע</th><th>תצוגה</th><th></th></tr></thead><tbody>
      ${nums.map((n,i)=>`<tr>
        <td><input value="${esc(n)}" style="width:80px" onchange="renameCapNum('${String(n).replace(/'/g,"\\'")}',this.value)"></td>
        <td>${colorSel(capColorOfNum(n),`setCapColor('${String(n).replace(/'/g,"\\'")}',this.value)`)}</td>
        <td><span class="cap" style="${capStyle(capColorOfNum(n))}">${esc(n)}</span></td>
        <td><button class="del" onclick="delCapNum('${String(n).replace(/'/g,"\\'")}')">✕</button></td></tr>`).join('')}
      </tbody></table>
      <button class="btn ghost sm" onclick="addCapNum()">+ הוסף קפסולה</button>

      <div class="seg" style="margin-top:14px"><b>צבעים</b></div>
      <table class="itemtbl"><thead><tr><th>שם הצבע</th><th>רקע</th><th>טקסט</th><th>תצוגה</th><th></th></tr></thead><tbody>
      ${colorNames.map(n=>`<tr>
        <td>${esc(n)}</td>
        <td><input type="color" value="${esc(cc[n].bg)}" onchange="setCapColorDef('${n.replace(/'/g,"\\'")}','bg',this.value)"></td>
        <td><input type="color" value="${esc(cc[n].fg)}" onchange="setCapColorDef('${n.replace(/'/g,"\\'")}','fg',this.value)"></td>
        <td><span class="cap" style="${capStyle(n)}">דוגמה</span></td>
        <td><button class="del" onclick="delCapColorDef('${n.replace(/'/g,"\\'")}')">✕</button></td></tr>`).join('')}
      </tbody></table>
      <button class="btn ghost sm" onclick="addCapColorDef()">+ הוסף צבע</button>
    </div>
    <div>
      <div class="seg"><b>לפי קטגוריה</b></div>
      <table class="itemtbl"><thead><tr><th>קטגוריה</th><th>קפסולה</th><th>צבע קטגוריה</th><th>תצוגה</th></tr></thead><tbody>
      ${cats.map(c=>{const cur=capOf(c);const ck=colorOf(c);return `<tr><td>${esc(c)}</td>
        <td><select onchange="setCatCap('${c.replace(/'/g,"\\'")}',this.value)"><option value="">— ברירת מחדל —</option>${nums.map(n=>`<option ${String(cur[0])===String(n)?'selected':''}>${esc(n)}</option>`).join('')}</select></td>
        <td><select onchange="setCatColor('${c.replace(/'/g,"\\'")}',this.value)">${palKeys.map(k=>`<option value="${esc(k)}" ${ck===k?'selected':''}>${esc(pal[k].n)}</option>`).join('')}</select></td>
        <td><span class="cap" style="${capStyle(cur[1])}">${esc(cur[0]||'—')}</span> <span class="tag" style="${colorStyle(ck)}">${esc(colorName(ck))}</span></td></tr>`;}).join('')}
      </tbody></table>

      <div class="seg" style="margin-top:14px"><b>צבעי הקטגוריות</b></div>
      <table class="itemtbl"><thead><tr><th>שם</th><th>רקע</th><th>טקסט</th><th>תצוגה</th><th></th></tr></thead><tbody>
      ${palKeys.filter(k=>k!=='none').map(k=>`<tr>
        <td><input value="${esc(pal[k].n)}" style="width:82px" onchange="setCatPalName('${k}',this.value)"></td>
        <td><input type="color" value="${esc(pal[k].bg)}" onchange="setCatPalPart('${k}','bg',this.value)"></td>
        <td><input type="color" value="${esc(pal[k].fg)}" onchange="setCatPalPart('${k}','fg',this.value)"></td>
        <td><span class="tag" style="${colorStyle(k)}">דוגמה</span></td>
        <td><button class="del" onclick="delCatPal('${k}')">✕</button></td></tr>`).join('')}
      </tbody></table>
      <button class="btn ghost sm" onclick="addCatPal()">+ הוסף צבע קטגוריה</button>
    </div>
   </div>
   <div class="actions"><button class="btn" onclick="closeModal()">סגור</button>
     <button class="btn ghost" onclick="resetCapSettings()">אפס לברירת מחדל</button></div>`;
  box.innerHTML=h;document.getElementById('modal').classList.add('open');
}
function addCapNum(){const v=(prompt('שם / מספר הקפסולה החדשה:')||'').trim();if(!v)return;
  const a=capNums().slice();if(a.includes(v)){toast('כבר קיימת');return;}
  a.push(v);state.settings.capNums=a;if(!capColorMap()[v])capColorMap()[v]='לבן';save();refresh();openCapSettings();}
function renameCapNum(oldV,newV){newV=(newV||'').trim();if(!newV||newV===oldV){openCapSettings();return;}
  const a=capNums().slice();const i=a.indexOf(oldV);if(i<0)return;a[i]=newV;state.settings.capNums=a;
  const cm=capColorMap();if(cm[oldV]!==undefined){cm[newV]=cm[oldV];delete cm[oldV];}
  const cat=capCatMap();Object.keys(cat).forEach(k=>{if(String(cat[k])===oldV)cat[k]=newV;});
  (state.entries||[]).forEach(e=>{if(String(e.capsule)===oldV)e.capsule=newV;});
  save();refresh();openCapSettings();}
function delCapNum(v){if(!confirm('למחוק את הקפסולה "'+v+'"?'))return;
  state.settings.capNums=capNums().filter(x=>String(x)!==String(v));
  delete capColorMap()[v];save();refresh();openCapSettings();}
function setCapColor(numV,colorName){capColorMap()[String(numV)]=colorName;save();refresh();openCapSettings();}
function setCatColor(cat,k){catColorMap()[cat]=k;
  (state.entries||[]).forEach(e=>{if(e.category===cat)e.color=k;});
  save();refresh();openCapSettings();}
function setCatPalName(k,v){v=(v||'').trim();if(!v)return;catPalette()[k].n=v;save();refresh();openCapSettings();}
function setCatPalPart(k,part,v){catPalette()[k][part]=v;save();refresh();openCapSettings();}
function addCatPal(){const n=(prompt('שם הצבע החדש (למשל: כחול):')||'').trim();if(!n)return;
  const key='c'+Date.now().toString(36);catPalette()[key]={n:n,bg:'#3366cc',fg:'#ffffff'};save();refresh();openCapSettings();}
function delCatPal(k){const pal=catPalette();
  if(Object.keys(pal).length<=2){toast('חייב להישאר צבע אחד');return;}
  if(!confirm('למחוק את הצבע "'+pal[k].n+'"?'))return;
  delete pal[k];const m=catColorMap();Object.keys(m).forEach(c=>{if(m[c]===k)delete m[c];});
  save();refresh();openCapSettings();}
function setCatCap(cat,v){const m=capCatMap();if(!v)delete m[cat];else m[cat]=v;save();refresh();openCapSettings();}
function setCapColorDef(name,part,val){const cc=capColors();if(!cc[name])cc[name]={bg:'#eeeeee',fg:'#333333'};cc[name][part]=val;save();refresh();openCapSettings();}
function addCapColorDef(){const n=(prompt('שם הצבע החדש (למשל: כחול):')||'').trim();if(!n)return;
  const cc=capColors();if(cc[n]){toast('כבר קיים');return;}
  cc[n]={bg:'#3366cc',fg:'#ffffff'};save();refresh();openCapSettings();}
function delCapColorDef(name){
  if(Object.keys(capColors()).length<=1){toast('חייב להישאר צבע אחד');return;}
  if(!confirm('למחוק את הצבע "'+name+'"?'))return;
  delete capColors()[name];
  const cm=capColorMap();Object.keys(cm).forEach(k=>{if(cm[k]===name)delete cm[k];});
  save();refresh();openCapSettings();}
function resetCapSettings(){if(!confirm('לאפס קפסולות וצבעים לברירת המחדל?'))return;
  delete state.settings.capNums;delete state.settings.capColorMap;delete state.settings.capCatMap;
  delete state.settings.catColorMap;state.settings.catPalette=JSON.parse(JSON.stringify(CATPAL_DEF));
  state.settings.capColors=JSON.parse(JSON.stringify(CAPCOLORDEF));save();refresh();openCapSettings();}
/* רשימות האפשרויות נבנות פעם אחת ונשמרות במטמון */
let _locOpts=null,_locOptsKey='';
function locOpts(){
  const key=WINECATS.length+'|'+TYPES.length+'|'+capNums().length+'|'+COOKED.length+'|'+LABELS.length;
  if(_locOpts&&_locOptsKey===key)return _locOpts;
  _locOptsKey=key;
  _locOpts={
    LVL:[1,2,3].map(l=>`<option value="${esc(l)}">${esc(LEVELNAME[l])}</option>`).join(''),
    TYPE:TYPES.map(t=>`<option>${esc(t)}</option>`).join(''),
    CAT:WINECATS.map(t=>`<option>${esc(t)}</option>`).join('')
  };
  return _locOpts;
}
const _selOpt=(html,val)=>html.replace('<option>'+esc(val)+'</option>','<option selected>'+esc(val)+'</option>');
/* בניית שורה בודדת — משמשת גם לרינדור מלא וגם לעדכון שורה אחת בעריכה */
function locRowHTML(e){
  const d=derive(e);const col=colorOf(e.category);const cap=capDisp(e);const ovr=d.pallets>1.001;
  const O=locOpts();
  const OPT_LVL=O.LVL,OPT_TYPE=O.TYPE,OPT_CAT=O.CAT,sel=_selOpt;
  return `<tr class="${ovr?'warn-row':''}"><td><input class="mini" type="number" value="${esc(e.prow)}" onchange="setF(${e.id},'prow',+this.value)" data-eid="${esc(e.id)}" data-f="prow"></td>
     <td><input class="mini" type="number" value="${esc(e.pcol)}" onchange="setF(${e.id},'pcol',+this.value)" data-eid="${esc(e.id)}" data-f="pcol"></td>
     <td><select onchange="setF(${e.id},'plevel',+this.value)">${OPT_LVL.replace('value="'+e.plevel+'"','value="'+e.plevel+'" selected')}</select></td>
     <td><select onchange="setF(${e.id},'type',this.value)">${sel(OPT_TYPE,e.type)}</select></td>
     <td><select onchange="setCat(${e.id},this.value)">${sel(OPT_CAT,e.category)}${WINECATS.includes(e.category)?'':`<option selected>${esc(e.category)}</option>`}<option value="__new__">+ קטגוריה חדשה…</option></select></td>
     <td><input class="mini" value="${esc(e.vintage||'')}" onchange="setF(${e.id},'vintage',this.value)" data-eid="${esc(e.id)}" data-f="vintage"></td>
     <td><select class="${e.cooked==='מבושל'?'cook-r':e.cooked==='לא מבושל'?'cook-b':''}" onchange="setF(${e.id},'cooked',this.value)"><option value=""></option>${COOKED.map(x=>`<option ${e.cooked===x?'selected':''}>${esc(x)}</option>`).join('')}</select></td>
     <td class="in"><input type="number" step="0.1" value="${esc(e.units)}" onchange="setF(${e.id},'units',+this.value)" data-eid="${esc(e.id)}" data-f="units"></td>
     <td>${d.boxes.toFixed(1)}</td><td>${d.pallets.toFixed(2)}${ovr?' ⚠':''}</td>
     <td><span class="tag" style="${colorStyle(col)}">${esc(colorName(col))}</span></td>
     <td><select class="capsel" style="${capStyle(cap[1])}" onchange="setCapsule(${e.id},this.value)">${capNums().map(n=>`<option ${cap[0]===n?'selected':''}>${esc(n)}</option>`).join('')}</select></td>
     <td><select onchange="setF(${e.id},'label',this.value)">${LABELS.map(l=>`<option ${e.label===l?'selected':''}>${esc(l)}</option>`).join('')}</select></td>
     <td class="bcell">${(()=>{const b=barcodeOf(e);return b?`<span class="bctag" onclick="openBarcodeResult('${b}')" title="הצג היכן במחסן">${esc(b)}</span>`:'<span class="bcnone">—</span>';})()}</td><td><input value="${esc(e.notes||'')}" onchange="setF(${e.id},'notes',this.value)" data-eid="${esc(e.id)}" data-f="notes"></td>
     <td><button class="del" onmousedown="if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()" onclick="delEntry(${e.id})">✕</button></td></tr>`;
}
function renderLocRow(id){
  const el=document.querySelector('#v-loc [data-eid="'+id+'"]');
  if(!el)return false;
  const tr=el.closest('tr');if(!tr)return false;
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return false;
  const wrap0=document.querySelector('#v-loc .tablewrap');
  const wy0=wrap0?wrap0.scrollTop:0, wx0=wrap0?wrap0.scrollLeft:0;
  const winY=window.scrollY, winX=window.scrollX;      /* גם גלילת הדף עצמו */
  const active=document.activeElement;
  const af=active&&active.dataset?active.dataset.f:null;
  const pos=(active&&active.selectionStart!==undefined)?active.selectionStart:null;
  const wrap=wrap0,wy=wy0;
  tr.outerHTML=locRowHTML(e);
  const putBack=()=>{
    if(wrap){if(wrap.scrollTop!==wy)wrap.scrollTop=wy;if(wrap.scrollLeft!==wx0)wrap.scrollLeft=wx0;}
    if(window.scrollY!==winY||window.scrollX!==winX)window.scrollTo(winX,winY);
  };
  putBack();
  if(af){                                   /* מחזירים את הפוקוס לשדה שנערך */
    const back=document.querySelector('#v-loc [data-eid="'+id+'"][data-f="'+af+'"]');
    if(back){
      back.focus({preventScroll:true});          /* focus לא יגלול את הטבלה */
      try{if(pos!==null)back.setSelectionRange(pos,pos);}catch(err){}
      putBack();
    }
  }
  putBack();requestAnimationFrame(putBack);
  return true;
}
function renderLoc(){
  const defs=LOCDEFS();
  let rows=state.entries.filter(e=>passF(e,defs,locF));
  window._locRows=rows;                    /* לייצוא CSV מסונן */
  rows=sortList(rows,locSort);
  const over=state.entries.filter(e=>derive(e).pallets>1.001).length;
  let h=`<div class="panel"><h2>מיקום במחסן</h2>
   <div class="hint">מקור האמת. הזן <b>יחידות</b> → ארגזים, משטחים, מפה, מלאי ודשבורד מתעדכנים אוטומטית. כל מיקום = משטח אחד (כמות הארגזים במשטח נקבעת לכל קטגוריה).</div>
   <div class="toolrow"><button class="btn" onclick="addEntry()">+ מיקום</button>
     ${over?`<button class="btn warn" onclick="splitAll()">פצל ${over} מיקומים מעל משטח</button>`:''}
     <span class="exp">⬇ ייצוא: <button class="btn ghost sm" onclick="exportScreenCSV('loc')">Excel</button> <button class="btn ghost sm" onclick="exportScreenImg('v-loc','מיקום-במחסן')">תמונה</button> · ⬆ <button class="btn ghost sm" onclick="document.getElementById('impLoc').click()">ייבוא Excel</button></span>
     <span class="exp"><button class="btn ghost sm" onclick="openBarcodeScan()">📷 סרוק ברקוד</button> <button class="btn ghost sm" onclick="promptBarcode()">🔎 חיפוש</button> <button class="btn ghost sm" onclick="openBarcodeManager()">✎ ניהול ברקודים</button></span></div>
   ${filterControls(defs,locF,'locFilter')}
   <div class="tablewrap"><table><thead><tr>
   ${sTh('שורה','prow',locSort,'locSortBy')}${sTh('עמ׳','pcol',locSort,'locSortBy')}<th>מפלס</th>
   ${sTh('סוג','type',locSort,'locSortBy')}${sTh('קטגוריה','category',locSort,'locSortBy')}${sTh('בציר','vintage',locSort,'locSortBy')}
   ${sTh('מבושל/לא מבושל','cooked',locSort,'locSortBy')}${sTh('יחידות','units',locSort,'locSortBy')}${sTh('ארגזים','boxes',locSort,'locSortBy')}${sTh('משטחים','pallets',locSort,'locSortBy')}
   <th>צבע קטגוריה</th><th>קפסולה</th>${sTh('תיוות','label',locSort,'locSortBy')}<th>ברקוד</th><th>הערות</th><th></th></tr></thead><tbody>`;
  /* רשימות האפשרויות זהות לכל השורות — נבנות פעם אחת במקום 500+ פעמים */
  const OPT_LVL=[1,2,3].map(l=>`<option value="${esc(l)}">${esc(LEVELNAME[l])}</option>`).join('');
  const OPT_TYPE=TYPES.map(t=>`<option>${esc(t)}</option>`).join('');
  const OPT_CAT=WINECATS.map(t=>`<option>${esc(t)}</option>`).join('');
  const OPT_COOK=COOKED.map(x=>`<option>${esc(x)}</option>`).join('');
  const OPT_LBL=LABELS.map(x=>`<option>${esc(x)}</option>`).join('');
  const OPT_CAP=capNums().map(n=>`<option>${esc(n)}</option>`).join('');
  const sel=(html,val)=>html.replace('<option>'+esc(val)+'</option>','<option selected>'+esc(val)+'</option>');
  /* רינדור מדורג: החלק הראשון מיד (המסך מגיב), השאר ברקע —
     כך הכניסה למסך לא נתקעת 2 שניות בטלפון. */
  const FIRST=120;
  const firstRows=rows.slice(0,FIRST),restRows=rows.slice(FIRST);
  firstRows.forEach(e=>{h+=locRowHTML(e);});
  h+=`</tbody></table></div><div class="hint">${rows.length} מתוך ${state.entries.length} מיקומים</div></div>`;
  /* שומרים את מיקום הגלילה — הטעינה המדורגת מקצרת זמנית את הטבלה
     והדפדפן "מהדק" את הגלילה לגובה הנוכחי. משחזרים אחרי כל מנה. */
  const _prevWrap=document.querySelector('#v-loc .tablewrap');
  const _wantY=_prevWrap?_prevWrap.scrollTop:0;
  const _prevH=_prevWrap?_prevWrap.scrollHeight:0;
  document.getElementById('v-loc').innerHTML=h;
  const _wrapNow=document.querySelector('#v-loc .tablewrap');
  /* שומרים זמנית את הגובה הקודם — כך הגלילה לא "נחתכת" בזמן שהשורות נטענות */
  if(_wrapNow&&_wantY&&_prevH){
    const tb0=_wrapNow.querySelector('tbody');
    if(tb0){
      const pad=document.createElement('tr');pad.className='_pad';
      pad.innerHTML='<td colspan="20" style="padding:0;border:0"></td>';
      pad.firstChild.style.height=Math.max(0,_prevH-_wrapNow.scrollHeight)+'px';
      tb0.appendChild(pad);
    }
    _wrapNow.scrollTop=_wantY;
  }
  const _shrinkPad=()=>{const w=document.querySelector('#v-loc .tablewrap');if(!w)return;
    const pad=w.querySelector('tr._pad');if(!pad)return;
    const cell=pad.firstChild;
    const without=w.scrollHeight-cell.offsetHeight;
    const need=Math.max(0,_prevH-without);
    cell.style.height=need+'px';
    if(need<=0)pad.remove();
  };
  const _restoreY=()=>{const w=document.querySelector('#v-loc .tablewrap');
    _shrinkPad();
    if(w&&_wantY&&w.scrollTop!==_wantY&&w.scrollHeight-w.clientHeight>=_wantY)w.scrollTop=_wantY;};
  if(restRows.length){
    /* requestIdleCallback ו-setTimeout מקבלים פרמטרים שונים — עוטפים אחיד */
    const schedule=fn=>setTimeout(fn,0);   /* אמין יותר מ-requestIdleCallback */
    const tb=document.querySelector('#v-loc tbody');
    let i=0;
    const chunk=()=>{
      const host=document.getElementById('v-loc');
      if(!host||!host.contains(tb))return;      /* המסך התחלף */
      const _sy=window.scrollY;
      const _wrap=document.querySelector('#v-loc .tablewrap');const _wy=_wrap?_wrap.scrollTop:0;
      const slice=restRows.slice(i,i+120);if(!slice.length)return;
      const tmp=document.createElement('tbody');
      tmp.innerHTML=slice.map(e=>locRowHTML(e)).join('');
      while(tmp.firstChild)tb.appendChild(tmp.firstChild);
      i+=120;
      if(window.scrollY!==_sy)window.scrollTo(0,_sy);
      _restoreY();                     /* משחזרים ככל שהתוכן גדל */
      if(i<restRows.length)schedule(chunk);
      else{                                   /* סיימנו — מסירים את המרווח הזמני */
        _restoreY();
        const w=document.querySelector('#v-loc .tablewrap');
        const pad=w?w.querySelector('tr._pad'):null;
        if(pad){const y=w.scrollTop;pad.remove();
          if(w.scrollHeight-w.clientHeight>=y)w.scrollTop=y;}
      }
    };
    schedule(chunk);
  }
}
function splitOne(e){const d=derive(e);if(d.pallets<=1.001)return false;const b=bpb(e.category,e.label);
  // keep 1 pallet here, move remainder to a new entry at next free slot
  const PB=bpp(e.category);const remBoxes=d.boxes-PB;
  const before=+e.units||0;e.units=Math.round(PB*b*10)/10;
  logInv(e,before,e.units,'manual','פיצול מיקום — הועבר לפריט חדש');
  const id=Math.max(0,...state.entries.map(x=>x.id))+1;
  /* הפריט החדש נשאר ללא מיקום — המשתמש משבץ אותו בעצמו במפה ("+ שבץ") */
  const ne=Object.assign({},e,{id,units:Math.round(remBoxes*b*10)/10,notes:e.notes,prow:0,pcol:0,plevel:0});
  state.entries.push(ne);logInv(ne,0,ne.units,'manual','פיצול מיקום — פריט חדש');return true;}
function nextFreeSlot(){for(let r=1;r<=gridRows()+3;r++)for(let c=1;c<=gridCols();c++){if(!isSlot(r,c))continue;for(let lv=1;lv<=3;lv++){if(!entryAt(r,c,lv))return{r,c,lv};}}return null;}
function splitAll(){
  if(!confirm('לפצל מיקומים שחורגים ממשטח אחד?\n\nהחלק העודף יהפוך לפריט חדש <b>ללא מיקום</b>, ותשבץ אותו במפה.'.replace(/<[^>]+>/g,'')))return;
  let n=0,guard=0;
  while(guard++<500){
    const e=state.entries.find(x=>derive(x).pallets>1.001);if(!e)break;
    const before=derive(e).pallets;
    if(!splitOne(e))break;
    if(derive(e).pallets>=before-0.001){toast('הפיצול נעצר — בדוק את הגדרת הכמויות של '+e.category);break;}
    n++;
  }
  save();renderLoc();toast(n+' מיקומים פוצלו — הפריטים החדשים ממתינים לשיבוץ במפה');}
/* עריכה במסך מיקום: המסך מכיל 5,500+ שדות, ורינדור מלא לוקח ~0.6 שניות.
   לכן: שדות שאינם משפיעים על חישוב או סינון לא מרנדרים כלל,
   והשאר מרונדרים בהשהיה קצרה כדי שהקלדה רצופה לא תתקע. */
/* שדות שמשפיעים על סינון/מיון — מחייבים רינדור מלא. השאר: עדכון שורה בודדת. */
const FULL_RENDER_FIELDS=['category','type','cooked','label'];
const NO_RENDER_FIELDS=['notes'];
let _locRenderT=null;
function locRenderSoon(){clearTimeout(_locRenderT);_locRenderT=setTimeout(()=>{refresh();},250);}
function setF(id,f,v){
  const e=state.entries.find(x=>x.id===id);if(!e)return;
  const beforeUnits=(f==='units')?(+e.units||0):null;
  e[f]=v;
  if(f==='category'){e.color=colorOf(v);}
  if(beforeUnits!==null){const afterUnits=+v||0;if(afterUnits!==beforeUnits)logInv(e,beforeUnits,afterUnits,'manual');}
  save();
  if(NO_RENDER_FIELDS.includes(f))return;
  if(curTab===2&&!FULL_RENDER_FIELDS.includes(f)){
    /* עדכון השורה בלבד — בלי הבהוב, בלי קפיצת גלילה */
    if(renderLocRow(id))return;
  }
  locRenderSoon();
}
function addCustomCat(id){const n=(prompt('שם הקטגוריה החדשה:')||'').trim();if(!n){renderLoc();return;}
  if(!WINECATS.includes(n))WINECATS.push(n);
  if(!state.customCats)state.customCats=[];
  if(!state.customCats.includes(n))state.customCats.push(n);
  const e=state.entries.find(x=>x.id===id);if(e){e.category=n;e.color=colorOf(n);const cp=capOf(n);e.capsule=cp[0];e.capcolor=cp[1];}
  save();refresh();toast('הקטגוריה נוספה');}
function setCat(id,v){if(v==='__new__'){addCustomCat(id);return;}const e=state.entries.find(x=>x.id===id);if(!e)return;e.category=v;e.color=colorOf(v);const cp=capOf(v);e.capsule=cp[0];e.capcolor=cp[1];save();renderLoc();}
function setCapsule(id,v){const e=state.entries.find(x=>x.id===id);if(!e)return;e.capsule=v;e.capcolor=CAPCOLORBYNUM[v]||'לבן';save();renderLoc();}
function commitLocEdits(){
  try{
    document.querySelectorAll('#v-loc [data-eid][data-f]').forEach(el=>{
      const id=+el.dataset.eid,f=el.dataset.f;
      const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
      let v=el.value;
      if(['prow','pcol','plevel','units'].includes(f))v=+v||0;
      if(String(e[f]===undefined?'':e[f])!==String(v)){e[f]=v;if(f==='category')e.color=colorOf(v);}
    });
  }catch(err){}
}
function delEntry(id){const a=document.activeElement;if(a&&a.blur)a.blur();commitLocEdits();if(confirm('למחוק מיקום זה?')){
  const e=state.entries.find(x=>x.id===id);
  if(e)logInv(e,+e.units||0,0,'manual','מיקום נמחק');
  state.entries=state.entries.filter(x=>x.id!==id);save();renderLoc();}}
function addEntry(){commitLocEdits();const id=Math.max(0,...state.entries.map(e=>e.id))+1;const free={r:0,c:0,lv:0};
  modalForm('מיקום חדש',[['category','קטגוריה','select',WINECATS],['type','סוג','select',TYPES],['vintage','בציר','number',''],['units','יחידות','number','0'],['label','תיוות','select',LABELS]],
   v=>{const cp=capOf(v.category);const ne={id,code:'חדש-'+id,origin:'',type:v.type,series:'',category:v.category,vintage:v.vintage,cooked:'',units:+v.units||0,label:v.label,capsule:cp[0],capcolor:cp[1],color:colorOf(v.category),notes:'',prow:free.r,pcol:free.c,plevel:free.lv};
     state.entries.push(ne);logInv(ne,0,ne.units,'manual','מיקום חדש');save();renderLoc();toast('נוסף');});}

