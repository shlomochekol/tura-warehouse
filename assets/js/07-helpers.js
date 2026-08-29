/* ============ עזרים משותפים ============ */
function seedCatDefaults(){
  if(state.settings.catSeed2)return;
  const cu=catUnits(),cp=catPal();
  ['MP','ויקטורי'].forEach(c=>{ if(cu[c]===undefined)cu[c]={u:12,l:6}; if(cp[c]===undefined)cp[c]=90; });
  state.settings.catSeed2=1;
  localStorage.setItem(KEY,JSON.stringify(state));
}
function loadCustomCats(){(state.customCats||[]).forEach(c=>{if(!WINECATS.includes(c))WINECATS.push(c);});}
