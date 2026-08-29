/* ===== distribution labels: multi-product, mixed boxes, label designer, loading scan ===== */
const OILCHIPS=['שמן 5 ליטר','שמן 2 ליטר','שמן 750 מ"ל','שמן 500 מ"ל','שמן 250 מ"ל'];
const LBLFONTS=['Arial','Alef','Rubik','Times New Roman','Courier New','Georgia','Verdana'];
function defaultTpl(){return{w:102,h:102,
  fields:{
    title:{show:1,text:'',size:4,font:'Arial',color:'#7B1E2B',bold:1,x:51,y:8,align:'center',line:1},
    client:{show:1,size:7,font:'Arial',color:'#111111',bold:1,x:51,y:24,align:'center'},
    products:{show:1,size:4.5,font:'Arial',color:'#333333',bold:0,x:51,y:38,align:'center'},
    count:{show:1,size:5.5,font:'Arial',color:'#111111',bold:1,x:88,y:62,align:'right'},
    address:{show:0,size:3.5,font:'Arial',color:'#333333',bold:0,x:51,y:78,align:'center'},
    phone:{show:0,size:3.5,font:'Arial',color:'#333333',bold:0,x:51,y:84,align:'center'},
    logo:{show:0,size:18,x:8,y:6,src:''},
    code:{show:1,size:3,font:'Courier New',color:'#888888',bold:0,x:51,y:90,align:'center'},
    date:{show:1,size:3.2,font:'Arial',color:'#555555',bold:0,x:51,y:95,align:'center'},
    qr:{show:1,size:26,x:8,y:52}
  }};}
let _editBatch=null;                      // when set, the editor edits THIS client's own template
function fillTpl(t){const d=defaultTpl();
  if(!t.fields)t.fields={};
  for(const k in d.fields)if(!t.fields[k])t.fields[k]=JSON.parse(JSON.stringify(d.fields[k]));
  if(!t.w)t.w=d.w; if(!t.h)t.h=d.h;
  return t;}
function lblTpl(){                        // template currently being edited
  if(_editBatch){
    const b=(state.labels||[]).find(x=>x.id===_editBatch);
    if(b){ if(!b.tpl)b.tpl=JSON.parse(JSON.stringify(lblTplGlobal())); return fillTpl(b.tpl); }
  }
  return lblTplGlobal();}
function lblTplGlobal(){if(!state.settings.labelTpl)state.settings.labelTpl=defaultTpl();
  return fillTpl(state.settings.labelTpl);}
function tplFor(b){return (b&&b.tpl)?fillTpl(b.tpl):lblTplGlobal();}
/* stable short code per client — survives re-imports, ID changes and other devices */
function slugCode(str){let h=5381;for(let i=0;i<str.length;i++){h=((h<<5)+h+str.charCodeAt(i))>>>0;}
  return h.toString(36).toUpperCase().slice(0,5).padStart(5,'0');}
function ensureCode(b,taken){
  if(b.code&&/^[0-9A-Z]{5}$/.test(b.code))return b.code;
  let base=slugCode((b.client||'')+'|'+(b.date||'')),c=base,k=1;
  while(taken&&taken.has(c)){c=slugCode(base+'#'+(k++));}
  b.code=c;return c;
}
function ensureAllCodes(){
  const taken=new Set();let changed=false;
  (state.labels||[]).forEach(b=>{const before=b.code;ensureCode(b,taken);taken.add(b.code);if(before!==b.code)changed=true;});
  if(changed)save();
}
function findBatchByCode(c){
  c=String(c||'').trim().toUpperCase();
  let b=(state.labels||[]).find(x=>String(x.code||'').toUpperCase()===c);
  if(b)return b;
  return (state.labels||[]).find(x=>String(x.id)===c);   // legacy labels (numeric id)
}
function batchTotal(b){return (b.items||[]).reduce((t,i)=>t+Math.max(0,+i.count||0),0);}
function itemLabel(it){const c=(it.contents||[]).filter(Boolean);return c.length?c.join(' + '):'—';}
/* one entry per physical box */
function boxesOf(b){const out=[];let n=0;const tot=batchTotal(b);
  (b.items||[]).forEach(it=>{for(let k=0;k<(+it.count||0);k++){n++;out.push({n,total:tot,contents:(it.contents||[]).filter(Boolean),text:itemLabel(it)});}});
  return out;}
