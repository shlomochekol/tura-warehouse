/* ============ חיבור ל-Google Calendar (למשימות עם תאריך/שעה) ============
   עיצוב מכוון: אין שרת משלנו, אז אין "דחיפה" משלנו למכשיר כשהאפליקציה
   סגורה — התזכורת נשענת כולה על ההתראות המובנות של Google Calendar
   (פופאפ באפליקציית/אתר Google Calendar, כולל התראה בנייד). האסימון
   (access token) נשאר בזיכרון הדפדפן בלבד לכל אורך העמוד הנוכחי —
   לעולם לא נשמר ב-localStorage ולא מסתנכרן ל-Supabase; רק ה-Client ID
   (לא סודי — מיועד להיות ציבורי בצד לקוח) נשמר ומסתנכרן כהגדרה רגילה. */
let _gcalToken='',_gcalTokenExp=0,_gcalTokenClient=null,_gcalTokenClientCid='';
function gcalConfigured(){return !!(state.settings.gcalClientId||'').trim();}
function gcalConnected(){return !!(_gcalToken&&Date.now()<_gcalTokenExp);}
function gcalFriendlyError(e){
  const msg=(e&&e.message)||String(e||'');
  if(msg==='__GCAL_NOT_CONNECTED__')return 'לא מחובר ל-Google Calendar — יש להתחבר קודם ב-⚙ הגדרות → הגדרות מתקדמות.';
  if(/לא הוגדר Client ID/.test(msg))return 'צריך להגדיר Google Client ID בהגדרות מתקדמות קודם.';
  if(/popup_closed|access_denied|user_cancel/i.test(msg))return 'החיבור ל-Google בוטל.';
  if(/idpiframe_initialization_failed|invalid_client|redirect_uri_mismatch/i.test(msg))return 'ה-Client ID לא תקין, או שהדומיין הזה לא מורשה ב-Google Cloud Console.';
  if(/לא זמין \(בלי אינטרנט|טעינת רכיב נכשלה/.test(msg))return 'אין חיבור לאינטרנט — לא ניתן להתחבר ל-Google כרגע.';
  if(/failed to fetch|networkerror/i.test(msg))return 'אין חיבור לאינטרנט — לא ניתן להתחבר ל-Google כרגע.';
  if(/^\(401\)/.test(msg))return 'ההרשאה מול Google פגה — יש להתחבר שוב.';
  if(/^\(403\)/.test(msg))return 'Google חסם את הבקשה (בדוק שה-Calendar API מופעל בפרויקט שלך ב-Google Cloud Console).';
  if(/^\(404\)|^\(410\)/.test(msg))return 'האירוע לא נמצא ביומן Google (אולי נמחק שם ידנית).';
  if(/^\(429\)/.test(msg))return 'יותר מדי פניות ל-Google בזמן קצר — נסה שוב בעוד רגע.';
  return msg||'שגיאה לא ידועה מול Google';
}
/* טוען את ספריית ה-OAuth של Google (חיצונית — לא נטענת בקובץ החירום,
   שם needLib מוחלף בפונקציה שמדלגת על טעינה — שם ההתחברות פשוט לא זמינה,
   וזה תקין: קובץ החירום מיועד לשימוש בלי אינטרנט מלכתחילה). */
function gcalEnsureLib(){
  return needLib('gsi').then(()=>{
    if(typeof google==='undefined'||!google.accounts||!google.accounts.oauth2)
      throw new Error('חיבור ל-Google לא זמין (בלי אינטרנט, או בקובץ החירום).');
  });
}
/* מתחברים — תמיד ביוזמת לחיצה מפורשת של המשתמש (כפתור), כדי שחלון
   ה-OAuth של Google לא ייחסם כפופ-אפ לא-רצוי. */
async function gcalConnectUI(){
  if(!gcalConfigured()){alert('קודם הכנס Google Client ID למעלה');return;}
  const btn=document.getElementById('gcal_connect_btn');
  if(btn){btn.disabled=true;btn.textContent='מתחבר…';}
  try{
    await gcalEnsureLib();
    await new Promise((resolve,reject)=>{
      const cid=state.settings.gcalClientId.trim();
      if(!_gcalTokenClient||_gcalTokenClientCid!==cid){
        _gcalTokenClientCid=cid;
        _gcalTokenClient=google.accounts.oauth2.initTokenClient({
          client_id:cid,
          scope:'https://www.googleapis.com/auth/calendar.events',
          callback:(resp)=>{
            if(resp&&resp.access_token){
              _gcalToken=resp.access_token;
              _gcalTokenExp=Date.now()+((resp.expires_in||3500)*1000);
              resolve();
            }else reject(new Error((resp&&(resp.error_description||resp.error))||'לא התקבלה הרשאה מ-Google'));
          }
        });
      }
      _gcalTokenClient.requestAccessToken({prompt:'consent'});
    });
    alert('התחברת ל-Google Calendar ✓');
  }catch(e){alert('החיבור נכשל: '+gcalFriendlyError(e));}
  finally{if(btn){btn.disabled=false;btn.textContent=gcalConnected()?'✓ מחובר — התחבר מחדש':'התחבר ל-Google';}}
}
function gcalSetClientId(v){state.settings.gcalClientId=String(v||'').trim();save();}
function gcalSetReminderMins(v){state.settings.gcalReminderMins=Math.max(0,+v||0);save();}

function gcalPad(n){return String(n).padStart(2,'0');}
/* בונה את גוף האירוע ל-Calendar API ממשימה. עם שעה -> אירוע של 30 דקות;
   בלי שעה -> אירוע "יום שלם". התזכורת תמיד מוגדרת מפורשות (לא ברירת מחדל
   של Google) כדי שתשקף את מה שהוגדר בהגדרות האפליקציה. */
function gcalEventBody(t){
  const reminderMins=Math.max(0,+state.settings.gcalReminderMins||0);
  const tz=(Intl.DateTimeFormat().resolvedOptions().timeZone)||'Asia/Jerusalem';
  const body={summary:t.title||'(ללא כותרת)',
    description:(t.notes||'')+(t.notes?'\n\n':'')+'נוצר אוטומטית מ-'+(state.settings.title||'יקב טורא')+(t.zone?' · אזור: '+t.zone:'')};
  if(t.time){
    const start=new Date(t.due+'T'+t.time+':00');
    const end=new Date(start.getTime()+30*60000);
    /* מחרוזת שעון-קיר מקומי (בלי אזור זמן מוטבע) — התזוזה נקבעת ע"י timeZone למטה */
    const iso=d=>d.getFullYear()+'-'+gcalPad(d.getMonth()+1)+'-'+gcalPad(d.getDate())+'T'+gcalPad(d.getHours())+':'+gcalPad(d.getMinutes())+':00';
    body.start={dateTime:iso(start),timeZone:tz};
    body.end={dateTime:iso(end),timeZone:tz};
  }else{
    const end=new Date(t.due+'T00:00:00');end.setDate(end.getDate()+1);
    body.start={date:t.due};
    body.end={date:end.getFullYear()+'-'+gcalPad(end.getMonth()+1)+'-'+gcalPad(end.getDate())};
  }
  body.reminders={useDefault:false,overrides:[{method:'popup',minutes:reminderMins}]};
  return body;
}
async function gcalHandle(r){
  const txt=await r.text();
  let j=null;try{j=txt?JSON.parse(txt):null;}catch(e){}
  if(!r.ok){
    const msg=(j&&j.error&&(j.error.message||j.error))||txt||('שגיאה '+r.status);
    throw new Error('('+r.status+') '+String(msg).slice(0,160));
  }
  return j;
}
async function gcalApi(method,path,body){
  if(!gcalConnected())throw new Error('__GCAL_NOT_CONNECTED__');
  const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events'+path,{
    method,headers:{'Authorization':'Bearer '+_gcalToken,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined});
  if(r.status===401){_gcalToken='';_gcalTokenExp=0;throw new Error('__GCAL_NOT_CONNECTED__');}
  return gcalHandle(r);
}
/* יוצר/מעדכן אירוע ביומן Google עבור משימה. לא-הרסני: אם האירוע הישן
   נמחק ביד ב-Google (404/410), פשוט יוצרים חדש במקום לזרוק שגיאה. */
