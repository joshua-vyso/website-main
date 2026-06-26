-- Stock + freshness + reorder thresholds per product, edited on Products →
-- Thresholds. Feeds Alerts and Intelligence. Stock intelligence only — NO wastage
-- thresholds. Org-scoped RLS. Idempotent — paste in the Supabase SQL editor.

create table if not exists pp_stock_thresholds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  stock_item_id uuid not null references pp_stock_items(id) on delete cascade,
  low_threshold numeric,
  par_level numeric,                              -- target / par level
  lead_time_days numeric,                         -- reorder lead time
  freshness_value numeric,                        -- e.g. lettuce = 2
  freshness_unit text default 'days',             -- 'hours' | 'days'
  alerts_enabled boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  unique (org_id, stock_item_id)
);

create index if not exists idx_pp_stock_thresholds_org on pp_stock_thresholds (org_id);

alter table pp_stock_thresholds enable row level security;

drop policy if exists pp_stock_thresholds_all on pp_stock_thresholds;
create policy pp_stock_thresholds_all on pp_stock_thresholds for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
