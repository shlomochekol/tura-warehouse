/* ============ ברקודים: התאמה למלאי וחיפוש ============ */
let _bcIdx=null;
/* נרמול אחיד — מסיר רווחים, מקפים ואפסים מובילים */
function normBc(v){const t=String(v==null?'':v).trim().replace(/[\s-]/g,'');return t.replace(/^0+(?=\d)/,'');}
/* מנרמל את שדה "מבושל" למפתח התאמה — רק "מבושל" עצמו נחשב שונה;
   "לא מבושל" וריק מתייחסים כאותו הדבר (ברירת מחדל = לא מבושל) */
function bcCookKey(v){return v==='מבושל'?'מבושל':'';}
/* מפתח ההתאמה של פריט מלאי: קטגוריה+בציר+סוג+מבושל. חובה לכלול "מבושל" —
   ליין מבושל ולא-מבושל מאותה קטגוריה/בציר/סוג יש ברקוד שונה בפועל. */
function bcKeyOf(e){return (e.category||'')+'|'+(e.vintage||'')+'|'+(e.type||'')+'|'+bcCookKey(e&&e.cooked);}
/* מפתח "ישן" (בלי מבושל) — לתאימות לאחור מול ברקודים שהוזנו ידנית
   לפני התיקון הזה, כשלא הייתה הבחנה. */
function bcKeyLegacy(e){return (e.category||'')+'|'+(e.vintage||'')+'|'+(e.type||'');}
function bcIndex(){
  if(_bcIdx)return _bcIdx;
  const byKey={},byCode={},seen={};
  const addKey=(kk,b)=>{
    if(seen[kk]===undefined){seen[kk]=b;byKey[kk]=b;}
    else if(seen[kk]!==b)byKey[kk]='';           // שני מוצרים שונים על אותו מפתח — לא מנחשים, לא ממתאמים אוטומטית
  };
  (typeof PRODUCTS!=='undefined'?PRODUCTS:[]).forEach(p=>{
    if(p.b)byCode[normBc(p.b)]=p;
    if(p.c&&p.v&&p.t){
      const ck=bcCookKey(p.k);
      addKey(p.c+'|'+p.v+'|'+p.t+'|'+ck,p.b);
      if(p.t==='יין שיווק')                      // ארכיון = אותו בקבוק
        addKey(p.c+'|'+p.v+'|ארכיון|'+ck,p.b);
    }
  });
  _bcIdx={byKey,byCode};return _bcIdx;
}
/* הברקוד של פריט מלאי — ידני אם הוזן, אחרת ברקוד קבוצתי (כולל הבחנת
   מבושל/לא-מבושל), אחרת מהקטלוג. */
function barcodeOf(e){
  if(!e)return '';
  if(e.barcode)return String(e.barcode);                       // ברקוד על הפריט עצמו
  const k=bcKeyOf(e);
  try{
    const c=(state.settings&&state.settings.barcodes)||{};      // ברקוד שהוזן ידנית לקבוצה
    if(c[k])return String(c[k]);
    const legacy=bcKeyLegacy(e);
    if(legacy!==k&&c[legacy])return String(c[legacy]);          // תאימות לאחור לברקודים שהוזנו לפני התיקון
  }catch(err){}
  return bcIndex().byKey[k]||'';
}
function productByCode(code){return bcIndex().byCode[normBc(code)]||null;}
/* ============ עריכת ברקוד ישירות משורת "מיקום במחסן" ============
   עד כה אפשר היה רק לצפות (openBarcodeResult) — אין דרך לתקן/למחוק
   ברקוד שגוי בלי לחפש אותו במסך "ניהול ברקודים" הנפרד. */
