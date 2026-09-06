/* ============ טעינה עצלה של ספריות כבדות ============ */
const _libs={};
function needLib(name){
  if(_libs[name])return _libs[name];
  const src={xlsx:'assets/lib/xlsx.js',jsqr:'assets/lib/jsqr.js',html2canvas:'assets/lib/html2canvas.js',zxing:'assets/lib/zxing.js'}[name];
  if(!src)return Promise.reject(new Error('רכיב לא מוכר: '+name));
  const pr=new Promise((res,rej)=>{
    const t=document.createElement('script');t.src=src;
    t.onload=()=>res(true);
    t.onerror=()=>{try{t.remove();}catch(e){} rej(new Error('טעינת רכיב נכשלה: '+name));};
    document.head.appendChild(t);
  });
  pr.catch(()=>{if(_libs[name]===pr)delete _libs[name];});   /* מאפשר ניסיון חוזר */
  _libs[name]=pr;
  return _libs[name];
}
const KEY='mwe_warehouse_v2';
/* תאריך היום לפי שעון מקומי — toISOString מחזיר UTC ומקדים יום בשעות הלילה */
/* ניקוי תוכן משתמש לפני הכנסה ל-HTML */
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* ---- הגנה כוללת: כל טקסט שמקורו במשתמש עובר ניקוי בשכבת האחסון ---- */
const USER_TEXT_FIELDS=['category','vintage','type','cooked','label','notes','client','title','name','item',
  'city','address','phone','boxType','zone','kind','lang','status','capsule','code','origin','series'];
function sanitizeText(v){
  if(typeof v!=='string')return v;
  /* מסירים תווים שמאפשרים לצאת מהקשר HTML — התוכן נשמר קריא */
  /* מסירים רק תווים שמאפשרים לפתוח תגית. מרכאות נשמרות כפי שהן —
     ההגנה בתצוגה נעשית ב-esc(). */
  return v.replace(/[<>]/g,'');
}
function sanitizeDeep(o,depth){
  depth=depth||0; if(depth>6||!o||typeof o!=='object')return o;
  if(Array.isArray(o)){o.forEach((v,i)=>{ if(typeof v==='string')o[i]=sanitizeText(v); else sanitizeDeep(v,depth+1);});return o;}
  Object.keys(o).forEach(k=>{
    const v=o[k];
    if(typeof v==='string'){ if(USER_TEXT_FIELDS.includes(k)||k==='t'||k==='n')o[k]=sanitizeText(v); }
    else if(v&&typeof v==='object')sanitizeDeep(v,depth+1);
  });
  return o;
}
function sanitizeState(){
  try{
    ['entries','shipments','labels','tasks2','supply','routes'].forEach(k=>{
      if(Array.isArray(state[k]))state[k].forEach(x=>sanitizeDeep(x));
    });
    if(state.board)Object.keys(state.board).forEach(d=>{
      const c=state.board[d];if(c)Object.keys(c).forEach(k=>{if(typeof c[k]==='string')c[k]=sanitizeText(c[k]);});});
    if(Array.isArray(state.customCats))state.customCats=state.customCats.map(sanitizeText);
    /* הגדרות שהמשתמש מזין (קפסולות, צבעים, ברקודים, תבנית מדבקה) */
    const st=state.settings||{};
    if(Array.isArray(st.capNums))st.capNums=st.capNums.map(sanitizeText);
    if(st.capColorMap)Object.keys(st.capColorMap).forEach(k=>{st.capColorMap[k]=sanitizeText(st.capColorMap[k]);});
    if(st.capCatMap)Object.keys(st.capCatMap).forEach(k=>{st.capCatMap[k]=sanitizeText(st.capCatMap[k]);});
    if(st.capColors)Object.keys(st.capColors).forEach(k=>{const c=st.capColors[k];
      if(c){c.bg=sanitizeText(c.bg);c.fg=sanitizeText(c.fg);}});
    if(st.catPalette)Object.keys(st.catPalette).forEach(k=>{const c=st.catPalette[k];
      if(c){c.n=sanitizeText(c.n);c.bg=sanitizeText(c.bg);c.fg=sanitizeText(c.fg);}});
    if(st.catColorMap)Object.keys(st.catColorMap).forEach(k=>{st.catColorMap[k]=sanitizeText(st.catColorMap[k]);});
    if(st.barcodes)Object.keys(st.barcodes).forEach(k=>{st.barcodes[k]=sanitizeText(st.barcodes[k]);});
    if(st.labelTpl&&st.labelTpl.fields)Object.keys(st.labelTpl.fields).forEach(k=>{
      const f=st.labelTpl.fields[k];
      if(f){if(typeof f.text==='string')f.text=sanitizeText(f.text);
        if(typeof f.font==='string')f.font=sanitizeText(f.font);
        if(typeof f.color==='string')f.color=sanitizeText(f.color);}});
    if(st.title)st.title=sanitizeText(st.title);
    if(st.sub)st.sub=sanitizeText(st.sub);
    if(st.boxRules&&Array.isArray(st.boxRules.rules))
      st.boxRules.rules.forEach(r=>{if(r&&typeof r.match==='string')r.match=sanitizeText(r.match);});
    if(Array.isArray(state.supplyItems))state.supplyItems=state.supplyItems.map(sanitizeText);
    if(Array.isArray(state.boardCats))state.boardCats=state.boardCats.map(sanitizeText);
  }catch(e){}
}
function escAttr(t){return esc(t);}
function localDate(d){const t=d?new Date(d):new Date();
  return new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10);}
