-- ============================================================
-- יקב טורא — הקמת טבלת "יומן תנועות מלאי" (inv_log) ב-Supabase
-- להריץ פעם אחת ב-Supabase → SQL Editor, לפני שהיומן יתחיל להסתנכרן לענן.
-- בטוח להריץ שוב (create table if not exists / create or replace view).
--
-- ⚠️ מדיניות ה-RLS כאן היא שחזור סביר של התבנית המשמשת את הטבלאות הקיימות
-- (inventory / shipments / labels) — לפי business_id דרך טבלת memberships.
-- מומלץ להשוות מול המדיניות בפועל (Database → Policies) ולהתאים במידת הצורך.
-- ============================================================

create table if not exists inv_log (
  id bigint generated always as identity primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists inv_log_business_id_idx on inv_log(business_id);

alter table inv_log enable row level security;

drop policy if exists inv_log_by_business on inv_log;
create policy inv_log_by_business on inv_log
  for all
  using (business_id in (select business_id from memberships where user_id = auth.uid()))
  with check (business_id in (select business_id from memberships where user_id = auth.uid()));

/* ---------- תצוגה לשאילתות ודוחות (כמו שאר v_* ב-views.sql) ---------- */
drop view if exists v_inv_log cascade;
create view v_inv_log with (security_invoker = on) as
select
  g.id,
  g.business_id,
  (g.data->>'ts')::timestamptz         as ts,
  g.data->>'category'                  as category,
  g.data->>'vintage'                   as vintage,
  g.data->>'type'                      as type,
  g.data->>'loc'                       as loc,
  nullif(g.data->>'before','')::numeric as units_before,
  nullif(g.data->>'after','')::numeric  as units_after,
  nullif(g.data->>'delta','')::numeric  as units_delta,
  g.data->>'reason'                    as reason,
  g.data->>'note'                      as note,
  g.updated_at
from inv_log g;

-- דוגמת שאילתה: כל התנועות של קטגוריה מסוימת בשבוע האחרון
-- select * from v_inv_log where category='הרטלנד' and ts > now() - interval '7 days' order by ts desc;