let _bcAssignEntryId=null;
function scanForEntry(id){_bcAssignEntryId=id;closeModal();openBarcodeScan();}
function openEntryBarcode(id){
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
  const box=document.getElementById('modalbox');box.className='box';
  const key=bcKeyOf(e);
  const groupBc=customBc()[key]||customBc()[bcKeyLegacy(e)]||'';
  const catalogBc=bcIndex().byKey[key]||'';
  const eff=barcodeOf(e);
  const source=e.barcode?'הוזן ידנית על הפריט הזה בלבד':(groupBc?'ברקוד קבוצתי שהוזן ידנית':(catalogBc?'מהקטלוג':''));
  box.innerHTML=`<h3>ברקוד — ${esc(e.category||'')} ${esc(e.vintage||'')}</h3>
   <div class="hint">${esc(e.type||'')}${e.cooked?' · '+esc(e.cooked):' · לא מבושל'} — יין מבושל ולא-מבושל מאותה קטגוריה/בציר/סוג נשמרים כברקודים נפרדים.</div>
   <div class="hint" style="margin-top:6px">${eff?('הברקוד הנוכחי: <b style="font-family:monospace">'+esc(eff)+'</b>'+(source?' · '+esc(source):'')):'אין ברקוד לפריט הזה כרגע.'}</div>
   <div class="fld" style="margin-top:10px"><label>ברקוד לפריט הזה בלבד (גובר על הכול)</label>
     <input value="${esc(e.barcode||'')}" placeholder="—" style="font-family:monospace" onchange="setEntryOwnBarcode(${id},this.value)"></div>
   <div class="fld"><label>ברקוד לכל הקבוצה (${esc(e.category||'')} · ${esc(e.vintage||'')} · ${esc(e.type||'')} · ${e.cooked?esc(e.cooked):'לא מבושל'})</label>
     <input value="${esc(groupBc)}" placeholder="${esc(catalogBc||'—')}" style="font-family:monospace" onchange="setBarcodeFor('${key.replace(/'/g,"\\'")}',this.value);openEntryBarcode(${id})"></div>
   <div class="actions">
     <button class="btn ghost" onclick="scanForEntry(${id})">📷 סרוק ברקוד לפריט הזה</button>
     ${eff?`<button class="btn warn" onclick="deleteEntryBarcode(${id})">מחק ברקוד</button>`:''}
     <button class="btn" onclick="closeModal();if(!renderLocRow(${id}))refresh();">סגור</button>
   </div>`;
  document.getElementById('modal').classList.add('open');
}
function setEntryOwnBarcode(id,v){
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
  v=String(v||'').trim();
  if(v)e.barcode=v;else delete e.barcode;
  _bcIdx=null;save();openEntryBarcode(id);
}
/* מחיקה "חכמה": קודם ברקוד שהוזן ישירות על הפריט, אחרת הברקוד הקבוצתי
   (חוזר אז למה שבקטלוג, אם יש) */
function deleteEntryBarcode(id){
  const e=(state.entries||[]).find(x=>x.id===id);if(!e)return;
  if(e.barcode)delete e.barcode;
  else{const c=customBc();delete c[bcKeyOf(e)];delete c[bcKeyLegacy(e)];}
  _bcIdx=null;save();openEntryBarcode(id);
}
/* איפה במחסן נמצא מוצר לפי ברקוד */
function findByBarcode(code){
  const p=productByCode(code);
  const target=normBc(code);
  const hits=(state.entries||[]).filter(e=>normBc(barcodeOf(e))===target);
  return {product:p,entries:hits};
}
function openBarcodeResult(code){
  const {product,entries}=findByBarcode(code);
  const box=document.getElementById('modalbox');box.className='box';
  const tot=entries.reduce((s,e)=>s+(+e.units||0),0);
  const pal=entries.reduce((s,e)=>s+derive(e).pallets,0);
  let h=`<h3>${product?esc(product.n):'ברקוד '+esc(code)}</h3>
   <div class="hint">ברקוד: <b>${esc(code)}</b>${product&&product.c?' · '+esc(product.c)+' '+esc(product.v||''):''}</div>`;
  if(!entries.length){
    h+=`<div class="hint" style="margin-top:10px">${product?'המוצר מוכר, אך אין ממנו מלאי משובץ במחסן.':'הברקוד לא נמצא בקטלוג ולא במלאי.'}</div>`;
  }else{
    h+=`<div class="kpis k2" style="margin:10px 0">
      ${kpi('סה"כ יחידות',Math.round(tot).toLocaleString(),'','var(--navy)')}
      ${kpi('משטחים',pal.toFixed(2),'','var(--gold-d)')}</div>
     <div class="tablewrap" style="max-height:280px"><table><thead><tr>
       <th>מיקום</th><th>מפלס</th><th>סוג</th><th>מבושל</th><th>תיוות</th><th>יחידות</th><th>ארגזים</th></tr></thead><tbody>
     ${entries.sort((a,b)=>(a.prow-b.prow)||(a.pcol-b.pcol)).map(e=>{const d=derive(e);
       return `<tr><td><b>${e.prow>0?e.prow+'-'+e.pcol:'ללא מיקום'}</b></td><td>${LEVELNAME[e.plevel]||'—'}</td>
       <td>${esc(e.type||'')}</td><td>${esc(e.cooked||'')}</td><td>${esc(e.label||'')}</td>
       <td>${Math.round(+e.units||0).toLocaleString()}</td><td>${d.boxes.toFixed(1)}</td></tr>`;}).join('')}
     </tbody></table></div>`;
  }
  h+=`<div class="actions"><button class="btn" onclick="closeModal()">סגור</button></div>`;
  box.innerHTML=h;document.getElementById('modal').classList.add('open');
}
/* חיפוש ידני לפי ברקוד */
function promptBarcode(){
  const c=(prompt('הזן או סרוק ברקוד מוצר:')||'').trim();
  if(c)openBarcodeResult(c);
}

