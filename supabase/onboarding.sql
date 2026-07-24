-- ============================================================================
-- Self-serve signup + Finch-guided onboarding
-- ----------------------------------------------------------------------------
-- Adds the onboarding/trial columns to `organisations`, a `waitlist_signups`
-- capture table, and the SECURITY DEFINER RPCs the web app calls to provision a
-- brand-new org for the signing-up user (no service-role key in the browser).
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run once, in
-- the SAME project the app points at (NEXT_PUBLIC_SUPABASE_URL). Idempotent —
-- safe to re-run. Until it is applied the onboarding RPCs simply do not exist;
-- the app surfaces a visible "Setup migration missing" card rather than crashing.
--
-- ⚠ REQUIRED DASHBOARD STEP (do this too, or verification codes never arrive):
--   Supabase dashboard → Authentication → Emails → "Confirm signup" template.
--   Replace the confirmation-link body with the 6-digit code token, e.g.:
--       <h2>Your Vyso verification code</h2>
--       <p>Enter this code to finish creating your account:</p>
--       <p style="font-size:28px;letter-spacing:6px;"><b>{{ .Token }}</b></p>
--   `{{ .Token }}` outputs the 6-digit OTP the signup flow verifies via
--   supabase.auth.verifyOtp({ type: 'signup', ... }). The default template only
--   emits a {{ .ConfirmationURL }} link, which this flow does not use.
-- ============================================================================

-- ── organisations: onboarding + trial columns ──────────────────────────────
alter table organisations add column if not exists industry text;
alter table organisations add column if not exists employee_count text;              -- band: '1-5'|'6-20'|'21-50'|'51-200'|'200+'
alter table organisations add column if not exists trial_started_at timestamptz;
alter table organisations add column if not exists trial_ends_at timestamptz;
alter table organisations add column if not exists onboarding_stage text not null default 'profile';  -- 'profile'|'modules'|'data'|'done'
alter table organisations add column if not exists onboarding_completed_at timestamptz;

-- Backfill: every pre-existing org is already "done" — it never sees onboarding
-- and has no trial clock. New orgs are created by the RPC below with their own
-- stage/trial values, so this only touches history.
update organisations
   set onboarding_stage = 'done',
       onboarding_completed_at = now()
 where onboarding_completed_at is null;

-- Widen the org_features feature_key CHECK to the full module list, so seeding
-- all nine rows below never trips an older, narrower constraint. Idempotent.
alter table org_features drop constraint if exists org_features_feature_key_check;
alter table org_features add constraint org_features_feature_key_check
  check (feature_key in (
    'docu','procurepulse','pricepilot','marginview','wastelog',
    'shiftboard','suppliers','orderflow','reportgen'
  ));

-- ── waitlist_signups: marketing "Join Waitlist" capture ─────────────────────
create table if not exists waitlist_signups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  company     text,
  source_path text,
  created_at  timestamptz not null default now()
);
-- One lead per email (case-insensitive). Lets waitlist_join() be idempotent.
create unique index if not exists idx_waitlist_signups_email_lower
  on waitlist_signups (lower(email));

-- Reached ONLY through the SECURITY DEFINER function below, never directly by a
-- client. RLS on + no policy = deny all direct access; the definer function
-- (owned by the migration role) still writes it.
alter table waitlist_signups enable row level security;

-- Public waitlist capture. Anonymous marketing visitors call this (no service
-- key needed). Idempotent: a repeat email is silently ignored.
create or replace function waitlist_join(
  p_name text,
  p_email text,
  p_company text,
  p_source_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'email is required';
  end if;

  insert into waitlist_signups (name, email, company, source_path)
  values (
    coalesce(nullif(trim(p_name), ''), ''),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_company, '')), ''),
    nullif(trim(coalesce(p_source_path, '')), '')
  )
  on conflict do nothing;   -- duplicate email → no-op (unique index above)
end;
$$;

grant execute on function waitlist_join(text, text, text, text) to anon, authenticated;

