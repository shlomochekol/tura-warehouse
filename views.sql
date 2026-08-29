-- ============================================================
-- יקב טורא — תצוגות לשאילתות ודוחות (להריץ ב-Supabase → SQL Editor)
-- הופך את ה-JSON לעמודות אמיתיות, כך שאפשר להריץ שאילתות ודוחות.
-- התצוגות מכבדות את הפרדת הנתונים (security_invoker) — כל עסק רואה רק את שלו.
-- בטוח להריץ שוב ושוב.
-- ============================================================

/* ---------- מלאי ---------- */
drop view if exists v_inventory cascade;
create view v_inventory with (security_invoker = on) as
select
  i.id,
  i.business_id,
  (i.data->>'id')                      as entry_id,
  i.data->>'category'                  as category,
  i.data->>'vintage'                   as vintage,
  i.data->>'type'                      as type,
  i.data->>'cooked'                    as cooked,
  i.data->>'label'                     as label,
  i.data->>'capsule'                   as capsule,
  nullif(i.data->>'units','')::numeric as units,
  nullif(i.data->>'prow','')::int      as row_no,
  nullif(i.data->>'pcol','')::int      as col_no,
  nullif(i.data->>'plevel','')::int    as level_no,
  i.data->>'notes'                     as notes,
  i.updated_at
from inventory i;

/* ---------- משלוחים ---------- */
drop view if exists v_shipments cascade;
create view v_shipments with (security_invoker = on) as
select
  s.id,
  s.business_id,
  nullif(s.data->>'shipdate','')::date as ship_date,
  s.data->>'client'                    as client,
  s.data->>'category'                  as category,
  s.data->>'vintage'                   as vintage,
  s.data->>'cook'                      as cooked,
  s.data->>'status'                    as status,
  nullif(s.data->>'units','')::numeric as units,
  nullif(s.data->>'taste','')::numeric as tastings,
  s.data->>'notes'                     as notes,
  s.updated_at
from shipments s;

/* ---------- מדבקות / הפצה ---------- */
drop view if exists v_labels cascade;
create view v_labels with (security_invoker = on) as
select
  l.id,
  l.business_id,
  l.data->>'code'                        as client_code,
  l.data->>'client'                      as client,
  nullif(l.data->>'date','')::date       as route_date,
  l.data->>'city'                        as city,
  l.data->>'phone'                       as phone,
  coalesce(jsonb_array_length(l.data->'items'),0)                    as item_lines,
  coalesce((select sum((it->>'count')::int)
            from jsonb_array_elements(l.data->'items') it),0)        as boxes,
  coalesce(jsonb_array_length(l.data->'scanned'),0)                  as scanned,
  l.updated_at
from labels l;

/* ---------- סיכום מלאי לפי קטגוריה ובציר ---------- */
drop view if exists v_stock_summary cascade;
create view v_stock_summary with (security_invoker = on) as
select
  business_id, category, vintage, cooked, label,
  count(*)      as locations,
  sum(units)    as units
from v_inventory
group by business_id, category, vintage, cooked, label;

/* ---------- דוגמאות שאילתה ----------
   -- כמה יחידות מכל קטגוריה:
   select category, sum(units) from v_inventory group by category order by 2 desc;

   -- משלוחים בחודש האחרון לפי לקוח:
   select client, sum(units) from v_shipments
   where ship_date > now() - interval '30 days' group by client order by 2 desc;

   -- מסלולי הפצה שלא נסרקו במלואם:
   select client, boxes, scanned from v_labels where scanned < boxes;
------------------------------------------- */