const HOLIDAYS={"2026-09-12": "ראש השנה", "2026-09-13": "ראש השנה", "2026-09-21": "יום כיפור", "2026-09-26": "סוכות", "2026-09-27": "סוכות", "2026-10-03": "שמיני עצרת", "2026-10-04": "שמחת תורה", "2027-04-22": "פסח", "2027-04-23": "פסח", "2027-04-28": "פסח", "2027-04-29": "פסח", "2027-06-11": "שבועות", "2027-06-12": "שבועות", "2027-10-02": "ראש השנה", "2027-10-03": "ראש השנה", "2027-10-11": "יום כיפור", "2027-10-16": "סוכות", "2027-10-17": "סוכות", "2027-10-23": "שמיני עצרת", "2027-10-24": "שמחת תורה"};
const SMALL6=['MP','MP ויקטורי','MP פלטינום','בלק מאונטיין','פורטורא','ויקטורי'];
function catUnits(){if(!state.settings.catUnits)state.settings.catUnits={};return state.settings.catUnits;}
function catPal(){if(!state.settings.catPal)state.settings.catPal={};return state.settings.catPal;}
const DEFAULT_BPP=75;
function defaultBpp(c){return DEFAULT_BPP;}
const bpp=c=>{try{const n=+catPal()[c];return (isFinite(n)&&n>0)?n:DEFAULT_BPP;}catch(e){return DEFAULT_BPP;}};
function defaultBpb(c){return SMALL6.includes(c)?6:12;}
function lblOn(lb){return !!lb && lb!=='לא מתוות';}
const bpb=(c,lb)=>{try{
  const v=catUnits()[c];
  if(v&&typeof v==='object'){
    const pick=lblOn(lb)?(v.l||v.u):v.u;   // מתוות נופל אחורה ללא-מתוות; לא-מתוות תמיד עצמאי
    const n=+pick;return (isFinite(n)&&n>0)?n:defaultBpb(c);
  }
  const n=+v;return (isFinite(n)&&n>0)?n:defaultBpb(c);
}catch(e){return SMALL6.includes(c)?6:12;}};
const WINECATS=['בלק מאונטיין',"דולצ'טו",'הרטלנד','ואלי','לימיטד אדישן','מרלו','סובניון בלאן','סנואו','פורטורא','פינו נואר','קברנה סוביניון','קברנה ויסטה','קברנה פרנק','שיראז','שרדונה','MP','רוזה','מרסלאן','ויקטורי','ספיישל אדישן',"רידג'"];
const TYPES=['יין שיווק','ארכיון','מגנומים','דאבל מגנומים','מלכיאור','18 ליטר'];
const LABELS=['לא מתוות','מתוות עברית','מתוות אנגלית'];
const LANGS=['עברית','אנגלית'];
const COOKED=['מבושל','לא מבושל'];
const CAP={'בלק מאונטיין':['0','שחור'],"דולצ'טו":['1','לבן'],'הרטלנד':['1','לבן'],'ואלי':['2','לבן'],'לימיטד אדישן':['1','לבן'],'מרלו':['5','אדום'],'סובניון בלאן':['1','לבן'],'סנואו':['2','לבן'],'פורטורא':['מיוחד','אדום'],'פינו נואר':['2','לבן'],'קברנה סוביניון':['5','אדום'],'קברנה ויסטה':['1','לבן'],'קברנה פרנק':['5','אדום'],'שיראז':['4','אדום'],'שרדונה':['5','אדום'],'MP':['0','שחור'],'רוזה':['3','לבן'],'מרסלאן':['4','אדום'],'ויקטורי':['0','שחור'],'ספיישל אדישן':['1','לבן'],"רידג'":['1','לבן']};
const COLORNAME={brown:'חום',yellow:'צהוב',pink:'ורוד',black:'שחור',red:'אדום',gray:'אפור',none:'—'};
const CATCOLOR={'MP':'brown','ויקטורי':'brown','MP פלטינום':'brown','בלק מאונטיין':'brown','פורטורא':'brown','סנואו':'yellow','ואלי':'yellow','פינו נואר':'yellow','רוזה':'pink','שרדונה':'black','שיראז':'black','קברנה ויסטה':'red','הרטלנד':'red','סובניון בלאן':'red',"דולצ'טו":'red','לימיטד אדישן':'red','מרלו':'gray','קברנה סוביניון':'gray','קברנה פרנק':'gray','מרסלאן':'gray'};
const CATPAL_DEF={brown:{n:'חום',bg:'#9C5A2C',fg:'#ffffff'},yellow:{n:'צהוב',bg:'#E0AE35',fg:'#3a2c00'},
  pink:{n:'ורוד',bg:'#E39BB0',fg:'#5a1030'},black:{n:'שחור',bg:'#262626',fg:'#ffffff'},
  red:{n:'אדום',bg:'#BE2230',fg:'#ffffff'},gray:{n:'אפור',bg:'#9A938E',fg:'#ffffff'},none:{n:'—',bg:'#dddddd',fg:'#555555'}};
