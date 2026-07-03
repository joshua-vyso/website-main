-- ============================================================================
-- Turn 'n Slice — add two users + admin/member roles
-- ----------------------------------------------------------------------------
-- Puts marco@turnnslice.com and orders@turnnslice.com in the Turn 'n Slice org,
-- and makes EVERY user in that org an admin EXCEPT orders@turnnslice.com, who is
-- a member (members don't see revenue/outstanding — see components/platform/
-- RoleGate.tsx). Idempotent — safe to re-run.
--
-- PREREQUISITE (do this first, in the Supabase dashboard):
--   Authentication → Users → Add user, tick "Auto Confirm User", create:
--     • marco@turnnslice.com   (set a password)
--     • orders@turnnslice.com  (set a password)
--   Then paste + run this file in the SQL editor. (auth users can't be created
--   from SQL; profiles are linked here by email lookup.)
-- ============================================================================

do $$
declare
  v_org uuid;
  v_orders uuid;
begin
  -- Find the Turn 'n Slice org (tolerant of "Turn 'n Slice" / "Turn N Slice HO"),
  -- else create it.
  select id into v_org from organisations where name ilike '%turn%slice%' order by created_at limit 1;
  if v_org is null then
    insert into organisations (name, slug, tier) values ('Turn ''n Slice', 'turn-n-slice', 'scale')
    returning id into v_org;
  end if;

  select id into v_orders from auth.users where email = 'orders@turnnslice.com';

  -- Link the two new users' profiles to the org with their roles.
  insert into profiles (id, org_id, full_name, role)
    select u.id, v_org, 'Marco', 'admin' from auth.users u where u.email = 'marco@turnnslice.com'
  on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;

  insert into profiles (id, org_id, full_name, role)
    select u.id, v_org, 'Orders', 'member' from auth.users u where u.email = 'orders@turnnslice.com'
  on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;

  -- Every user in the org is an admin, except orders@turnnslice.com (member).
  -- (Owners are left as owners — an owner already outranks admin.)
  update profiles p set role = 'admin'
    where p.org_id = v_org
      and p.role <> 'owner'
      and (v_orders is null or p.id <> v_orders);

  if v_orders is not null then
    update profiles p set role = 'member' where p.id = v_orders;
  end if;

  raise notice 'Turn ''n Slice org %: roles updated (orders@ = member, others = admin).', v_org;
end $$;

-- Verify (optional): who is in the org and their roles.
-- select u.email, p.role
-- from profiles p
-- join auth.users u on u.id = p.id
-- where p.org_id = (select id from organisations where name ilike '%turn%slice%' order by created_at limit 1)
-- order by p.role, u.email;
