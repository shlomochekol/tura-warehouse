/* ============ MAP EXPORT / PRINT ============ */
function mapEl(){return document.querySelector('#v-map .floor')||document.querySelector('#v-map .mapscroll')||document.getElementById('v-map');}
function exportMapImg(){
  const el=mapEl();if(!el){toast('המפה לא נמצאה');return;}
  toast('מכין תמונה…');
  needLib('html2canvas').then(()=>html2canvas(el,{backgroundColor:'#F7F3EC',scale:2,width:el.scrollWidth,height:el.scrollHeight,windowWidth:el.scrollWidth})
    .then(cv=>cv.toBlob(b=>{dl(b,'מפת-מחסן.png');toast('המפה הורדה');})))
    .catch(()=>toast('שגיאה בייצוא'));
}
function printMap(){
  const el=mapEl();if(!el){toast('המפה לא נמצאה');return;}
  let css='';
  document.querySelectorAll('style').forEach(t=>css+=t.textContent);
  const html=`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
    <style>${css}
      @page{size:A4 landscape;margin:8mm}
      body{margin:0;background:#fff;font-family:Arial,sans-serif}
      h2{text-align:center;color:#7B1E2B;margin:0 0 6px}
      .floor{transform-origin:top right}
    </style></head><body>
    <h2>${esc(state.settings.title||'')} — מפת מחסן</h2>
    ${el.outerHTML}</body></html>`;
  printHTML(html);
}
