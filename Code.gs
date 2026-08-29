/*** יקב טורא — סנכרון ענן (גרסה 3: דלתא + גיבויים ושחזור) ***/

// ⚠️ אותה סיסמה שבאפליקציה
const TOKEN = 'tura123';

const ENTRY_COLS = ['id','prow','pcol','plevel','type','category','vintage','cooked','units','label','capsule','capcolor','color','series','code','origin','notes'];
const SHIP_COLS  = ['shipdate','kind','client','category','cook','vintage','units','taste','lang','status','labeldate','notes'];
const MAX_BACKUPS = 10;

function doGet(e){
  try{
    const p = e.parameter || {};
    if(String(p.token||'') !== TOKEN) return json({error:'סיסמה שגויה', ver:3});
    if(p.action === 'ping')     return json({ok:true, ver:3});
    if(p.action === 'backups')  return json({ok:true, ver:3, backups:listBackups()});
    if(p.action === 'restore')  return json({ok:true, ver:3, snapshot:getBackup(Number(p.i))});
    return json({ok:true, ver:3,
      entries:   readObjs('inventory', ENTRY_COLS),
      shipments: readObjs('shipments', SHIP_COLS),
      tasks:     readTasks(),
      meta:      readMeta()});
  }catch(err){ return json({error:String(err), ver:3}); }
}

function doPost(e){
  try{
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if(String(body.token||'') !== TOKEN) return json({error:'סיסמה שגויה', ver:3});

    if(body.action === 'backup'){
      addBackup(body.snapshot || {});
      return json({ok:true, ver:3, savedAt:new Date().toISOString()});
    }

    if(body.mode === 'delta'){
      const d = body.delta || {};
      upsertEntries(d.changedEntries || [], d.removedIds || []);
      if(d.shipments) writeObjs('shipments', SHIP_COLS, d.shipments);
      if(d.tasks)     writeTasks(d.tasks);
      if(d.meta)      writeMeta(d.meta);
      return json({ok:true, ver:3, mode:'delta', savedAt:new Date().toISOString()});
    }

    const p = body.payload || {};
    writeObjs('inventory', ENTRY_COLS, p.entries   || []);
    writeObjs('shipments', SHIP_COLS,  p.shipments || []);
    writeTasks(p.tasks || {});
    writeMeta(p.meta || {});
    return json({ok:true, ver:3, savedAt:new Date().toISOString()});
  }catch(err){ return json({error:String(err), ver:3}); }
}

/* ---------- גיבויים (10 אחרונים) ---------- */
function addBackup(snap){
  const sh = sheet('backups');
  if(sh.getLastRow() < 1) sh.getRange(1,1,1,2).setValues([['time','json']]);
  sh.appendRow([new Date().toISOString(), JSON.stringify(snap)]);
  const n = sh.getLastRow() - 1;                 // בלי הכותרת
  if(n > MAX_BACKUPS) sh.deleteRows(2, n - MAX_BACKUPS);
}
function listBackups(){
  const sh = ss().getSheetByName('backups'); if(!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  const out = [];
  for(var i = 0; i < vals.length; i++) out.push({ i:i, time:String(vals[i][0]) });
  return out.reverse();                          // החדש ביותר ראשון
}
function getBackup(i){
  const sh = ss().getSheetByName('backups'); if(!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(i+2, 2).getValue();
  try{ return JSON.parse(v); }catch(e){ return null; }
}

/* ---------- עדכון חכם של שורות שהשתנו ---------- */
function upsertEntries(changed, removedIds){
  const sh = sheet('inventory');
  let vals = sh.getDataRange().getValues();
  const empty = (vals.length < 1 || String(vals[0][0]) === '');
  if(empty) vals = [ENTRY_COLS.slice()];
  const hdr = vals[0];
  let idCol = hdr.indexOf('id'); if(idCol < 0) idCol = 0;

  const bulk = empty || (removedIds && removedIds.length) || (changed && changed.length > 40);
  const idx = {}; for(var r=1; r<vals.length; r++) idx[String(vals[r][idCol])] = r;

  if(bulk){
    if(removedIds && removedIds.length){
      const rem = {}; removedIds.forEach(function(x){ rem[String(x)] = 1; });
      vals = [hdr].concat(vals.slice(1).filter(function(row){ return !rem[String(row[idCol])]; }));
    }
    const oidx = {}; for(var r2=1; r2<vals.length; r2++) oidx[String(vals[r2][idCol])] = r2;
    (changed||[]).forEach(function(o){
      const row = ENTRY_COLS.map(function(c){ return (o[c]==null) ? '' : o[c]; });
      if(oidx[String(o.id)] !== undefined) vals[oidx[String(o.id)]] = row;
      else { vals.push(row); oidx[String(o.id)] = vals.length-1; }
    });
    sh.clear();
    sh.getRange(1,1,vals.length,ENTRY_COLS.length).setValues(vals);
    return;
  }

  const appends = [];
  (changed||[]).forEach(function(o){
    const row = ENTRY_COLS.map(function(c){ return (o[c]==null) ? '' : o[c]; });
    const rr = idx[String(o.id)];
    if(rr !== undefined) sh.getRange(rr+1,1,1,ENTRY_COLS.length).setValues([row]);
    else appends.push(row);
  });
  if(appends.length) sh.getRange(sh.getLastRow()+1,1,appends.length,ENTRY_COLS.length).setValues(appends);
}

/* ---------- עזר ---------- */
function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet(name){ const s=ss(); return s.getSheetByName(name) || s.insertSheet(name); }
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function writeObjs(name, cols, arr){
  const sh = sheet(name); sh.clear();
  const rows = [cols].concat(arr.map(function(o){ return cols.map(function(c){ return (o[c]===undefined||o[c]===null) ? '' : o[c]; }); }));
  sh.getRange(1,1,rows.length,cols.length).setValues(rows);
}
function readObjs(name, cols){
  const sh = ss().getSheetByName(name); if(!sh) return [];
  const vals = sh.getDataRange().getValues(); if(vals.length < 2) return [];
  const hdr = vals[0];
  return vals.slice(1).filter(function(r){ return r.join('') !== ''; }).map(function(r){
    const o = {}; hdr.forEach(function(h,i){ o[h] = r[i]; }); return o;
  });
}
function writeTasks(obj){
  const sh = sheet('tasks'); sh.clear();
  const rows = [['key','value']].concat(Object.keys(obj).map(function(k){ return [k, obj[k]]; }));
  sh.getRange(1,1,rows.length,2).setValues(rows);
}
function readTasks(){
  const sh = ss().getSheetByName('tasks'); if(!sh) return {};
  const vals = sh.getDataRange().getValues(); const o = {};
  vals.slice(1).forEach(function(r){ if(r[0]!=='' && r[0]!==null) o[r[0]] = r[1]; });
  return o;
}
function writeMeta(m){ const sh = sheet('meta'); sh.clear(); sh.getRange(1,1).setValue(JSON.stringify(m)); }
function readMeta(){
  const sh = ss().getSheetByName('meta'); if(!sh) return {};
  const v = sh.getRange(1,1).getValue(); try{ return JSON.parse(v||'{}'); }catch(e){ return {}; }
}
