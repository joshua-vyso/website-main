-- ============================================================================
-- SupplySync ↔ Doc-U linking (docs/plans/docu-supplysync-invoice-linking.md).
--
-- Doc-U files documents against the core `suppliers` table, but SupplySync
-- reads its own `ss_suppliers` — two unrelated tables, so a scanned invoice
-- never reached the supplier's SupplySync profile. This migration:
--
--   1. bridges the identities  (ss_suppliers.supplier_id → suppliers.id)
--   2. adds `supplier_aliases` (org-scoped, human-confirmed name → supplier
--      rulings, mirroring the pp_name_aliases pattern)
--   3. makes the SupplySync history feed idempotent per document
--      (ss_supplier_history.document_id + unique index)
--   4. backfills: creates missing core suppliers for seeded ss_suppliers rows,
--      then links both directions by normalised name
--   5. adds the ss_* tables the app now writes to the Realtime publication
--   6. perf index for the per-supplier document queries
--
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.
-- Run AFTER the demo seeds if you use them (the backfill links seeded rows).
--
-- PREREQUISITE: the SupplySync base tables (ss_suppliers, ss_supplier_history)
-- must already exist. They are created by
-- supabase/demo-fresh-valley/4-supplysync-schema.sql, which is idempotent and
-- org-scoped by RLS — running it on a production database only creates the
-- empty tables, it seeds nothing. The guard below fails LOUDLY with this
-- instruction instead of a cryptic "relation does not exist" if it is skipped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisite guard: the ss_* base schema must exist first.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ss_suppliers') is null
     or to_regclass('public.ss_supplier_history') is null then
    raise exception using
      message = 'SupplySync base schema is missing.',
      hint = 'Run supabase/demo-fresh-valley/4-supplysync-schema.sql first (idempotent, org-scoped, seeds nothing), then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Identity bridge: a SupplySync profile is an extension of a core supplier.
-- ---------------------------------------------------------------------------
alter table ss_suppliers
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- One profile per core supplier per org (nulls exempt: unbridged seed rows are fine).
create unique index if not exists idx_ss_suppliers_supplier_unique
  on ss_suppliers (org_id, supplier_id) where supplier_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Supplier-name aliases: durable, human-confirmed links between the messy
--    names extracted off documents and the canonical supplier. Confirming a
--    match in review records a row; future scans resolve instantly. Mirrors
--    pp_name_aliases.
-- ---------------------------------------------------------------------------
create table if not exists supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_name text not null,                       -- the name as extracted
  normalized_name text not null,                -- lookup key (lowercased, cleaned)
  supplier_id uuid references suppliers(id) on delete cascade,
  -- confirmed → auto-link to supplier_id; dismissed → never auto-link this name
  status text not null default 'confirmed',     -- confirmed | dismissed
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, normalized_name)              -- one ruling per name per org
);

create index if not exists idx_supplier_aliases_org on supplier_aliases (org_id, status);

alter table supplier_aliases enable row level security;
drop policy if exists supplier_aliases_all on supplier_aliases;
create policy supplier_aliases_all on supplier_aliases for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Idempotent history feed: each document may add ONE timeline event of a
--    given type. Non-partial unique index — NULL document_id rows (seeds,
--    manual log entries) stay unconstrained because Postgres treats NULLs as
--    distinct. `on delete set null` keeps the timeline if a document is purged.
-- ---------------------------------------------------------------------------
alter table ss_supplier_history
  add column if not exists document_id uuid references documents(id) on delete set null;

create unique index if not exists idx_ss_supplier_history_doc_event
  on ss_supplier_history (document_id, event_type);

-- ---------------------------------------------------------------------------
-- 4. Backfill. Names match on lower(trim()); `suppliers` already carries a
--    per-org unique index on the lowered name, so matches are unambiguous.
-- ---------------------------------------------------------------------------

-- 4a. Seeded SupplySync profiles whose supplier doesn't exist yet in core →
--     create the core row (initials = first letters of the first two words).
--     distinct on (org_id, lower(trim(name))) so two profiles sharing a
--     normalised name insert ONE core supplier, not a pair that trips the
--     (org_id, lower(name)) unique index and aborts the whole migration.
insert into suppliers (org_id, name, initials)
select distinct on (ss.org_id, lower(trim(ss.name)))
       ss.org_id, trim(ss.name),
       upper(left(split_part(trim(ss.name), ' ', 1), 1) ||
             left(split_part(trim(ss.name), ' ', 2), 1))
from ss_suppliers ss
where ss.supplier_id is null
  and trim(ss.name) <> ''
  and not exists (
    select 1 from suppliers s
    where s.org_id = ss.org_id and lower(trim(s.name)) = lower(trim(ss.name))
  )
order by ss.org_id, lower(trim(ss.name)), ss.created_at;

-- 4b. Link every unbridged profile to its name-matched core supplier. Bridge
--     at most ONE profile per (org_id, supplier_id): the `pick` CTE keeps the
--     oldest unbridged profile per normalised name, so duplicate-named profiles
--     don't both claim one supplier and trip the partial unique index. It also
--     excludes suppliers already claimed by a bridged profile.
with pick as (
  select distinct on (ss.org_id, lower(trim(ss.name)))
         ss.id as ss_id, s.id as supplier_id
  from ss_suppliers ss
  join suppliers s
    on s.org_id = ss.org_id
   and lower(trim(s.name)) = lower(trim(ss.name))
  where ss.supplier_id is null
    and not exists (
      select 1 from ss_suppliers other
      where other.org_id = ss.org_id and other.supplier_id = s.id
    )
  order by ss.org_id, lower(trim(ss.name)), ss.created_at
)
update ss_suppliers ss
set supplier_id = pick.supplier_id
from pick
where ss.id = pick.ss_id;

-- ---------------------------------------------------------------------------
-- 5. Realtime on the tables the ingest pipeline now writes, so SupplySync
--    pages update live. RLS is enforced by Realtime (fails closed).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'ss_suppliers',         -- rollups (spend, last order) after a commit
    'ss_supplier_history'   -- the relationship timeline event per document
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Per-supplier document queries (profile "From Doc-U" list + spend rollups).
-- ---------------------------------------------------------------------------
create index if not exists idx_documents_org_supplier
  on documents (org_id, supplier_id, created_at desc);
