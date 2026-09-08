/* ============ LIONWHEEL ROUTE IMPORT ============ */
function boxRules(){
  if(!state.settings.boxRules)state.settings.boxRules={def:12,rules:[
    {match:'שמן זית 5',units:4},{match:'שמן זית 2',units:6},{match:'שמן זית 750',units:12},
    {match:'שמן זית 500',units:12},{match:'שמן זית 250',units:12},
    {match:'בקבוק',units:1},{match:'בקבוקים',units:1},{match:'ארגז',units:1},{match:'פקק',units:1}]};
  /* השלמה לכללים שנשמרו לפני שהוספנו את המוצרים הלא-יין */
  const r=state.settings.boxRules.rules||(state.settings.boxRules.rules=[]);
  [['בקבוק',1],['ארגז',1],['פקק',1]].forEach(([m,u])=>{if(!r.some(x=>x.match===m))r.push({match:m,units:u});});
  return state.settings.boxRules;
}
function unitsPerBox(name){
  const br=boxRules();
  const hit=(br.rules||[]).find(r=>r.match&&name.indexOf(r.match)>=0);
  return hit?(+hit.units||12):(+br.def||12);
}
/* parse the "פריטים" cell: lines like  12.0: הרטלנד 2024(7290019158646) */
/* שורות שאינן מוצר פיזי — דמי משלוח, עמלות, הנחות וכד'.
   "מבצע"/"מארז מבצע" מוחרג מהסינון כשיש ברקוד מלא (13 ספרות) — סימן שזה מוצר אמיתי ולא שורת מבצע גנרית. */
