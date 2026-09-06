/* ============ בדיקת תקינות המערכת (self-test) ============ */
function selfTest(){
  const T=[],ok=(n,c,d)=>T.push({n,pass:!!c,d:d||''});
  /* פונקציות קריטיות — תופס באגים של "שם כפול" שדרס פונקציה */
  const need=['renderDash','renderMap','renderLoc','renderTasks','renderInv','renderShip','renderLabels','derive','save','refresh','capDisp','colorOf','printLabels','importLionWheel','sbPushChanged','sbSyncTable','sbBackupNow','sbDoRestore','openCapSettings','openCatUnits','tkQuickAdd','boardWeekHTML','bpb','bpp','capOf','isLabeled','backupNow','openRestore','maybeDailyBackup','saveOnExit','loadCustomCats','seedCatDefaults','sbPull','openResetSpots','doResetSpots','spotsPlaced','openAssign','assignTo','assignCandidates','addEntryAt','openDeduct','dedCandidates','dedApply','dedUndo','barcodeOf','findByBarcode','productByCode','openBarcodeScan','openBarcodeManager','openPicking','printPicking','pickingRows','saveRoute','openRoutes','loadRoute','openSupplyDay','supplyTotals','supplyPanelHTML','logInv','logImportDiff','renderInvLog','invLogFilter','invKeyOf'];
  const has=n=>{try{return typeof eval(n)==='function';}catch(e){return false;}};
  const miss=need.filter(n=>!has(n));
  ok('כל '+need.length+' הפונקציות הקריטיות קיימות',!miss.length,miss.join(', '));
  /* חישובים — תופס דריסה של bpb/bpp/derive */
  const t1={category:'הרטלנד',label:'מתוות עברית',units:1200};
  const d1=derive(t1);
  ok('חישוב ארגזים (1200 יח׳ ÷ 12)',Math.abs(d1.boxes-100)<0.01,d1.boxes+' ארגזים');
  ok('חישוב משטחים (100 ÷ 75)',Math.abs(d1.pallets-100/bpp('הרטלנד'))<0.01,d1.pallets.toFixed(2));
  ok('MP לא מתוות = 12 ליחידה',bpb('MP','לא מתוות')===12,bpb('MP','לא מתוות'));
  ok('MP מתוות = 6 ליחידה',bpb('MP','מתוות עברית')===6,bpb('MP','מתוות עברית'));
  /* תאריכים — תופס את הבאג שבו weekStart נדרסה */
  try{const ws=weekStart(0);ok('חישוב תחילת שבוע',ws.getFullYear()>=new Date().getFullYear(),ws.toLocaleDateString('he-IL'));}
  catch(e){ok('חישוב תחילת שבוע',false,e.message);}
  /* יומן תנועות מלאי — תופס אם logInv לא רושם או רושם ערכים שגויים */
  try{
    const bak=state.invLog;state.invLog=[];
    const rec=logInv({id:'test',category:'בדיקה',vintage:'',type:'',prow:0,pcol:0,plevel:0},10,7,'manual');
    ok('יומן תנועות: רישום שינוי כמות',!!rec&&rec.delta===-3&&state.invLog.length===1,
      rec?('לפני '+rec.before+' אחרי '+rec.after+' Δ'+rec.delta):'לא נרשם');
    state.invLog=bak;
  }catch(e){ok('יומן תנועות',false,e.message);}
  ok('יומן תנועות: 4 סוגי פעולה מוגדרים',Object.keys(INVLOG_REASONS).length===4,Object.values(INVLOG_REASONS).join(', '));
  /* קפסולות וצבעים */
  ok('קפסולה 1 = לבן',capColorOfNum('1')==='לבן',capColorOfNum('1'));
  try{const withBc=(state.entries||[]).filter(e=>barcodeOf(e)).length;
    ok('קטלוג ברקודים נטען',typeof PRODUCTS!=='undefined'&&PRODUCTS.length>100,(typeof PRODUCTS!=='undefined'?PRODUCTS.length:0)+' מוצרים');
    ok('התאמת ברקודים למלאי',withBc>0,withBc+' מתוך '+(state.entries||[]).length+' פריטים');
  }catch(e){ok('קטלוג ברקודים',false,e.message);}
  ok('צבע קטגוריה מוגדר',!!colorStyle(colorOf('הרטלנד')),colorName(colorOf('הרטלנד')));
  /* מדבקות */
  try{const b={id:1,code:'TEST1',client:'בדיקה',date:'2026-01-01',items:[{contents:['יין'],count:2}],scanned:[]};
    ok('מספור מדבקות',boxesOf(b).length===2&&boxesOf(b)[1].total===2);
    ok('ברקוד נוצר',qrSVG(boxCode(b,boxesOf(b)[0]),4).indexOf('<svg')>=0);}
  catch(e){ok('מדבקות',false,e.message);}
  /* אחסון וסנכרון */
  ok('שמירה מקומית פעילה',!!localStorage.getItem(KEY));
  ok('סרגל הניווט נבנה',document.querySelectorAll('#nav button').length===TABS.length,
     document.querySelectorAll('#nav button').length+'/'+TABS.length+' לשוניות');
  const act=document.querySelector('.view.active')||document.querySelector('.view');
  ok('המסך הפעיל מציג תוכן',!!act&&act.innerHTML.length>50,act?act.id:'—');
  ok('מצב סנכרון',sbLoggedIn()?'מחובר לענן':'מקומי בלבד',sbLoggedIn()?SB.email:'');
  if(sbLoggedIn())ok('גיבוי אחרון',!!localStorage.getItem('sb_lastbk'),
    localStorage.getItem('sb_lastbk')?new Date(localStorage.getItem('sb_lastbk')).toLocaleString('he-IL'):'טרם בוצע גיבוי');
  return T;
}
/* ============ בדיקת תקינות הנתונים ============ */
function dataAudit(){
  const P=[],E=state.entries||[];
  const add=(sev,msg,n)=>P.push({sev,msg,n});
  const bad=E.filter(e=>!e.category||!String(e.category).trim());
  if(bad.length)add('err','מיקומים ללא קטגוריה',bad.length);
  const neg=E.filter(e=>(+e.units||0)<0);
  if(neg.length)add('err','יחידות שליליות',neg.length);
  const nan=E.filter(e=>e.units!==''&&e.units!==undefined&&isNaN(+e.units));
  if(nan.length)add('err','יחידות שאינן מספר',nan.length);
  const over=E.filter(e=>derive(e).pallets>1.001);
  if(over.length)add('warn','מיקומים עם יותר ממשטח אחד',over.length);
  const slots={},dupes=[];
  E.forEach(e=>{if(!e.prow||!e.pcol||!e.plevel)return;
    const k=e.prow+'-'+e.pcol+'-'+e.plevel;
    if(slots[k])dupes.push(k);else slots[k]=1;});
  if(dupes.length)add('err','מיקומים כפולים באותה משבצת',[...new Set(dupes)].length);
  const noloc=E.filter(e=>!e.prow||!e.pcol);
  if(noloc.length)add('warn','פריטים ללא מיקום במפה',noloc.length);
  const zero=E.filter(e=>(+e.units||0)===0);
  if(zero.length)add('info','מיקומים עם 0 יחידות',zero.length);
  const grid=state.grid||{rows:20,cols:15};
  const ER=(typeof ENTRANCE_ROW!=='undefined')?ENTRANCE_ROW:99;
  const out=E.filter(e=>e.prow!==ER&&(e.prow>grid.rows||e.pcol>grid.cols));
  if(out.length)add('err','מיקומים מחוץ לגבולות המפה',out.length);
  const ids={},dupId=[];E.forEach(e=>{if(ids[e.id])dupId.push(e.id);else ids[e.id]=1;});
  if(dupId.length)add('err','מזהים כפולים במלאי',dupId.length);
  const lbl=(state.labels||[]).filter(b=>!b.client||!String(b.client).trim());
  if(lbl.length)add('warn','לקוחות הפצה ללא שם',lbl.length);
  const sh=(state.shipments||[]).filter(x=>x.units&&isNaN(+x.units));
  if(sh.length)add('err','משלוחים עם יחידות לא תקינות',sh.length);
  return P;
}
function openDiagnostics(){
  const box=document.getElementById('modalbox');box.className='box wide';
  const T=selfTest(),A=dataAudit();
  const fail=T.filter(x=>x.pass===false).length;
  const errs=A.filter(x=>x.sev==='err').length;
  let h=`<h3>בדיקת תקינות</h3>
   <div class="kpis k2" style="margin-bottom:10px">
     ${kpi('בדיקות מערכת',fail?fail+' נכשלו':'תקין ✓','',fail?'var(--warn)':'var(--ok)')}
     ${kpi('בעיות נתונים',errs?errs+' חמורות':'תקין ✓','',errs?'var(--warn)':'var(--ok)')}</div>
   <div class="seg"><b>מערכת</b></div>
   <table class="itemtbl"><tbody>
   ${T.map(x=>`<tr><td style="width:26px">${x.pass===false?'✗':x.pass===true?'✓':'•'}</td>
     <td class="${x.pass===false?'dg-bad':''}">${esc(x.n)}</td><td style="color:var(--muted);font-size:11px">${esc(String(x.d||''))}</td></tr>`).join('')}
   </tbody></table>
   <div class="seg" style="margin-top:14px"><b>נתונים</b></div>`;
  h+=A.length?`<table class="itemtbl"><tbody>${A.map(x=>`<tr>
      <td style="width:26px">${x.sev==='err'?'⛔':x.sev==='warn'?'⚠':'ℹ'}</td>
      <td class="${x.sev==='err'?'dg-bad':''}">${esc(x.msg)}</td><td style="width:70px"><b>${esc(x.n)}</b></td></tr>`).join('')}</tbody></table>`
    :`<div class="hint">לא נמצאו בעיות בנתונים ✓</div>`;
  h+=`<div class="actions"><button class="btn" onclick="closeModal()">סגור</button>
      <button class="btn ghost" onclick="copyDiag()">העתק דוח</button></div>`;
  box.innerHTML=h;document.getElementById('modal').classList.add('open');
}
function copyDiag(){
  const T=selfTest(),A=dataAudit();
  const txt='בדיקת תקינות — '+new Date().toLocaleString('he-IL')+'\n\n'+
    'מערכת:\n'+T.map(x=>(x.pass===false?'[נכשל] ':'[תקין] ')+x.n+(x.d?' — '+x.d:'')).join('\n')+
    '\n\nנתונים:\n'+(A.length?A.map(x=>'['+x.sev+'] '+x.msg+': '+x.n).join('\n'):'ללא בעיות');
  navigator.clipboard?navigator.clipboard.writeText(txt).then(()=>toast('הדוח הועתק')):toast('העתקה לא נתמכת');
}
/* ============ מצב מנוי (trial / active) ============ */
async function sbLoadPlan(){
  if(!sbLoggedIn())return null;
  try{
    const r=await sbRest('GET','businesses?select=name,plan,trial_ends&id=eq.'+SB.biz);
    const b=r&&r[0];if(!b)return null;
    SB.plan=b.plan;SB.trialEnds=b.trial_ends;SB.bizName=b.name;
    showPlanBanner();return b;
  }catch(e){return null;}
}
function showPlanBanner(){
  const el=document.getElementById('planBanner');if(!el)return;
  if(!SB.plan||SB.plan==='active'){el.style.display='none';return;}
  const days=SB.trialEnds?Math.ceil((new Date(SB.trialEnds)-new Date())/86400000):null;
  if(SB.plan==='blocked'){el.className='planbanner blocked';el.textContent='החשבון מושהה — צור קשר להפעלה מחדש.';el.style.display='block';return;}
  if(days===null){el.style.display='none';return;}
  if(days<0){el.className='planbanner blocked';el.textContent='תקופת הניסיון הסתיימה. הנתונים שמורים — צור קשר להמשך.';}
  else if(days<=7){el.className='planbanner warn';el.textContent='תקופת ניסיון: נותרו '+days+' ימים.';}
  else{el.style.display='none';return;}
  el.style.display='block';
}