function catPalette(){if(!state.settings.catPalette)state.settings.catPalette=JSON.parse(JSON.stringify(CATPAL_DEF));
  if(!state.settings.catPalette.none)state.settings.catPalette.none={n:'—',bg:'#dddddd',fg:'#555555'};
  return state.settings.catPalette;}
function catColorMap(){if(!state.settings.catColorMap)state.settings.catColorMap={};return state.settings.catColorMap;}
const colorOf=c=>{const m=catColorMap();if(m[c]&&catPalette()[m[c]])return m[c];return CATCOLOR[c]||'none';};
function colorName(k){const p=catPalette()[k];return p?p.n:(COLORNAME[k]||k);}
function colorStyle(k){const p=catPalette()[k]||catPalette().none;return 'background:'+p.bg+';color:'+p.fg;}
const CAPCOLORDEF={'שחור':{bg:'#262626',fg:'#ffffff'},'לבן':{bg:'#ffffff',fg:'#333333'},'אדום':{bg:'#BE2230',fg:'#ffffff'}};
function capColors(){if(!state.settings.capColors)state.settings.capColors=JSON.parse(JSON.stringify(CAPCOLORDEF));return state.settings.capColors;}
function capNums(){const a=state.settings.capNums;return (Array.isArray(a)&&a.length)?a:CAPNUMS;}
function capCatMap(){if(!state.settings.capCatMap)state.settings.capCatMap={};return state.settings.capCatMap;}
function capColorMap(){if(!state.settings.capColorMap)state.settings.capColorMap={};return state.settings.capColorMap;}
function capColorOfNum(v){const k=String(v);return capColorMap()[k]||CAPCOLORBYNUM[k]||'לבן';}
function capStyle(name){const c=capColors()[name]||{bg:'#EEEEEE',fg:'#333333'};return 'background:'+c.bg+';color:'+c.fg+';border-color:#00000022';}
const capOf=c=>{const m=capCatMap();const v=(m[c]!==undefined&&m[c]!=='')?String(m[c]):((CAP[c]||['',''])[0]);return [v,capColorOfNum(v)];};
const LEVELNAME={1:'תחתון',2:'אמצע',3:'עליון'};
const rowLabel=n=>''+n;
const CAPNUMS=['0','1','2','3','4','5','מיוחד'];
const CAPCOLORBYNUM={'0':'שחור','1':'לבן','2':'לבן','3':'לבן','4':'אדום','5':'אדום','מיוחד':'אדום'};
function capDisp(e){if(e.capsule!==undefined&&e.capsule!==''&&e.capsule!==null)return[String(e.capsule),capColorOfNum(e.capsule)];return capOf(e.category);}
function distinct(list,key){
  /* מנרמל לטקסט ומסיר רווחים — כדי ש-2022 (מספר) ו-'2022' (טקסט) לא יופיעו פעמיים */
  const seen=new Set(),out=[];
  list.map(key).forEach(v=>{
    if(v===undefined||v===null)return;
    const t=String(v).trim();
    if(!t||seen.has(t))return;
    seen.add(t);out.push(t);
  });
  return out.sort((a,b)=>a.localeCompare(b,'he',{numeric:true}));
}
function filterControls(defs,fobj,cb){
  return `<div class="filterbar">`+defs.map(d=>`<label class="flt"><span>${esc(d.label)}</span><select onchange="${cb}('${d.key}',this.value)"><option value="">הכל</option>${d.values.map(v=>`<option ${String(fobj[d.key])===String(v)?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`).join('')
    +`<button class="btn ghost sm" onclick="${cb}('__clear__','')">נקה</button></div>`;}
function passF(e,defs,fobj){return defs.every(d=>!fobj[d.key]||String(d.get(e))===String(fobj[d.key]));}
function sortList(list,sort){if(!sort||!sort.col)return list;const dir=sort.dir==='desc'?-1:1;
  return list.slice().sort((a,b)=>{let x=sort.val(a),y=sort.val(b);
    if(typeof x==='number'&&typeof y==='number')return (x-y)*dir;
    return (''+x).localeCompare(''+y,'he',{numeric:true})*dir;});}
function sTh(label,col,sort,cb){const act=sort&&sort.col===col;const ar=act?(sort.dir==='desc'?' ▼':' ▲'):' ⇅';
  return `<th class="sortable ${act?'on':''}" onclick="${cb}('${col}')">${esc(label)}<span class="sar">${esc(ar)}</span></th>`;}

function derive(e){const b=bpb(e.category,e.label);const PB=bpp(e.category);const u=+e.units||0;const boxes=u/b;const pallets=boxes/PB;
  const P=Math.floor(boxes/PB);const fb=boxes-P*PB;const Bx=Math.floor(fb+1e-9);const Ur=Math.round((fb-Bx)*b);
  return{boxes,pallets,P,Bx,Ur,bpb:b};}
function brk(e){const d=derive(e);const p=[];if(d.P>0)p.push(d.P+"מ'");if(d.Bx>0)p.push(d.Bx+"א'");if(d.Ur>0)p.push(d.Ur+"י'");return p.length?p.join(' '):'—';}
const isLabeled=e=>String(e.label||'').startsWith('מתוות');
const cookAbbr=e=>e.cooked==='מבושל'?'מב':e.cooked==='לא מבושל'?'לא':'';
function alertOf(e){const d=derive(e);
  if(e.type==='יין שיווק'&&d.pallets<2&&d.pallets>0)return'⚠ שיווק מתחת ל-2 משטחים';
  if(String(e.notes).includes('חסר'))return'חסר ארגז';
  if(String(e.notes).includes('פגום'))return'פגום';return'';}

/* ---------- state ---------- */
let state=load();
function defaults(){return{entries:JSON.parse(JSON.stringify(SEED)),tasks:{},shipments:[],labels:[],invLog:[],
  settings:{title:'יקב טורא',sub:'ניהול מחסן',cloud:{url:'',token:'',auto:false,lastSync:''}},grid:{rows:20,cols:15},
  taskCats:['תיוות יינות','הכנת הפצה','כוח אדם','סידור מחסן','משימות פתוחות'],dayCats:{},
  weekLabels:{}};}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.entries){const d=defaults();return Object.assign(d,s,{settings:Object.assign(d.settings,s.settings||{})});}}catch(e){}return defaults();}
function save(){sanitizeState();localStorage.setItem(KEY,JSON.stringify(state));if(typeof sbAutoPush==='function')sbAutoPush();}
function toast(m){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=m;t.classList.add('show');
  clearTimeout(t._h);
  t.onclick=()=>{t.classList.remove('show');clearTimeout(t._h);};
  const ms=Math.min(6000,Math.max(2400,String(m).length*70));
  t._h=setTimeout(()=>t.classList.remove('show'),ms);
}
function applyBrand(){document.getElementById('brandTitle').textContent=state.settings.title;document.getElementById('brandSub').textContent=state.settings.sub;document.title=state.settings.title+' — '+state.settings.sub;}

/* ---------- map geometry ---------- */
function inRect(r,c,c1,c2,r1,r2){return c>=c1&&c<=c2&&r>=r1&&r<=r2;}
const isMachine=(r,c)=>inRect(r,c,1,3,7,8);
const ENTRANCE_ROW=99;   /* שורה ייעודית לאזור הכניסה — לא 0, כדי לא להתבלבל עם "ללא מיקום" */
const isTable=(r,c)=>c===4&&r>=6&&r<=8;
const isAisle=(r,c)=>(r===6&&c>=1&&c<=3)||(c===9&&r>=6&&r<=8);
function isPallet(r,c){const z=inRect(r,c,1,3,1,5)||inRect(r,c,4,6,1,6)||inRect(r,c,7,8,1,5)||inRect(r,c,9,15,1,5)||inRect(r,c,5,8,6,8)||inRect(r,c,10,15,6,9);return z&&!isMachine(r,c)&&!isTable(r,c);}
const isShelf=(r,c)=>r>=9&&r<=12&&c>=4&&c<=15&&!isPallet(r,c);
const isSlot=(r,c)=>!isMachine(r,c)&&!isTable(r,c);   /* מעברים ניתנים לשיבוץ */
const entriesAt=(r,c)=>state.entries.filter(e=>e.prow===r&&e.pcol===c).sort((a,b)=>b.plevel-a.plevel);
const entryAt=(r,c,lv)=>state.entries.find(e=>e.prow===r&&e.pcol===c&&e.plevel===lv);

/* ---------- tabs (order: dashboard, map, location, tasks, inventory, shipments) ---------- */
const TABS=[['v-dash','דשבורד',()=>renderDash()],['v-map','מפת מחסן',()=>renderMap()],['v-loc','מיקום במחסן',()=>renderLoc()],
 ['v-tasks','משימות',()=>renderTasks()],['v-inv','מלאי מחסן',()=>renderInv()],['v-invlog','יומן תנועות',()=>renderInvLog()],
 ['v-ship','משלוחים',()=>renderShip()],['v-labels','הפצה',()=>renderLabels()]];
function buildNav(){const n=document.getElementById('nav');n.innerHTML='';
  TABS.forEach(([id,label],i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>activate(i);if(i===0)b.classList.add('active');n.appendChild(b);});}
let curTab=0;
function activate(i){curTab=i;document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById(TABS[i][0]).classList.add('active');document.querySelectorAll('#nav button')[i].classList.add('active');TABS[i][2]();}
function refresh(){TABS[curTab][2]();}

