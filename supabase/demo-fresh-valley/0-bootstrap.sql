-- ============================================================================
-- Fresh Valley Produce — demo workspace bootstrap
-- ============================================================================
-- A fruit & veg wholesale distributor in Cape Town (~R7M/month, 40 staff).
-- This creates the organisation, links the demo login to it, and enables every
-- module. Run this FIRST, then the per-module schema files, then the seeds.
--
-- PREREQUISITE (do this yourself — Claude cannot create accounts):
--   Supabase dashboard → Authentication → Users → Add user
--     email: demo@vyso.co.za   password: 1234   (tick "Auto Confirm User")
--
-- HOW TO APPLY: paste into the Supabase SQL editor and run once. Idempotent.
-- ============================================================================

-- 1. Organisation (idempotent by name).
insert into organisations (name, slug, location, tier)
select 'Fresh Valley Produce', 'fresh-valley-produce', 'Cape Town, South Africa', 'scale'
where not exists (select 1 from organisations where name = 'Fresh Valley Produce');

-- 2. Link the demo user's profile to the org. Works whether or not a profile
--    row was auto-created on signup.
insert into profiles (id, org_id, full_name, role)
select u.id, o.id, 'Demo Owner', 'owner'
from auth.users u
cross join (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
where u.email = 'demo@vyso.co.za'
on conflict (id) do update set org_id = excluded.org_id;

-- 3. Enable every module for the org (so it works even after the temporary
--    force-all-features flag is removed from getPlatformSession).
alter table org_features drop constraint if exists org_features_feature_key_check;
alter table org_features add constraint org_features_feature_key_check
  check (feature_key in ('docu','procurepulse','pricepilot','marginview','wastelog','shiftboard','suppliers','orderflow','reportgen'));

insert into org_features (org_id, feature_key, enabled)
select o.id, f.k, true
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values ('docu'),('procurepulse'),('pricepilot'),('marginview'),('wastelog'),('shiftboard'),('suppliers'),('orderflow'),('reportgen')) as f(k)
where not exists (select 1 from org_features e where e.org_id = o.id and e.feature_key = f.k);

-- Verify:
--   select name, slug, tier from organisations where name = 'Fresh Valley Produce';
--   select p.full_name, p.role, o.name from profiles p join organisations o on o.id = p.org_id
--     where o.name = 'Fresh Valley Produce';