/* per-product expected vs scanned */
function productStats(b){
  const exp={},got={};
  boxesOf(b).forEach(bx=>{bx.contents.forEach(p=>{exp[p]=(exp[p]||0)+1;});});
  (b.scanned||[]).forEach(n=>{const bx=boxesOf(b).find(x=>x.n===n);if(bx)bx.contents.forEach(p=>{got[p]=(got[p]||0)+1;});});
  return Object.keys(exp).map(p=>({p,exp:exp[p],got:got[p]||0}));
}
function prodListHTML(b){
  const orig=(b.prods||[]);
  if(!orig.length)return '';
  // how many units of each product the current boxes actually carry
  const inBoxes={};
  (b.items||[]).forEach(it=>{(it.contents||[]).forEach(p=>{inBoxes[p]=(inBoxes[p]||0)+(+it.count||0);});});
  const parts=orig.map(p=>{
    const covered=inBoxes[p.n]!==undefined;
    return `<span class="pl-item${covered?'':' pl-miss'}" title="${covered?'מופיע על המדבקות':'לא מופיע על אף מדבקה'}">${p.q}× ${p.n}</span>`;});
  const total=orig.reduce((t,p)=>t+(+p.q||0),0);
  return `<div class="lc-prods"><b>הזמנה:</b> ${parts.join('')} <span class="pl-tot">(${total} יח')</span></div>`;
}
function renderLabels(){
  let h=`<div class="panel"><h2>מדבקות הפצה</h2>
   <div class="hint">לכל לקוח אפשר להגדיר כמה שורות ארגזים. בכל שורה אפשר לשים <b>יותר ממוצר אחד</b> (ארגז מעורב). המדבקות ממוספרות ברצף על כל ארגזי הלקוח, והברקוד כולל את תוכן הארגז — כך שסריקת ההעמסה בודקת גם ארגזים וגם כמות מכל מוצר.</div>
   <div class="toolrow"><button class="btn" onclick="addClientBatch()">+ לקוח חדש</button>
     <button class="btn gold" onclick="document.getElementById('impLW').click()">📥 ייבוא מסלול הפצה (LionWheel)</button>
     <button class="btn ghost" onclick="openBoxRules()">📦 יחידות בארגז</button>
     <button class="btn ghost" onclick="openLabelEditor()">🎨 עורך מדבקה</button>
     <button class="btn gold" onclick="openPicking()">📋 דף ליקוט</button>
     <button class="btn ghost" onclick="openRoutes()">🗂️ מסלולים שמורים</button>
     <button class="btn" onclick="printLabels()">🖨️ הדפס הכל</button>
     <button class="btn gold" onclick="openScanner()">📷 סריקת העמסה</button>
   </div>`;
  if(!state.labels||!state.labels.length){h+=`<div class="hint" style="margin-top:12px">אין עדיין לקוחות. לחץ "+ לקוח חדש".</div>`;}
  else state.labels.forEach(b=>{
    const tot=batchTotal(b),done=(b.scanned||[]).length,ok=tot>0&&done>=tot;
    h+=`<div class="lblcard ${ok?'ok':''}">
      <div class="lc-head">
        <span class="lc-code" title="קוד הלקוח — מופיע על המדבקה">${ensureCode(b)}</span>
        <input class="lc-client" value="${esc(b.client||'')}" placeholder="שם לקוח" onchange="setBatch(${b.id},'client',this.value)">
        <input type="date" value="${esc(b.date||'')}" onchange="setBatch(${b.id},'date',this.value)">
        <span class="lc-tot">${tot} ארגזים · נסרקו ${done}/${tot}${ok?' ✓':''}${b.lwPkg&&b.lwPkg!==tot?` <span class="mism" title="ב-LionWheel רשום ${b.lwPkg}">≠${b.lwPkg}</span>`:''}</span>
        <button class="btn ghost sm" onclick="openLabelEditor(${b.id})" title="עיצוב מדבקה ללקוח זה">🎨${b.tpl?' ✓':''}</button>
        <button class="btn sm" onclick="printLabels(${b.id})">🖨️ הדפס</button>
        <button class="del" onclick="delBatch(${b.id})">✕</button>
      </div>
      ${(b.city||b.address||b.phone||b.stop)?`<div class="lc-meta">${b.stop?'עצירה '+esc(b.stop)+' · ':''}${esc([b.address,b.city].filter(Boolean).join(', '))}${b.phone?' · '+esc(b.phone):''}${b.time?' · '+esc(b.time):''}</div>`:''}
      ${prodListHTML(b)}
      <table class="itemtbl"><thead><tr><th>תוכן הארגז (אפשר כמה מוצרים)</th><th>מס' ארגזים</th><th></th></tr></thead><tbody>`;
    (b.items||[]).forEach((it,k)=>{
      h+=`<tr><td>
        <div class="prods">${(it.contents||[]).map((p,pi)=>`<span class="prodchip">${esc(p||'—')}<button onclick="delProd(${b.id},${k},${pi})">✕</button></span>`).join('')}
        <input list="prodlist" class="prodadd" placeholder="+ הוסף מוצר…" onchange="addProd(${b.id},${k},this.value);this.value=''"></div></td>
        <td><input type="number" min="1" style="width:80px" value="${it.count||1}" onchange="setItem(${b.id},${k},'count',this.value)"></td>
        <td><button class="del" onclick="delItem(${b.id},${k})">✕</button></td></tr>`;});
    h+=`</tbody></table><button class="btn ghost sm" onclick="addItem(${b.id})">+ הוסף שורת ארגזים</button>`;
    const ps=productStats(b);
    if(ps.length)h+=`<div class="pstat">${ps.map(x=>`<span class="${x.got>=x.exp?'okp':''}">${esc(x.p)}: ${x.got}/${x.exp}${x.got>=x.exp?' ✓':''}</span>`).join('')}</div>`;
    h+=`</div>`;});
  h+=`</div><datalist id="prodlist">${OILCHIPS.concat(WINECATS).map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`;
  document.getElementById('v-labels').innerHTML=h;
}
function addClientBatch(){state.labels.push({id:Date.now(),client:'',date:localDate(),items:[{contents:[],count:1}],scanned:[]});save();renderLabels();}
function delBatch(id){if(!confirm('למחוק את הלקוח והמדבקות שלו?'))return;state.labels=state.labels.filter(b=>b.id!==id);save();renderLabels();}
function setBatch(id,f,v){const b=state.labels.find(x=>x.id===id);if(!b)return;b[f]=v;save();}
function addItem(id){const b=state.labels.find(x=>x.id===id);if(!b)return;(b.items=b.items||[]).push({contents:[],count:1});b.scanned=[];save();renderLabels();}
function delItem(id,k){const b=state.labels.find(x=>x.id===id);if(!b||!b.items||!b.items[k])return;b.items.splice(k,1);b.scanned=[];save();renderLabels();}
function setItem(id,k,f,v){const b=state.labels.find(x=>x.id===id);if(!b)return;
  if(!b.items||!b.items[k])return;
  b.items[k][f]=(f==='count')?Math.max(1,Math.min(9999,parseInt(v)||1)):v;b.scanned=[];save();renderLabels();}
