-- How each product is measured across purchase / stock / recipe, with the
-- conversion factor, edited on Products → Units. Powers stock, recipes and
-- orders. Org-scoped RLS. Idempotent — paste in the Supabase SQL editor.

create table if not exists pp_product_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  stock_item_id uuid not null references pp_stock_items(id) on delete cascade,
  purchase_unit text,                             -- e.g. boxes, crates, punnets
  stock_unit text,                                -- e.g. kg, punnets
  recipe_unit text,                               -- e.g. kg
  conversion_factor numeric,                      -- purchase unit × factor → stock units
  updated_at timestamptz not null default now(),
  unique (org_id, stock_item_id)
);

create index if not exists idx_pp_product_units_org on pp_product_units (org_id);

alter table pp_product_units enable row level security;

drop policy if exists pp_product_units_all on pp_product_units;
create policy pp_product_units_all on pp_product_units for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
