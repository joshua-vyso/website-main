-- ============================================================================
-- Vyso workspace bootstrap — for joshua@vyso.co.za
-- ============================================================================
-- Creates the "Vyso" organisation, links your login's profile to it, and
-- enables every module. This is what gives your session an `org`, which the
-- app needs before it can save anything (otherwise you get "Not connected.").
--
-- PREREQUISITE: the auth user must already exist.
--   Supabase dashboard → Authentication → Users → joshua@vyso.co.za  (confirmed)
--
-- HOW TO APPLY: paste into the Supabase SQL editor and run once. Idempotent.
-- Run this in the SAME project the app points at (NEXT_PUBLIC_SUPABASE_URL),
-- then also run supabase/serviceden.sql for the ServiceDen tables.
-- ============================================================================

-- 1. Organisation (idempotent by name).
insert into organisations (name, slug, location, tier)
select 'Vyso', 'vyso', 'South Africa', 'scale'
where not exists (select 1 from organisations where name = 'Vyso');

-- 2. Link joshua@vyso.co.za's profile to the org (works whether or not a
--    profile row was auto-created on signup).
insert into profiles (id, org_id, full_name, role)
select u.id, o.id, 'Joshua Moreira', 'owner'
from auth.users u
cross join (select id from organisations where name = 'Vyso' limit 1) o
where u.email = 'joshua@vyso.co.za'
on conflict (id) do update set org_id = excluded.org_id;

-- 3. Enable every module for the org (so it works even after the temporary
--    force-all-features flag is removed from getPlatformSession).
alter table org_features drop constraint if exists org_features_feature_key_check;
alter table org_features add constraint org_features_feature_key_check
  check (feature_key in ('docu','procurepulse','pricepilot','marginview','wastelog','shiftboard','suppliers','orderflow','reportgen'));

insert into org_features (org_id, feature_key, enabled)
select o.id, f.k, true
from (select id from organisations where name = 'Vyso' limit 1) o
cross join (values ('docu'),('procurepulse'),('pricepilot'),('marginview'),('wastelog'),('shiftboard'),('suppliers'),('orderflow'),('reportgen')) as f(k)
where not exists (select 1 from org_features e where e.org_id = o.id and e.feature_key = f.k);

-- Verify (should return one row with full_name = 'Joshua Moreira', name = 'Vyso'):
--   select p.full_name, p.role, o.name
--   from profiles p join organisations o on o.id = p.org_id
--   where o.name = 'Vyso';