-- ── RPC 1: create the org for the signing-up user (onboarding stage 1) ──────
-- Guards: caller authenticated AND has no org yet. Creates the organisations
-- row (tier 'start', 14-day trial clock, every non-docu module locked until
-- stage 2), upserts the caller's profile as 'owner', and seeds nine enabled
-- org_features rows. Idempotent: if the caller already has an org, its id is
-- returned unchanged (double-submit safe).
create or replace function onboarding_create_org(
  p_org_name text,
  p_industry text,
  p_employee_count text,
  p_full_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_existing_org uuid;
  v_org_id       uuid;
  v_base_slug    text;
  v_slug         text;
  v_suffix       int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Idempotent: caller already belongs to an org → return it, change nothing.
  select org_id into v_existing_org from profiles where id = v_uid;
  if v_existing_org is not null then
    return v_existing_org;
  end if;

  -- Unique slug derived from the company name (fallback 'org').
  v_base_slug := nullif(
    trim(both '-' from regexp_replace(lower(coalesce(p_org_name, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  );
  if v_base_slug is null then
    v_base_slug := 'org';
  end if;
  v_slug := v_base_slug;
  while exists (select 1 from organisations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into organisations (
    name, slug, tier, locked_modules,
    industry, employee_count,
    trial_started_at, trial_ends_at, onboarding_stage
  ) values (
    coalesce(nullif(trim(p_org_name), ''), 'My company'),
    v_slug,
    'start',
    -- Everything except Doc-U locked until stage 2 records the module choice.
    array['procurepulse','pricepilot','marginview','wastelog','shiftboard','suppliers','reportgen','orderflow'],
    nullif(trim(coalesce(p_industry, '')), ''),
    nullif(trim(coalesce(p_employee_count, '')), ''),
    now(),
    now() + interval '14 days',
    'modules'
  )
  returning id into v_org_id;

  -- The caller becomes owner of the new org.
  insert into profiles (id, org_id, full_name, role)
  values (v_uid, v_org_id, nullif(trim(coalesce(p_full_name, '')), ''), 'owner')
  on conflict (id) do update
    set org_id    = excluded.org_id,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        role      = 'owner';

  -- Seed every module feature row enabled (future-proof; gating is via
  -- locked_modules today). where-not-exists rather than on-conflict so it does
  -- not depend on a (org_id, feature_key) unique constraint existing.
  insert into org_features (org_id, feature_key, enabled)
  select v_org_id, f.k, true
  from unnest(array[
    'docu','procurepulse','pricepilot','marginview','wastelog',
    'shiftboard','suppliers','reportgen','orderflow'
  ]) as f(k)
  where not exists (
    select 1 from org_features e where e.org_id = v_org_id and e.feature_key = f.k
  );

  return v_org_id;
end;
$$;

grant execute on function onboarding_create_org(text, text, text, text) to authenticated;

-- ── RPC 2: record the 3-module trial choice (onboarding stage 2) ────────────
-- Guards: caller is the org owner, onboarding not yet completed, exactly 3
-- distinct valid non-docu keys. Sets locked_modules to the 5 unchosen non-docu
-- keys (chosen 3 + always-on Doc-U = 4 open) and advances the stage to 'data'.
-- Re-runnable until onboarding_complete() locks it.
create or replace function onboarding_choose_modules(p_modules text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_org_id    uuid;
  v_role      text;
  v_completed timestamptz;
  v_valid     text[] := array[
    'procurepulse','pricepilot','marginview','wastelog',
    'shiftboard','suppliers','reportgen','orderflow'
  ];
  v_locked    text[];
  m text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.org_id, p.role into v_org_id, v_role from profiles p where p.id = v_uid;
  if v_org_id is null then
    raise exception 'caller has no organisation';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'only the owner can choose modules';
  end if;

  select onboarding_completed_at into v_completed from organisations where id = v_org_id;
  if v_completed is not null then
    raise exception 'onboarding already completed';
  end if;

  -- Exactly 3, distinct, valid, none = 'docu'.
  if array_length(p_modules, 1) is distinct from 3 then
    raise exception 'exactly 3 modules must be chosen';
  end if;
  if (select count(distinct x) from unnest(p_modules) x) <> 3 then
    raise exception 'chosen modules must be distinct';
  end if;
  foreach m in array p_modules loop
    if m = 'docu' or not (m = any(v_valid)) then
      raise exception 'invalid module key: %', m;
    end if;
  end loop;

  -- Lock the non-chosen non-docu keys.
  select coalesce(array_agg(k), '{}') into v_locked
  from unnest(v_valid) as k
  where not (k = any(p_modules));

  update organisations
     set locked_modules   = v_locked,
         onboarding_stage = 'data'
   where id = v_org_id;
end;
$$;

grant execute on function onboarding_choose_modules(text[]) to authenticated;

-- ── RPC 3: finish onboarding (stage 3 done or skipped) ──────────────────────
-- Guards: caller is the org owner. Marks the stage 'done' and stamps
-- onboarding_completed_at (which is what app/app + /onboarding gate on).
create or replace function onboarding_complete()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_org_id uuid;
  v_role   text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.org_id, p.role into v_org_id, v_role from profiles p where p.id = v_uid;
  if v_org_id is null then
    raise exception 'caller has no organisation';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'only the owner can complete onboarding';
  end if;

  update organisations
     set onboarding_stage        = 'done',
         onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_org_id;
end;
$$;

grant execute on function onboarding_complete() to authenticated;