function nonProductLine(name,barcode){
  const promoWord=/(^|\s)(מבצע|מבצעי|מארז מבצע)(\s|$|\b)/.test(name);
  if(promoWord&&/^\d{13}$/.test(String(barcode||'').trim()))return false;
  return /(^|\s)(משלוח|משלוחים|דמי|עמלה|עמלת|הנחה|הנחת|זיכוי|החזר|שירות|טיפול|אריזה בתשלום|תשלום|מע"?מ|עגלה|קופון|מנוי|מבצע|מבצעי|מארז מבצע)(\s|$|\b)/.test(name)
      || /\d+\s*\+\s*\d+/.test(name)                       /* 11+1, 5+1 וכד' */
      || /^(משלוח|shipping|delivery|fee|discount|coupon|promo)/i.test(name);
}
function parseItemsCell(cell){
  const out=[],skipped=[];
  String(cell||'').split(/[\r\n]+/).forEach(line=>{
    line=line.trim();if(!line)return;
    /* הברקוד אינו חובה — מוצרים פנימיים (בקבוקים ריקים, ארגזים) לעיתים בלי ברקוד או עם קוד קצר */
    let m=line.match(/^([\d.]+)\s*:\s*(.+?)\s*\(([^)]*)\)\s*$/);
    let qty,name,bc='';
    if(m){qty=Math.round(parseFloat(m[1])||0);name=m[2].trim();bc=(m[3]||'').trim();}
    else{
      m=line.match(/^([\d.]+)\s*:\s*(.+?)\s*$/);      // בלי סוגריים בכלל
      if(!m){skipped.push(line);return;}
      qty=Math.round(parseFloat(m[1])||0);name=m[2].trim();
    }
    if(!qty||!name){skipped.push(line);return;}
    if(nonProductLine(name,bc))return;                    // דמי משלוח וכד' — לא מדבקה
    if(name.indexOf("דולצ'טו")>=0)name+=' — כולל מארז יחיד';
    out.push({qty,name,barcode:bc});
  });
  if(skipped.length)console.warn('שורות פריט שלא זוהו:',skipped);
  window.__lwSkipped=(window.__lwSkipped||[]).concat(skipped);
  return out;
}
/* pack products into boxes: full boxes per product, then leftovers combined into mixed boxes */
function packBoxes(prods,cap){
  cap=cap||12;
  const items=[],leftovers=[];
  prods.forEach(p=>{
    const b=unitsPerBox(p.name);
    const full=Math.floor(p.qty/b),rem=p.qty-full*b;
    if(full>0)items.push({contents:[p.name],count:full,units:b});
    if(rem>0)leftovers.push({name:p.name,qty:rem});
  });
  /* שאריות: קודם כל מוצר שיש לו כלל משלו מקבל ארגז לפי הכלל שלו —
     אחרת שארית של 30 "שקית יין" (50 לארגז) הייתה מתחלקת לפי 12. */
  const own=[],mixed=[];
  leftovers.forEach(l=>{
    const b=unitsPerBox(l.name);
    if(b!==cap)own.push(l); else mixed.push(l);
  });
  own.forEach(l=>{
    const b=unitsPerBox(l.name);
    const n=Math.max(1,Math.ceil(l.qty/b));
    items.push({contents:[l.name],count:n,units:b});
  });
  // greedily fill mixed boxes up to `cap` units
  let cur=[],curU=0;
  mixed.forEach(l=>{
    let left=l.qty,guard=0;
    while(left>0&&guard++<10000){
      const room=Math.max(1,cap-curU);            /* לעולם לא 0 — מונע לולאה אינסופית */
      const take=Math.min(left,room);
      if(cur.indexOf(l.name)<0)cur.push(l.name);
      curU+=take;left-=take;
      if(curU>=cap){items.push({contents:cur.slice(),count:1});cur=[];curU=0;}
    }
  });
  if(cur.length)items.push({contents:cur,count:1});
  return items;
}
function importLionWheel(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async ()=>{
    try{
      toast('טוען רכיב Excel…');
      await needLib('xlsx');
      const wb=XLSX.read(new Uint8Array(r.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      // LionWheel exports a broken !ref (e.g. A1:B15) — rebuild it from actual cells
      let maxC=0,maxR=0;
      Object.keys(ws).filter(k=>k[0]!=='!').forEach(k=>{const d=XLSX.utils.decode_cell(k);if(d.c>maxC)maxC=d.c;if(d.r>maxR)maxR=d.r;});
      ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}});
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      const hi=rows.findIndex(row=>row.indexOf('פריטים')>=0);
      if(hi<0){alert('לא נמצאה טבלת משלוחים בקובץ. ודא שזה ייצוא "משלוחים" מ-LionWheel.');return;}
      const H=rows[hi].map(x=>String(x).trim());
      const C=n=>H.indexOf(n);
      const cItems=C('פריטים'),cName=C('שם'),cPkg=C('מספר חבילות'),cCity=C('עיר'),
            cStreet=C('רחוב'),cNo=C('מספר בניין'),cPhone=C('טלפון'),cNotes=C('הערות'),
            cTime=C('זמן הגעה'),cOrder=C('מזהה הזמנה');
      // route date = first date-looking cell above the header
      let routeDate=localDate();
      for(let i=0;i<hi;i++){const v=String(rows[i][0]||'').trim();
        const m=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if(m){routeDate=m[3]+'-'+m[2]+'-'+m[1];break;}}
      window.__lwSkipped=[];
      const added=[];const warn=[];
      rows.slice(hi+1).forEach((row,k)=>{
        const client=String(row[cName]||'').trim();
        if(!client||client==='סכום')return;
        const prods=parseItemsCell(row[cItems]);
        const lwPkg=Math.round(parseFloat(row[cPkg])||0);
        let items=packBoxes(prods);
        let n=items.reduce((t,i)=>t+i.count,0);
        if(!n){                                   // no parsable items (e.g. pickup) — fall back to LionWheel count
          if(lwPkg>0)items=[{contents:[],count:lwPkg}];else return;
          n=lwPkg;
        }
        if(lwPkg&&n!==lwPkg)warn.push(client+' ('+n+' במקום '+lwPkg+')');
        const addr=[String(row[cStreet]||'').trim(),String(row[cNo]||'').trim()].filter(Boolean).join(' ');
        const prev=(state.labels||[]).find(x=>x.client===client&&x.date===routeDate);
        added.push({id:Date.now()+k,code:prev?prev.code:'',client,date:routeDate,items,scanned:[],
          prods:prods.map(p=>({q:p.qty,n:p.name})),
          city:String(row[cCity]||'').trim(),address:addr,
          phone:String(row[cPhone]||'').trim(),notes:String(row[cNotes]||'').trim(),
          stop:String(row[0]||'').trim(),time:String(row[cTime]||'').trim(),
          order:String(row[cOrder]||'').trim(),lwPkg});
      });
      if(!added.length){alert('לא נמצאו משלוחים בקובץ.');return;}
      if(window.__lwSkipped&&window.__lwSkipped.length){
        setTimeout(()=>alert('שים לב — שורות פריט שלא זוהו ולא נכנסו למדבקות:\n\n'+window.__lwSkipped.slice(0,10).join('\n')),700);
      }
      const rep=confirm('נמצאו '+added.length+' לקוחות במסלול.\n\nאישור = החלפת הרשימה הקיימת.\nביטול = הוספה לרשימה הקיימת.');
      state.labels=rep?added:(state.labels||[]).concat(added);
      ensureAllCodes();save();renderLabels();
      if(typeof tkFromRoute==='function')tkFromRoute(added.length,routeDate);
      if(typeof saveRoute==='function')setTimeout(()=>saveRoute(true),300);
      let msg='יובאו '+added.length+' לקוחות · '+added.reduce((t,b)=>t+batchTotal(b),0)+' ארגזים';
      toast(msg);
      if(warn.length)setTimeout(()=>alert('שים לב — מספר הארגזים שחושב שונה ממה שרשום ב-LionWheel אצל:\n\n'+warn.join('\n')+'\n\nאפשר לתקן ידנית בכל לקוח.'),400);
    }catch(e){alert('שגיאה בקריאת הקובץ: '+e.message);}
  };
  r.readAsArrayBuffer(f);ev.target.value='';
}
/* box-size rules editor */
function openBoxRules(){
  const br=boxRules(),box=document.getElementById('modalbox');
  box.className='box';
  let h=`<h3>יחידות בארגז</h3><div class="hint">קובע כמה יחידות נכנסות לארגז בייבוא ממסלול הפצה. שורה מתאימה אם שם המוצר <b>מכיל</b> את הטקסט.</div>
   <div class="fld" style="margin:10px 0"><label>ברירת מחדל (יין)</label><input type="number" style="width:70px" value="${esc(br.def)}" onchange="boxRules().def=+this.value||12;save()"></div>
   <table class="itemtbl"><thead><tr><th>אם שם המוצר מכיל…</th><th>יחידות בארגז</th><th></th></tr></thead><tbody>`;
  (br.rules||[]).forEach((r,i)=>{h+=`<tr>
    <td><input value="${esc(r.match||'')}" onchange="boxRules().rules[${i}].match=this.value;save()"></td>
    <td><input type="number" style="width:70px" value="${esc(r.units)}" onchange="boxRules().rules[${i}].units=+this.value||12;save()"></td>
    <td><button class="del" onclick="boxRules().rules.splice(${i},1);save();openBoxRules()">✕</button></td></tr>`;});
  h+=`</tbody></table><button class="btn ghost sm" onclick="boxRules().rules.push({match:'',units:12});save();openBoxRules()">+ הוסף כלל</button>
   <div class="actions"><button class="btn" onclick="closeModal()">סגור</button></div>`;
  box.innerHTML=h;
  document.getElementById('modal').classList.add('open');
}