async function gcalPushTask(id){
  const t=(typeof tkFind==='function')?tkFind(id):null;if(!t)return;
  if(!t.due){alert('צריך קודם תאריך יעד למשימה');return;}
  if(!gcalConfigured()){alert('קודם הגדר Google Client ID ב-⚙ הגדרות → הגדרות מתקדמות');return;}
  try{
    const body=gcalEventBody(t);
    let ev;
    if(t.gcalEventId){
      try{ev=await gcalApi('PATCH','/'+encodeURIComponent(t.gcalEventId),body);}
      catch(e){
        if(/^\(404\)|^\(410\)/.test(e.message)){t.gcalEventId='';ev=await gcalApi('POST','',body);}
        else throw e;
      }
    }else{
      ev=await gcalApi('POST','',body);
    }
    t.gcalEventId=ev.id;t.gcalSyncedAt=new Date().toISOString();
    if(typeof tkLog==='function')tkLog(t,'סונכרן ליומן Google');
    save();
    alert('נוסף ליומן Google ✓ (תזכורת '+Math.max(0,+state.settings.gcalReminderMins||0)+' דק׳ לפני)');
    if(typeof tkOpen==='function'&&document.getElementById('modal').classList.contains('open'))tkOpen(id,true);
    else if(typeof renderTasks==='function')renderTasks();
  }catch(e){alert('סנכרון ל-Google נכשל: '+gcalFriendlyError(e));}
}
async function gcalRemoveTask(id){
  const t=(typeof tkFind==='function')?tkFind(id):null;if(!t||!t.gcalEventId)return;
  try{await gcalApi('DELETE','/'+encodeURIComponent(t.gcalEventId));}
  catch(e){if(!/^\(404\)|^\(410\)/.test(e.message)){alert('הסרה מ-Google נכשלה: '+gcalFriendlyError(e));return;}}
  t.gcalEventId='';t.gcalSyncedAt='';
  if(typeof tkLog==='function')tkLog(t,'הוסר מיומן Google');
  save();
  if(typeof tkOpen==='function')tkOpen(id,true);
  alert('הוסר מיומן Google');
}