function addProd(id,k,v){v=(v||'').trim();if(!v)return;const b=state.labels.find(x=>x.id===id);if(!b)return;
  const it=(b.items||[])[k];if(!it)return;it.contents=it.contents||[];if(!it.contents.includes(v))it.contents.push(v);b.scanned=[];save();renderLabels();}
function delProd(id,k,pi){const b=state.labels.find(x=>x.id===id);if(!b)return;
  const it=(b.items||[])[k];if(!it||!Array.isArray(it.contents))return;it.contents.splice(pi,1);b.scanned=[];save();renderLabels();}
function qrSVG(text,cell){try{const qr=qrcode(0,'M');qr.addData(text);qr.make();return qr.createSvgTag({cellSize:cell||4,margin:0,scalable:true});}catch(e){return '';}}
/* QR payload includes contents so scanning verifies the product too */
function boxCode(b,bx){return 'TURA|'+ensureCode(b)+'|'+bx.n+'|'+bx.total;}
/* ---------- render one label from the template ---------- */
function fieldStyle(f){return `position:absolute;left:0;right:0;top:${f.y}mm;font-size:${f.size}mm;font-family:${f.font},sans-serif;color:${f.color};font-weight:${f.bold?800:400};text-align:${f.align};padding:0 3mm;line-height:1.15;`;}
function labelInnerHTML(b,bx,tpl){
  const t=tpl.fields,title=(t.title.text||state.settings.title||'יקב טורא');
  let h='';
  if(t.logo&&t.logo.show&&t.logo.src)h+=`<div style="position:absolute;left:${t.logo.x}mm;top:${t.logo.y}mm;width:${t.logo.size}mm;height:${t.logo.size}mm"><img src="${t.logo.src}" style="width:100%;height:100%;object-fit:contain"></div>`;
  if(t.title.show)h+=`<div style="${fieldStyle(t.title)}${t.title.line?'border-bottom:.4mm solid '+t.title.color+';padding-bottom:1mm;':''}">${esc(title)}</div>`;
  if(t.client.show)h+=`<div style="${fieldStyle(t.client)}">${esc(b.client||'')}</div>`;
  if(t.products.show)h+=`<div style="${fieldStyle(t.products)}">${esc(bx.text)}</div>`;
  if(t.count.show)h+=`<div style="${fieldStyle(t.count)}">ארגז ${bx.n} / ${bx.total}</div>`;
  if(t.address&&t.address.show)h+=`<div style="${fieldStyle(t.address)}">${esc([b.address,b.city].filter(Boolean).join(', '))}</div>`;
  if(t.phone&&t.phone.show)h+=`<div style="${fieldStyle(t.phone)}">${esc(b.phone||'')}</div>`;
  if(t.code&&t.code.show)h+=`<div style="${fieldStyle(t.code)}">${esc(ensureCode(b))}</div>`;
  if(t.date.show)h+=`<div style="${fieldStyle(t.date)}">${esc(b.date||'')}</div>`;
  if(t.qr.show)h+=`<div style="position:absolute;left:${t.qr.x}mm;top:${t.qr.y}mm;width:${t.qr.size}mm;height:${t.qr.size}mm">${qrSVG(boxCode(b,bx),4)}</div>`;
  return h;
}
function labelSheetHTML(batches){
  const g=lblTplGlobal();
  let body='';
  batches.forEach(b=>{const tpl=tplFor(b);
    boxesOf(b).forEach(bx=>{
      body+=`<div class="label" style="width:${tpl.w}mm;height:${tpl.h}mm">${labelInnerHTML(b,bx,tpl)}</div>`;});});
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
    @page{size:${g.w}mm ${g.h}mm;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;direction:rtl}
    .label{position:relative;overflow:hidden;page-break-after:always;break-after:page}
    .label:last-child{page-break-after:auto;break-after:auto}
    .label svg{width:100%;height:100%;display:block}
    .label img{display:block}
  </style></head><body>${body}</body></html>`;
}
function printHTML(html){
  const old=document.getElementById('printframe');if(old)old.remove();
  const f=document.createElement('iframe');f.id='printframe';
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write(html);d.close();
  const go=()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast('ההדפסה נכשלה');}};
  if(d.readyState==='complete')setTimeout(go,300);else f.onload=()=>setTimeout(go,300);
}
function printLabels(id){
  const batches=(id?state.labels.filter(b=>b.id===id):state.labels).filter(b=>batchTotal(b)>0);
  if(!batches.length){toast('אין ארגזים להדפסה');return;}
  if(batches.some(b=>!b.client)){toast('חסר שם לקוח');return;}
  printHTML(labelSheetHTML(batches));
}
/* ---------- LABEL EDITOR ---------- */
let _selField='client';
function sampleBox(){
  if(_editBatch){const e=(state.labels||[]).find(x=>x.id===_editBatch);
    if(e&&batchTotal(e)>0)return{b:e,bx:boxesOf(e)[0]};}
  const b=(state.labels||[]).find(x=>batchTotal(x)>0);
  if(b)return{b,bx:boxesOf(b)[0]};
  return{b:{id:1,client:'מרכולית',date:localDate()},bx:{n:1,total:5,contents:['שמן 5 ליטר'],text:'שמן 5 ליטר'}};}
const FLABEL={logo:'סמל / תמונה',title:'שם היקב',client:'שם לקוח',products:'תוכן הארגז',count:'מספר ארגז',address:'כתובת',phone:'טלפון',code:'קוד לקוח',date:'תאריך',qr:'ברקוד QR'};
function openLabelEditor(batchId){
  _editBatch=batchId||null;
  const box=document.getElementById('modalbox');
  box.className='box wide';
  box.innerHTML=`<h3>עורך מדבקה</h3>
    <div class="hint">גרור שדה בתצוגה כדי למקם אותו. בחר שדה כדי לערוך גופן, גודל וצבע.</div>
    <div class="led">
      <div class="led-prev"><div id="lblprev" class="lblprev"></div>
        <div class="led-size">גודל מדבקה (מ"מ): רוחב <input type="number" id="tw" value="${lblTpl().w}" onchange="setTplSize('w',this.value)"> גובה <input type="number" id="th" value="${lblTpl().h}" onchange="setTplSize('h',this.value)"></div>
      </div>
      <div class="led-ctl" id="ledctl"></div>
    </div>
    <div class="actions"><button class="btn" onclick="_editBatch=null;closeModal();renderLabels()">שמור וסגור</button>
      <button class="btn ghost" onclick="resetTpl()">אפס לברירת מחדל</button></div>`;
  document.getElementById('modal').classList.add('open');
  drawPreview();
}
const PXMM=96/25.4;
function drawPreview(){
  const tpl=lblTpl(),{b,bx}=sampleBox();
  const scale=Math.min(340/(tpl.w*PXMM),340/(tpl.h*PXMM),1.6);
  const p=document.getElementById('lblprev');
  p.style.cssText=`position:relative;width:${tpl.w*PXMM*scale}px;height:${tpl.h*PXMM*scale}px;background:#fff;border:1px solid #999;overflow:hidden`;
  p.innerHTML=`<div id="lblinner" style="position:absolute;top:0;right:0;width:${tpl.w}mm;height:${tpl.h}mm;direction:rtl;transform:scale(${scale});transform-origin:top right"></div>`;
  const host=document.getElementById('lblinner');
  host.innerHTML=labelInnerHTML(b,bx,tpl);
  const keys=['logo','title','client','products','count','address','phone','code','date','qr'].filter(k=>tpl.fields[k]&&tpl.fields[k].show);
  [...host.children].forEach((el,i)=>{
    const k=keys[i];if(!k)return;
    el.dataset.k=k;el.style.cursor='move';
    if(k===_selField)el.style.outline='1px dashed #7B1E2B';
    el.onmousedown=e=>startDrag(e,k,scale);
    el.ontouchstart=e=>startDrag(e.touches[0],k,scale);
    el.onclick=e=>{e.stopPropagation();_selField=k;drawPreview();};
  });
  drawCtl();
}
function startDrag(e,k,scale){
  if(e.preventDefault)e.preventDefault();
  _selField=k;
  const tpl=lblTpl(),f=tpl.fields[k];
  const rect=document.getElementById('lblprev').getBoundingClientRect();
  const ppm=PXMM*scale;
  const move=ev=>{
    const pt=ev.touches?ev.touches[0]:ev;
    const y=(pt.clientY-rect.top)/ppm;
    const maxY=(k==='qr')?tpl.h-f.size:tpl.h-2;
    f.y=Math.max(0,Math.min(maxY,Math.round(y*2)/2));
    if(k==='qr'){
      const fromRight=(rect.right-pt.clientX)/ppm;        // mm from right edge
      const left=tpl.w-fromRight-f.size/2;                 // convert to left offset, centered on cursor
      f.x=Math.max(0,Math.min(tpl.w-f.size,Math.round(left*2)/2));
    }
    drawPreview();
  };
  const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);save();};
  document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up);
}
function drawCtl(){
  const tpl=lblTpl(),k=_selField,f=tpl.fields[k];
  const who=_editBatch?(state.labels.find(b=>b.id===_editBatch)||{}).client:'';
  let h='';
  if(_editBatch)h+=`<div class="edscope">✎ עורך מדבקה של <b>${who||'לקוח'}</b> בלבד
    <button class="btn ghost sm" onclick="resetBatchTpl()">בטל עיצוב אישי</button></div>`;
  h+=`<div class="led-tabs">${Object.keys(FLABEL).map(x=>`<button class="${x===k?'on':''}" onclick="_selField='${x}';drawPreview()">${esc(FLABEL[x])}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" ${f.show?'checked':''} onchange="setLblF('${k}','show',this.checked?1:0)"> הצג שדה</label>`;
  if(k==='logo'){
    h+=`<div class="fld"><label>קובץ תמונה</label><input type="file" accept="image/*" onchange="loadLogo(event)"></div>
      ${f.src?`<div class="fld"><label>תצוגה</label><img src="${f.src}" class="logoprev"><button class="btn ghost sm" onclick="setLblF('logo','src','')">הסר</button></div>`:'<div class="hint">בחר קובץ PNG/JPG. מומלץ רקע שקוף.</div>'}
      <div class="fld"><label>גודל (מ"מ)</label><input type="range" min="6" max="60" value="${esc(f.size)}" oninput="setLblF('logo','size',+this.value)"><b>${esc(f.size)}</b></div>
      <div class="fld"><label>מיקום אופקי</label><input type="range" min="0" max="${Math.max(0,tpl.w-f.size)}" value="${esc(f.x)}" oninput="setLblF('logo','x',+this.value)"></div>
      <div class="fld"><label>מיקום אנכי</label><input type="range" min="0" max="${Math.max(0,tpl.h-f.size)}" value="${esc(f.y)}" oninput="setLblF('logo','y',+this.value)"></div>`;
  } else if(k==='qr'){
    h+=`<div class="fld"><label>גודל (מ"מ)</label><input type="range" min="10" max="60" value="${esc(f.size)}" oninput="setLblF('qr','size',+this.value)"><b>${esc(f.size)}</b></div>
        <div class="fld"><label>מיקום אופקי</label><input type="range" min="0" max="${Math.max(0,tpl.w-f.size)}" value="${esc(f.x)}" oninput="setLblF('qr','x',+this.value)"></div>
        <div class="fld"><label>מיקום אנכי</label><input type="range" min="0" max="${Math.max(0,tpl.h-f.size)}" value="${esc(f.y)}" oninput="setLblF('qr','y',+this.value)"></div>`;
  } else {
    if(k==='title')h+=`<div class="fld"><label>טקסט (ריק = שם היקב)</label><input value="${esc(f.text||'')}" placeholder="${state.settings.title||'יקב טורא'}" onchange="setLblF('title','text',this.value)"></div>
      <label class="chk"><input type="checkbox" ${f.line?'checked':''} onchange="setLblF('title','line',this.checked?1:0)"> קו הפרדה מתחת</label>`;
    h+=`<div class="fld"><label>גופן</label><select onchange="setLblF('${k}','font',this.value)">${LBLFONTS.map(x=>`<option ${f.font===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="fld"><label>גודל (מ"מ)</label><input type="range" min="2" max="14" step="0.5" value="${esc(f.size)}" oninput="setLblF('${k}','size',+this.value)"><b>${esc(f.size)}</b></div>
      <div class="fld"><label>צבע</label><input type="color" value="${esc(f.color)}" oninput="setLblF('${k}','color',this.value)"></div>
      <label class="chk"><input type="checkbox" ${f.bold?'checked':''} onchange="setLblF('${k}','bold',this.checked?1:0)"> מודגש</label>
      <div class="fld"><label>יישור</label><select onchange="setLblF('${k}','align',this.value)">
        <option value="center" ${f.align==='center'?'selected':''}>מרכז</option>
        <option value="right" ${f.align==='right'?'selected':''}>ימין</option>
        <option value="left" ${f.align==='left'?'selected':''}>שמאל</option></select></div>
      <div class="fld"><label>מיקום אנכי (מ"מ)</label><input type="range" min="0" max="${tpl.h-2}" step="0.5" value="${esc(f.y)}" oninput="setLblF('${k}','y',+this.value)"><b>${esc(f.y)}</b></div>`;
  }
  document.getElementById('ledctl').innerHTML=h;
}
function loadLogo(ev){
  const f=ev.target.files[0];if(!f)return;
  if(f.size>900000){toast('התמונה גדולה מדי (עד ~900KB)');return;}
  const r=new FileReader();
  r.onload=()=>{                       // downscale to keep the file small & sync-friendly
    const img=new Image();
    img.onload=()=>{
      const M=400,sc=Math.min(1,M/Math.max(img.width,img.height));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      setLblF('logo','src',c.toDataURL('image/png'));
      setLblF('logo','show',1);
      toast('הסמל נטען ✓');
    };
    img.src=r.result;
  };
  r.readAsDataURL(f);ev.target.value='';
}
function setLblF(k,p,v){const f=lblTpl().fields;if(!f||!f[k])return;f[k][p]=v;save();drawPreview();}
function setTplSize(k,v){lblTpl()[k]=Math.max(20,+v||100);save();drawPreview();}
function resetTpl(){if(!confirm('לאפס את עיצוב המדבקה?'))return;
  if(_editBatch){const b=state.labels.find(x=>x.id===_editBatch);if(b)b.tpl=JSON.parse(JSON.stringify(lblTplGlobal()));}
  else state.settings.labelTpl=defaultTpl();
  save();drawPreview();}
function resetBatchTpl(){if(!confirm('לבטל את העיצוב האישי ולחזור לעיצוב הכללי?'))return;
  const b=state.labels.find(x=>x.id===_editBatch);if(b)delete b.tpl;
  save();closeModal();_editBatch=null;renderLabels();toast('חזר לעיצוב הכללי');}
/* ---------- loading scan ---------- */
let _scanStream=null,_scanRAF=null,_lastCode='',_lastCodeT=0,_ac=null;
let _torch=false,_scanFrames=0;
function openScanner(){
  if(!state.labels||!state.labels.length){toast('אין לקוחות לסריקה');return;}
  document.getElementById('scanov').style.display='flex';
  scanMsg('טוען רכיב סריקה…');
  needLib('jsqr').then(startScanner).catch(()=>scanMsg('טעינת רכיב הסריקה נכשלה — בדוק חיבור אינטרנט','bad'));
}
function startScanner(){
  scanMsg('מפעיל מצלמה…');
  updateScanPanel();
  const video=document.getElementById('scanvid');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    scanMsg('הדפדפן לא תומך במצלמה. יש לפתוח מכתובת https.','bad');return;}
  navigator.mediaDevices.getUserMedia({video:{
      facingMode:{ideal:'environment'},
      width:{ideal:1280},height:{ideal:1280},
      focusMode:'continuous'
    },audio:false}).then(st=>{
    _scanStream=st;video.srcObject=st;
    video.setAttribute('playsinline','');video.muted=true;
    return video.play();
  }).then(()=>{
    scanMsg('מחפש ברקוד…');
    _scanFrames=0;
    setupTorch();
    _scanRAF=requestAnimationFrame(scanTick);
  }).catch(e=>{
    const n=e&&e.name?e.name:'';
    let m='לא ניתן לפתוח את המצלמה';
    if(n==='NotAllowedError')m='ההרשאה למצלמה נדחתה. אשר גישה למצלמה בהגדרות האתר בדפדפן.';
    else if(n==='NotFoundError')m='לא נמצאה מצלמה במכשיר.';
    else if(n==='NotReadableError')m='המצלמה תפוסה על ידי אפליקציה אחרת. סגור אותה ונסה שוב.';
    else if(location.protocol!=='https:')m='הסריקה עובדת רק מכתובת https (האתר ב-Netlify), לא מקובץ מקומי.';
    scanMsg(m,'bad');
  });
}
function setupTorch(){
  const btn=document.getElementById('torchBtn');if(!btn)return;
  try{
    const tr=_scanStream.getVideoTracks()[0];
    const caps=tr.getCapabilities?tr.getCapabilities():{};
    btn.style.display=caps.torch?'inline-block':'none';
  }catch(e){btn.style.display='none';}
}
function toggleTorch(){
  try{const tr=_scanStream.getVideoTracks()[0];_torch=!_torch;
    tr.applyConstraints({advanced:[{torch:_torch}]});
    document.getElementById('torchBtn').classList.toggle('on',_torch);
  }catch(e){toast('הפנס לא נתמך במכשיר');}
}
function closeScanner(){
  document.getElementById('scanov').style.display='none';
  if(_scanRAF)cancelAnimationFrame(_scanRAF);_scanRAF=null;
  if(_scanStream){_scanStream.getTracks().forEach(t=>t.stop());_scanStream=null;}
  _torch=false;renderLabels();
}
function scanTick(){
  const video=document.getElementById('scanvid'),c=document.getElementById('scancan');
  if(video&&video.videoWidth>0&&video.readyState>=2){
    const W=video.videoWidth,H=video.videoHeight;
    // downscale big frames for speed, but keep enough detail
    const max=800,sc=Math.min(1,max/Math.max(W,H));
    c.width=Math.round(W*sc);c.height=Math.round(H*sc);
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(video,0,0,c.width,c.height);
    try{
      const img=ctx.getImageData(0,0,c.width,c.height);
      const code=jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});
      if(code&&code.data)handleScan(code.data);
      else if((++_scanFrames%45)===0){
        const e=document.getElementById('scanmsg');
        if(e&&!e.classList.contains('ok')&&!e.classList.contains('bad'))scanMsg('מחפש ברקוד… החזק יציב, 15–25 ס"מ');
      }
    }catch(err){scanMsg('שגיאת סריקה: '+err.message,'bad');}
  }
  _scanRAF=requestAnimationFrame(scanTick);
}
function handleScan(data){
  const now=Date.now();
  if(data===_lastCode&&now-_lastCodeT<1200)return;_lastCode=data;_lastCodeT=now;
  const p=String(data).split('|');
  if(p[0]!=='TURA'){
    /* ברקוד מוצר רגיל — מציג היכן הוא במחסן */
    if(/^\d{6,14}$/.test(String(data).trim())&&typeof findByBarcode==='function'){
      const r=findByBarcode(String(data).trim());
      if(r.product||r.entries.length){
        const tot=r.entries.reduce((s,e)=>s+(+e.units||0),0);
        const loc=r.entries.filter(e=>e.prow>0).map(e=>e.prow+'-'+e.pcol).slice(0,4).join(', ');
        scanMsg('📦 '+((r.product&&r.product.n)||'מוצר')+(loc?' · '+loc:'')+(tot?' · '+Math.round(tot)+' יח׳':' · אין מלאי'),'ok');
        beepOk();return;
      }
    }
    scanMsg('ברקוד לא שייך למערכת','bad');beepBad();return;}
  const key=p[1],n=+p[2];
  const b=findBatchByCode(key);
  if(!b){
    scanMsg('קוד '+key+' לא קיים ברשימה. ייתכן שהמדבקה מהדפסה ישנה — הדפס מחדש, או הוסף ידנית.','bad');
    beepBad();showRescue(key,n);return;
  }
  const tot=batchTotal(b);b.scanned=b.scanned||[];
  const bx=boxesOf(b).find(x=>x.n===n);
  if(!bx){scanMsg('ארגז '+n+' לא קיים אצל '+b.client,'bad');beepBad();return;}
  if(b.scanned.indexOf(n)>=0){scanMsg('⚠ '+b.client+' — ארגז '+n+' כבר נסרק','bad');beepBad();}
  else{b.scanned.push(n);save();
    const done=b.scanned.length;
    scanMsg('✓ '+b.client+' — ארגז '+n+'/'+tot+' · '+bx.text+(done>=tot?' — הלקוח הושלם ✓':''),'ok');
    beepOk();if(navigator.vibrate)navigator.vibrate(60);}
  updateScanPanel();
}
/* if a code is unknown, let the user attach the scan to the right client on the spot */
function showRescue(key,n){
  const el=document.getElementById('scanlist');if(!el)return;
  const opts=(state.labels||[]).filter(b=>batchTotal(b)>=n);
  if(!opts.length)return;
  el.innerHTML='<div class="rescue"><b>לאיזה לקוח שייך ארגז '+n+'?</b>'+
    opts.map(b=>`<button class="btn ghost sm" onclick="adopt('${key}',${b.id},${n})">${b.client} (${batchTotal(b)})</button>`).join('')+
    '<button class="btn ghost sm" onclick="updateScanPanel()">בטל</button></div>';
}
function adopt(key,id,n){
  const b=(state.labels||[]).find(x=>x.id===id);if(!b)return;
  b.code=String(key).toUpperCase();      // re-bind the printed labels to this client
  save();_lastCode='';_lastCodeT=0;
  handleScan('TURA|'+b.code+'|'+n+'|'+batchTotal(b));
}
function scanMsg(t,cls){const e=document.getElementById('scanmsg');if(!e)return;
  e.textContent=t;e.className='scanmsg '+(cls||'');}
