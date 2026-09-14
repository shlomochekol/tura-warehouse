#!/usr/bin/env node
/*
 * בונה מחדש את index-קובץ-בודד-לחירום.html מתוך index.html + assets/*
 * כדי שקובץ החירום (מיועד לפתיחה מקומית, בלי שרת, בלי אינטרנט) תמיד יהיה
 * מסונכרן עם המודולים המפוצלים — במקום עדכון ידני שקל לשכוח.
 *
 * הרצה: node build-emergency.js
 * אין תלות חיצונית (Node טהור, בלי npm install).
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const OUT = path.join(root, 'index-קובץ-בודד-לחירום.html');

const MODULES = [
  'assets/data/seed.js',
  'assets/data/products.js',
  'assets/js/01-core.js',
  'assets/js/02-dashboard.js',
  'assets/js/03-map.js',
  'assets/js/04-location.js',
  'assets/js/05-inventory.js',
  'assets/js/06-settings.js',
  'assets/js/07-helpers.js',
  'assets/js/08-labels.js',
  'assets/js/09-help.js',
  'assets/js/10-csv.js',
  'assets/js/11-map-export.js',
  'assets/js/12-barcodes.js',
  'assets/js/13-backups-cloud.js',
  'assets/js/14-diagnostics.js',
  'assets/js/15-autosave.js',
  'assets/js/16-lionwheel.js',
  'assets/js/17-supabase.js',
  'assets/js/18-rowsync.js',
  'assets/js/19-board.js',
  'assets/js/20-tasks.js',
  'assets/js/21-picking.js',
  'assets/js/22-supply.js',
  'assets/js/23-deduct.js',
  'assets/js/24-invlog.js',
  'assets/js/99-boot.js',
];

// הספריות הכבדות: באפליקציה המפוצלת נטענות עצלנית (needLib) — כאן משובצות
// מראש כי אין שרת שיגיש אותן על פי דרישה.
const LAZY_LIBS = [
  'assets/lib/xlsx.js',
  'assets/lib/jsqr.js',
  'assets/lib/html2canvas.js',
  'assets/lib/zxing.js',
];
const EAGER_LIB = 'assets/lib/qrcode.js';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function main() {
  let html = read('index.html');
  const css = read('assets/app.css');

  // 1. app.css -> <style> מוטבע, במקום ה-<link>
  const linkRe = /<link rel="stylesheet" href="assets\/app\.css">/;
  if (!linkRe.test(html)) throw new Error('לא נמצא <link> ל-app.css ב-index.html — ייתכן שהמבנה השתנה, לבדוק ידנית');
  html = html.replace(linkRe, () => `<style>\n${css}\n</style>`);

  // 2. מסירים manifest/PWA שלא רלוונטיים בקובץ עצמאי
  html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');

  // 3. מסירים את רישום ה-Service Worker (לא עובד תחת file://, וגם לא נחוץ כאן)
  html = html.replace(
    /<script>\n\/\* PWA: offline \+ install \*\/\nif\('serviceWorker' in navigator\)\{[\s\S]*?\}\n/,
    '<script>\n'
  );

  // 4. מחליפים את כל תגי ה-<script src="..."> של הספרייה הקבועה + המודולים
  //    בבלוק אחד מוטבע — כולל הספריות העצלניות, ומבטלים את needLib כדי
  //    שלא ינסה לפנות ל-assets/lib/*.js שלא קיימים כקובץ נפרד כאן.
  const scriptTagsRe = new RegExp(
    '<script src="' + EAGER_LIB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"></script>' +
    '[\\s\\S]*?' +
    '<script src="' + MODULES[MODULES.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"></script>'
  );
  if (!scriptTagsRe.test(html)) throw new Error('לא נמצא טווח תגי ה-<script> הצפוי ב-index.html — לבדוק ידנית');

  let bundle = `<script>\n/* ${EAGER_LIB} */\n` + read(EAGER_LIB) + '\n';
  MODULES.forEach(m => {
    bundle += `\n/* ${m} */\n` + read(m) + '\n';
  });
  LAZY_LIBS.forEach(lib => {
    bundle += `\n/* ${lib} — נטען כאן מראש (עצלני בגרסה המפוצלת בלבד) */\n` + read(lib) + '\n';
  });
  bundle += `
/* קובץ החירום טוען את כל הספריות מראש — needLib לא צריך לפנות לרשת בשביל שום דבר */
if (typeof needLib === 'function') {
  needLib = function () { return Promise.resolve(true); };
}
</script>`;

  /* קריטי: מעבירים פונקציה ולא מחרוזת ל-replace — bundle ענק (כולל ספריות
     כמו xlsx.js) שכמעט בוודאות מכיל רצפי "$&"/"$1" וכד', ואלה מתפרשים
     באופן מיוחד כשמעבירים מחרוזת ל-replace (ולא כשמעבירים פונקציה). */
  html = html.replace(scriptTagsRe, () => bundle);

  fs.writeFileSync(OUT, html, 'utf8');
  console.log('נכתב: ' + OUT + ' (' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0) + ' KB)');
}

main();
