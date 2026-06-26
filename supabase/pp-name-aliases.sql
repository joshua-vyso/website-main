-- Product-name aliases: durable, human-confirmed links between the messy
-- market-statement descriptions Doc-U feeds in and the canonical catalogue /
-- price-list product. Confirming a match records a row here so future feeds map
-- the raw name straight to the right stock item instead of creating a duplicate.
-- Org-scoped RLS, mirroring the pp_* pattern. Idempotent — paste in the dashboard.

create table if not exists pp_name_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_name text not null,                        -- the discovered / as-fed name
  normalized_name text,                          -- normalizeName() output (lookup aid)
  suggested_name text,                           -- system suggestion at confirm time
  custom_name text,                              -- the canonical name the user chose
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  -- confirmed → use it; dismissed → never surface this raw name again
  status text not null default 'confirmed',      -- confirmed | dismissed
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, raw_name)                       -- one ruling per raw name per org
);

create index if not exists idx_pp_name_aliases_org on pp_name_aliases (org_id, status);

alter table pp_name_aliases enable row level security;

drop policy if exists pp_name_aliases_all on pp_name_aliases;
create policy pp_name_aliases_all on pp_name_aliases for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
