/* ============ EXCEL / CSV IMPORT ============ */
function csvParse(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else if(c==='"')q=true;
    else if(c===','){row.push(cur);cur='';}
    else if(c==='\n'){row.push(cur);cur='';if(row.some(x=>x!==''))rows.push(row);row=[];}
    else if(c!=='\r')cur+=c;
  }
  row.push(cur);if(row.some(x=>x!==''))rows.push(row);
  return rows;
}
/* מזהה כותרת גם אם Excel שינה קידוד/רווחים */
function normHdr(h){return String(h||'').replace(/^\uFEFF/,'').replace(/["']/g,'').replace(/\s+/g,' ').trim();}
function findCol(hdr,names){
  for(const n of names){const i=hdr.indexOf(n);if(i>=0)return i;}
  for(let i=0;i<hdr.length;i++){for(const n of names){if(hdr[i]&&hdr[i].indexOf(n)>=0)return i;}}
  return -1;
}
function rowsFromCSVText(txt){return csvParse(txt).map(r=>r.map(c=>String(c==null?'':c)));}
/* קורא CSV או XLSX, ומטפל בקידוד עברי של Excel (windows-1255) */
async function readTable(file){
  const name=(file.name||'').toLowerCase();
  if(/\.xlsx?$/.test(name)){
    await needLib('xlsx');
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(new Uint8Array(buf),{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    let maxC=0,maxR=0;
    Object.keys(ws).filter(k=>k[0]!=='!').forEach(k=>{const d=XLSX.utils.decode_cell(k);if(d.c>maxC)maxC=d.c;if(d.r>maxR)maxR=d.r;});
    ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}});
    return XLSX.utils.sheet_to_json(ws,{header:1,defval:''}).map(r=>r.map(c=>String(c==null?'':c)));
  }
  const buf=await file.arrayBuffer();
  let txt=new TextDecoder('utf-8').decode(buf);
  let rows=rowsFromCSVText(txt);
  const looksHebrew=r=>r&&r.some(c=>/[\u0590-\u05FF]/.test(c));
  if(!looksHebrew(rows[0])){                        // כנראה נשמר בקידוד ANSI עברי
    try{const alt=new TextDecoder('windows-1255').decode(buf);
      const r2=rowsFromCSVText(alt);
      if(looksHebrew(r2[0]))rows=r2;}catch(e){}
  }
  return rows;
}
async function importCSV(which,ev){
  const f=ev.target.files[0];if(!f)return;
  ev.target.value='';
  try{
    const rows=await readTable(f);
    if(rows.length<2){toast('הקובץ ריק');return;}
    const hdr=rows[0].map(normHdr);
    if(which==='loc'){
      const cCat=findCol(hdr,['קטגוריה']),cUnits=findCol(hdr,['יחידות']);
      if(cCat<0||cUnits<0){
        alert('מבנה הקובץ לא תואם — לא נמצאו העמודות "קטגוריה" ו/או "יחידות".\n\nהעמודות שזוהו:\n'+hdr.filter(Boolean).join(' · ')+'\n\nייצא קודם מהאפליקציה, ערוך, ושמור כ-CSV UTF-8 או כקובץ Excel.');
        return;
      }
      const c={v:findCol(hdr,['בציר']),t:findCol(hdr,['סוג']),ck:findCol(hdr,['מבושל/לא מבושל','מבושל']),
        lb:findCol(hdr,['תיוות']),cap:findCol(hdr,['קפסולה']),r:findCol(hdr,['שורה']),
        col:findCol(hdr,['עמודה']),lv:findCol(hdr,['מפלס']),bc:findCol(hdr,['ברקוד']),nt:findCol(hdr,['הערות'])};
      const lvlNum=v=>{const t=String(v||'').trim();for(const k in LEVELNAME)if(LEVELNAME[k]===t)return +k;return +t||0;};
      const g=(rw,i)=>i>=0?String(rw[i]==null?'':rw[i]).trim():'';
      const out=[];let id=1;
      rows.slice(1).forEach(rw=>{
        const cat=g(rw,cCat);if(!cat)return;
        const e={id:id++,code:'',origin:'',series:'',category:cat,
          vintage:g(rw,c.v),type:g(rw,c.t)||'יין שיווק',cooked:g(rw,c.ck),label:g(rw,c.lb),
          units:parseFloat(String(rw[cUnits]).replace(/[^\d.\-]/g,''))||0,
          prow:parseInt(g(rw,c.r))||0,pcol:parseInt(g(rw,c.col))||0,plevel:lvlNum(g(rw,c.lv)),
          notes:g(rw,c.nt)};
        if(e.prow&&e.pcol&&!e.plevel)e.plevel=1;
        const bc=g(rw,c.bc);if(bc&&bc!=='—')e.barcode=bc;
        const cp=capOf(cat);
        e.capsule=g(rw,c.cap)||cp[0];
        e.capcolor=(typeof CAPCOLORBYNUM!=='undefined'&&CAPCOLORBYNUM[e.capsule])||cp[1];
        e.color=colorOf(cat);
        out.push(e);
      });
      if(!out.length){toast('לא נמצאו שורות');return;}
      if(!confirm('לייבא '+out.length+' מיקומים?\n\nהמלאי הנוכחי ('+state.entries.length+' פריטים) יוחלף.'))return;
      logImportDiff(state.entries,out,'ייבוא Excel — מיקום במחסן');
      state.entries=out;save();refresh();closeModal();
      toast('יובאו '+out.length+' מיקומים — כל המסכים עודכנו');
    } else {
      const ci=SHCOLS.map(c=>findCol(hdr,[c[1]]));
      if(ci[0]<0&&findCol(hdr,['תאריך'])<0){
        alert('מבנה הקובץ לא תואם.\n\nהעמודות שזוהו:\n'+hdr.filter(Boolean).join(' · '));return;}
      const out=[];
      rows.slice(1).forEach(rw=>{
        const o={};let any=false;
        SHCOLS.forEach((c,k)=>{const f=c[0];if(['boxes','pallets','capsule'].includes(f))return;
          let idx=ci[k];if(idx<0&&f==='shipdate')idx=findCol(hdr,['תאריך']);
          if(idx>=0&&rw[idx]!==undefined&&String(rw[idx]).trim()!==''){o[f]=String(rw[idx]).trim();any=true;}});
        if(any){if(o.category)o.capsule=capOf(o.category)[0];out.push(o);}
      });
      if(!out.length){toast('לא נמצאו שורות');return;}
      if(!confirm('לייבא '+out.length+' משלוחים? הרשימה הנוכחית תוחלף.'))return;
      state.shipments=out;save();refresh();closeModal();
      toast('יובאו '+out.length+' משלוחים');
    }
  }catch(e){alert('שגיאה בקריאת הקובץ: '+(e&&e.message||e));}
}