function manualBox(){
  const v=(prompt('הזן מספר ארגז (אם הברקוד לא נסרק):')||'').trim();
  if(!v)return;
  const n=parseInt(v);if(!n){toast('מספר לא תקין');return;}
  const opts=(state.labels||[]).filter(b=>batchTotal(b)>=n);
  if(!opts.length){toast('לא נמצא ארגז מתאים');return;}
  let b=opts[0];
  if(opts.length>1){
    const list=opts.map((x,i)=>(i+1)+'. '+x.client).join('\n');
    const pick=parseInt(prompt('לאיזה לקוח?\n\n'+list)||'0');
    if(!pick||!opts[pick-1])return;b=opts[pick-1];
  }
  handleScan('TURA|'+ensureCode(b)+'|'+n+'|'+batchTotal(b));
}
function updateScanPanel(){
  const el=document.getElementById('scanlist');if(!el)return;
  el.innerHTML=(state.labels||[]).map(b=>{const tot=batchTotal(b),d=(b.scanned||[]).length,ok=tot>0&&d>=tot;
    const miss=[];for(let i=1;i<=tot;i++)if((b.scanned||[]).indexOf(i)<0)miss.push(i);
    const ps=productStats(b).map(x=>`<span class="${x.got>=x.exp?'okp':'badp'}">${esc(x.p)} ${x.got}/${x.exp}</span>`).join('');
    return `<div class="sc-row ${ok?'ok':''}"><div><b>${esc(b.client||'—')}</b> ${d}/${tot}${ok?' ✓':(miss.length?' · חסר ארגז: '+miss.join(','):'')}</div><div class="pstat sm">${ps}</div></div>`;}).join('');
}
function beepOk(){beep(880,90);}
function beepBad(){beep(200,200);}
function beep(f,ms){try{_ac=_ac||new (window.AudioContext||window.webkitAudioContext)();const o=_ac.createOscillator(),g=_ac.createGain();o.connect(g);g.connect(_ac.destination);o.frequency.value=f;g.gain.value=.15;o.start();setTimeout(()=>o.stop(),ms);}catch(e){}}


