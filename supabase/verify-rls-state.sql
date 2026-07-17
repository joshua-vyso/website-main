-- ============================================================================
-- READ-ONLY audit query. Safe to run — it SELECTs from Postgres catalogs only,
-- writes nothing, and cannot affect the running app. Paste into the Supabase SQL
-- editor and send me the output.
--
-- Why: 11 tenant-carrying tables have no DDL/RLS in the repo (they were created by
-- hand in the dashboard), so we can't verify from source control that they're
-- actually locked down. This confirms the live truth. Any row showing
-- rls_enabled = false OR policy_count = 0 is a real cross-tenant exposure.
-- ============================================================================

-- 1. Is RLS enabled, and how many policies, on every tenant table?
select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_enabled,
  c.relforcerowsecurity                       as rls_forced,
  count(p.polname)                            as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles','organisations','org_features','documents','document_folders',
    'suppliers','pp_stock_items','pp_movements','pp_item_suppliers',
    'pp_notifications','pp_settings'
  )
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by rls_enabled, policy_count, table_name;

-- 2. Any policy that is effectively wide open (USING true / WITH CHECK true)?
select
  c.relname as table_name,
  p.polname as policy_name,
  pg_get_expr(p.polqual, p.polrelid)      as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (
    pg_get_expr(p.polqual, p.polrelid) = 'true'
    or pg_get_expr(p.polwithcheck, p.polrelid) = 'true'
  )
order by table_name, policy_name;

-- 3. Which org_features rows actually exist (drives the SEC-04 lockout decision)?
--    Before removing the "force every module on" flag, we must confirm each active
--    org has the feature rows it's entitled to, or removing it locks them out.
select o.name as org, o.slug, f.feature_key, f.enabled
from organisations o
left join org_features f on f.org_id = o.id
order by o.name, f.feature_key;