/* ============ סריקת ברקוד (קווי EAN + QR) ============ */
let _bcStream=null,_bcRAF=null,_bcLast='',_bcLastT=0,_bcDetector=null,_bcZX=null,_bcBusy=false;
/* מנוע 1: BarcodeDetector המובנה בדפדפן (הכי מהיר, קיים בכרום אנדרואיד) */
async function bcInitEngine(){
  if(_bcDetector||_bcZX)return;
  if('BarcodeDetector' in window){
    try{
      const f=await BarcodeDetector.getSupportedFormats();
      const want=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'].filter(x=>f.includes(x));
      if(want.length){_bcDetector=new BarcodeDetector({formats:want});return;}
    }catch(e){}
  }
  /* מנוע 2: ZXing — נטען רק אם אין תמיכה מובנית */
  await needLib('zxing');
  const hints=new Map();
  const F=ZXing.BarcodeFormat;
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,
    [F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_128,F.CODE_39,F.ITF,F.QR_CODE]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER,true);
  _bcZX=new ZXing.MultiFormatReader();
  _bcZX.setHints(hints);
}
function openBarcodeScan(){
  const ov=document.getElementById('bcscan');ov.style.display='flex';
  bcMsg('טוען רכיב סריקה…');
  bcInitEngine().then(()=>{
    bcMsg('מפעיל מצלמה…');
    const v=document.getElementById('bcvid');
    return navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},
      width:{ideal:1920},height:{ideal:1080},focusMode:'continuous'}})
      .then(st=>{_bcStream=st;v.srcObject=st;v.setAttribute('playsinline','');v.muted=true;return v.play();});
  }).then(()=>{
    bcMsg('כוון את הברקוד למסגרת · '+(_bcDetector?'מהיר':'ZXing'));
    setupBcTorch();
    _bcRAF=requestAnimationFrame(bcTick);
  }).catch(e=>{
    const n=e&&e.name;
    bcMsg(n==='NotAllowedError'?'ההרשאה למצלמה נדחתה — אשר גישה בהגדרות האתר'
      :(location.protocol!=='https:'?'הסריקה עובדת רק מכתובת https (האתר ב-Netlify)'
      :'לא ניתן לפתוח מצלמה: '+(e&&e.message||'')),'bad');
  });
}
function setupBcTorch(){
  const btn=document.getElementById('bctorch');if(!btn||!_bcStream)return;
  try{const tr=_bcStream.getVideoTracks()[0];const caps=tr.getCapabilities?tr.getCapabilities():{};
    btn.style.display=caps.torch?'inline-block':'none';}catch(e){btn.style.display='none';}
}
let _bcTorchOn=false;
function toggleBcTorch(){
  try{const tr=_bcStream.getVideoTracks()[0];_bcTorchOn=!_bcTorchOn;
    tr.applyConstraints({advanced:[{torch:_bcTorchOn}]});
    document.getElementById('bctorch').classList.toggle('on',_bcTorchOn);
  }catch(e){toast('הפנס לא נתמך');}
}
function closeBarcodeScan(){
  document.getElementById('bcscan').style.display='none';
  if(_bcRAF)cancelAnimationFrame(_bcRAF);_bcRAF=null;
  if(_bcStream){_bcStream.getTracks().forEach(t=>t.stop());_bcStream=null;}
  _bcTorchOn=false;_bcBusy=false;
}
function bcMsg(t,cls){const e=document.getElementById('bcmsg');if(e){e.textContent=t;e.className='scanmsg '+(cls||'');}}
function bcHit(val){
  const now=Date.now();
  if(val===_bcLast&&now-_bcLastT<1500)return;
  _bcLast=val;_bcLastT=now;
  if(navigator.vibrate)navigator.vibrate(60);
  closeBarcodeScan();
  if(_bcAssignEntryId!=null){const id=_bcAssignEntryId;_bcAssignEntryId=null;
    const e=(state.entries||[]).find(x=>x.id===id);
    if(e){e.barcode=val;_bcIdx=null;save();toast('הברקוד נשמר לפריט: '+val);}
    openEntryBarcode(id);return;}
  if(_bcAssignKey){const k=_bcAssignKey;_bcAssignKey=null;
    customBc()[k]=val;_bcIdx=null;save();toast('הברקוד נשמר: '+val);openBarcodeManager();return;}
  openBarcodeResult(val);
}
async function bcTick(){
  const v=document.getElementById('bcvid'),c=document.getElementById('bccan');
  if(v&&v.videoWidth>0&&v.readyState>=2&&!_bcBusy){
    _bcBusy=true;
    try{
      if(_bcDetector){
        const codes=await _bcDetector.detect(v);
        if(codes&&codes.length){_bcBusy=false;bcHit(String(codes[0].rawValue).trim());return;}
      }else if(_bcZX&&typeof _bcZX.decode==='function'){
        /* חיתוך רצועה מרכזית — ברקוד קווי נקרא טוב יותר כך */
        const W=v.videoWidth,H=v.videoHeight;
        const cw=Math.min(W,1280), ch=Math.round(cw*0.42);
        c.width=cw;c.height=ch;
        const ctx=c.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(v,(W-cw)/2,(H-ch)/2,cw,ch,0,0,cw,ch);
        const img=ctx.getImageData(0,0,cw,ch);
        try{
          const lum=new ZXing.RGBLuminanceSource(toInt32(img),cw,ch);
          const bmp=new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
          const res=_bcZX.decode(bmp);
          if(res&&res.getText()){_bcBusy=false;bcHit(String(res.getText()).trim());return;}
        }catch(e){}
        finally{try{_bcZX.reset();}catch(e){}}
      }
      else{_bcBusy=false;bcMsg('רכיב הסריקה לא נטען — נסה שוב או השתמש בהקלדה ידנית','bad');return;}
    }catch(e){}
    _bcBusy=false;
  }
  _bcRAF=requestAnimationFrame(bcTick);
}
function toInt32(imgData){
  const d=imgData.data,n=imgData.width*imgData.height,out=new Int32Array(n);
  for(let i=0,j=0;i<n;i++,j+=4)out[i]=(0xff<<24)|(d[j]<<16)|(d[j+1]<<8)|d[j+2];
  return out;
}
/* ============ ניהול ברקודים: הוספה ועריכה ============ */
function customBc(){if(!state.settings.barcodes)state.settings.barcodes={};return state.settings.barcodes;}
let _bcQ='',_bcOnlyMissing=false;
function openBarcodeManager(){
  const box=document.getElementById('modalbox');box.className='box wide';
  const groups={};
  (state.entries||[]).forEach(e=>{
    const k=bcKeyOf(e);
    if(!groups[k])groups[k]={cat:e.category,v:e.vintage,t:e.type,cooked:e.cooked||'',n:0,units:0};
    groups[k].n++;groups[k].units+=+e.units||0;
  });
  /* ברקוד שהוזן ישירות על פריט בודד — מוצג גם הוא */
  const perItem={};
  (state.entries||[]).forEach(e=>{if(e.barcode)perItem[bcKeyOf(e)]=String(e.barcode);});
  let L=Object.keys(groups).map(k=>{
    const g=groups[k];
    const grpBc=barcodeOf({category:g.cat,vintage:g.v,type:g.t,cooked:g.cooked});
    return {k,...g,bc:perItem[k]||grpBc,
      custom:!!customBc()[k],onItem:!!perItem[k]};});
  if(_bcOnlyMissing)L=L.filter(x=>!x.bc);
  if(_bcQ){const q=_bcQ.toLowerCase();L=L.filter(x=>(x.cat+' '+x.v+' '+x.t+' '+x.cooked+' '+x.bc).toLowerCase().indexOf(q)>=0);}
  L.sort((a,b)=>(a.cat||'').localeCompare(b.cat||'','he')||String(b.v).localeCompare(String(a.v)));
  const missing=Object.keys(groups).filter(k=>{const g=groups[k];return !barcodeOf({category:g.cat,vintage:g.v,type:g.t,cooked:g.cooked});}).length;
  box.innerHTML=`<h3>ניהול ברקודים</h3>
   <div class="hint">ברקוד שמוזן כאן גובר על הקטלוג. השורות מקובצות לפי קטגוריה · בציר · סוג · מבושל/לא — ליין מבושל ולא-מבושל מאותה קטגוריה/בציר/סוג יש ברקוד שונה ונשמר בנפרד.</div>
   <div class="tk-row3" style="margin:8px 0">
     <div class="fld"><label>חיפוש</label><input id="bcq" value="${esc(_bcQ)}" placeholder="קטגוריה / בציר / ברקוד" oninput="_bcQ=this.value;openBarcodeManager()"></div>
     <div class="fld"><label>&nbsp;</label><label class="chk"><input type="checkbox" ${_bcOnlyMissing?'checked':''} onchange="_bcOnlyMissing=this.checked;openBarcodeManager()"> רק ללא ברקוד (${missing})</label></div>
     <div class="fld"><label>&nbsp;</label><button class="btn ghost sm" onclick="openBarcodeScanFor()">📷 סרוק והוסף</button></div>
   </div>
   <div class="tablewrap" style="max-height:340px"><table><thead><tr>
     <th>קטגוריה</th><th>בציר</th><th>סוג</th><th>מבושל</th><th>מיקומים</th><th>ברקוד</th><th></th></tr></thead><tbody>
   ${L.slice(0,200).map(x=>`<tr>
     <td>${esc(x.cat||'')}</td><td>${esc(x.v||'')}</td><td>${esc(x.t||'')}</td><td>${esc(x.cooked||'—')}</td><td>${esc(x.n)}</td>
     <td><input value="${esc(x.bc||'')}" placeholder="—" style="width:150px;font-family:monospace"
        onchange="setBarcodeFor('${x.k.replace(/'/g,"\\\\'")}',this.value)">${x.custom?' <span class="bctag" title="הוזן ידנית">✎</span>':''}${x.onItem?' <span class="bctag" title="ברקוד על הפריט עצמו">📌</span>':''}</td>
     <td>${x.custom?`<button class="del" title="חזור לקטלוג" aria-label="חזור לקטלוג" onclick="clearBarcodeFor('${x.k.replace(/'/g,"\\\\'")}')">↺</button>`:''}</td></tr>`).join('')}
   ${L.length>200?`<tr><td colspan=7 style="color:var(--muted)">…ועוד ${L.length-200}</td></tr>`:''}
   </tbody></table></div>
   <div class="actions"><button class="btn" onclick="closeModal();refresh()">סגור</button></div>`;
  document.getElementById('modal').classList.add('open');
  const q=document.getElementById('bcq');if(q&&_bcQ){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
function setBarcodeFor(key,v){
  v=String(v||'').trim();
  const c=customBc();
  if(!v){delete c[key];(state.entries||[]).forEach(e=>{if(bcKeyOf(e)===key&&e.barcode)delete e.barcode;});}
  else c[key]=v;
  _bcIdx=null;save();openBarcodeManager();
}
function clearBarcodeFor(key){
  delete customBc()[key];
  (state.entries||[]).forEach(e=>{if(bcKeyOf(e)===key&&e.barcode)delete e.barcode;});
  _bcIdx=null;save();openBarcodeManager();}
/* סריקה שמוסיפה ברקוד לפריט נבחר */
let _bcAssignKey=null;
function openBarcodeScanFor(){
  const groups={};
  (state.entries||[]).forEach(e=>{const k=bcKeyOf(e);if(!groups[k])groups[k]={cat:e.category,v:e.vintage,t:e.type,cooked:e.cooked||''};});
  const missing=Object.keys(groups).filter(k=>!barcodeOf({category:groups[k].cat,vintage:groups[k].v,type:groups[k].t,cooked:groups[k].cooked}));
  if(!missing.length){toast('לכל הפריטים כבר יש ברקוד');return;}
  const box=document.getElementById('modalbox');box.className='box';
  box.innerHTML=`<h3>סרוק והוסף ברקוד</h3>
   <div class="hint">בחר את המוצר, ואז סרוק את הבקבוק — הברקוד יישמר אליו.</div>
   <div class="tablewrap" style="max-height:300px"><table><thead><tr><th>קטגוריה</th><th>בציר</th><th>סוג</th><th>מבושל</th><th></th></tr></thead><tbody>
   ${missing.map(k=>`<tr><td>${esc(groups[k].cat||'')}</td><td>${esc(groups[k].v||'')}</td><td>${esc(groups[k].t||'')}</td><td>${esc(groups[k].cooked||'—')}</td>
     <td><button class="btn sm" onclick="scanForKey('${k.replace(/'/g,"\\\\'")}')">📷 סרוק</button></td></tr>`).join('')}
   </tbody></table></div>
   <div class="actions"><button class="btn ghost" onclick="openBarcodeManager()">חזרה</button></div>`;
  document.getElementById('modal').classList.add('open');
}
function scanForKey(k){_bcAssignKey=k;closeModal();openBarcodeScan();}
