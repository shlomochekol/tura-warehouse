const CACHE='mwe-v10';
const ASSETS=['./',
  'index.html',
  'manifest.webmanifest',
  'assets/app.css',
  'assets/lib/qrcode.js',
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
  'assets/js/99-boot.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-180.png',
  'icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
/* stale-while-revalidate: כל בקשה מקבלת תשובה מיידית מהמטמון (אם יש),
   ובמקביל — תמיד — נשלפת גם גרסה טרייה מהרשת ברקע ומוחלפת במטמון.
   כך עדכון קוד "מתרפא לבד" בטעינה הבאה בלי לדרוש לזכור להעלות את מספר הגרסה
   ב-CACHE; מעבר גרסה עדיין שימושי רק כשרשימת ASSETS עצמה משתנה. */
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req);
    const fresh=fetch(req).then(res=>{
      try{const u=new URL(req.url);
        if(res&&res.ok&&(u.origin===location.origin||u.hostname.includes('fonts.g')))
          cache.put(req,res.clone());
      }catch(_){}
      return res;
    }).catch(()=>null);
    if(cached){fresh;return cached;}                 /* מחזירים מיד, מעדכנים ברקע */
    const res=await fresh;
    if(res)return res;
    /* לא במטמון ואין רשת — לניווט מחזירים את דף הבית, אחרת תשובת שגיאה */
    if(req.mode==='navigate'){
      const home=await cache.match('index.html')||await cache.match('./');
      if(home)return home;
    }
    return new Response('אין חיבור לרשת והמשאב אינו שמור במטמון.',
      {status:503,statusText:'Offline',headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
