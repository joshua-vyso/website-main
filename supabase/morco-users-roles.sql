-- ============================================================================
-- Morco Test Group — add two users (admins)
-- ----------------------------------------------------------------------------
-- Puts claudio@vyso.co.za and kelly@vyso.co.za in the "Morco Test Group" org as
-- admins (admins see revenue/outstanding; members get those tiles blurred — see
-- components/platform/RoleGate.tsx). Idempotent — safe to re-run.
--
-- PREREQUISITE (already done): the two auth users exist
--   (Authentication → Users). auth users can't be created from SQL; profiles
--   are linked here by email lookup.
-- ============================================================================

do $$
declare
  v_org uuid;
begin
  -- Find the Morco Test Group org, else create it.
  select id into v_org from organisations where name ilike '%morco%' order by created_at limit 1;
  if v_org is null then
    insert into organisations (name, slug, tier) values ('Morco Test Group', 'morco-test-group', 'scale')
    returning id into v_org;
  end if;

  -- Link the two users' profiles to the org as admins.
  insert into profiles (id, org_id, full_name, role)
    select u.id, v_org, 'Claudio', 'admin' from auth.users u where u.email = 'claudio@vyso.co.za'
  on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;

  insert into profiles (id, org_id, full_name, role)
    select u.id, v_org, 'Kelly', 'admin' from auth.users u where u.email = 'kelly@vyso.co.za'
  on conflict (id) do update set org_id = excluded.org_id, role = excluded.role;

  raise notice 'Morco Test Group org %: claudio@ and kelly@ linked as admins.', v_org;
end $$;

-- ----------------------------------------------------------------------------
-- Lock all modules except Doc-U and OrderFlow (same as Turn 'n Slice).
-- The sidebar shows locked modules with a lock + "Unlock" (→ contact Joshua),
-- and direct navigation is blocked. Idempotent.
-- ----------------------------------------------------------------------------
alter table organisations add column if not exists locked_modules text[] not null default '{}';

update organisations
set locked_modules = array['procurepulse', 'pricepilot', 'marginview', 'wastelog', 'shiftboard', 'suppliers', 'reportgen']
where name ilike '%morco%';

-- Verify (optional): who is in the org and their roles.
-- select u.email, p.role, p.full_name
-- from profiles p
-- join auth.users u on u.id = p.id
-- where p.org_id = (select id from organisations where name ilike '%morco%' order by created_at limit 1)
-- order by p.role, u.email;
