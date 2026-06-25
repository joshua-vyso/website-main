-- PricePilot data model: price lists (+ per-item margin overrides) and customer
-- complaints. Sales views read OrderFlow (of_orders) directly — no tables here.
-- Cross-module references (customer_id, order_id) are plain uuids (no FK) so this
-- migration is independent of the OrderFlow one. Org-scoped RLS. Idempotent.

create table if not exists pl_price_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  customer_id uuid,                       -- of_customers.id (optional)
  default_margin_pct numeric not null default 25,
  cadence text not null default 'standard', -- standard | daily | weekly | monthly
  created_at timestamptz not null default now()
);
create index if not exists idx_pl_price_lists_org on pl_price_lists (org_id, created_at desc);

create table if not exists pl_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  price_list_id uuid not null references pl_price_lists(id) on delete cascade,
  stock_item_id uuid not null references pp_stock_items(id) on delete cascade,
  margin_pct numeric not null,
  created_at timestamptz not null default now(),
  unique (price_list_id, stock_item_id)
);
create index if not exists idx_pl_overrides_list on pl_overrides (price_list_id);

create table if not exists pl_complaints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid,                       -- of_customers.id (optional)
  order_id uuid,                          -- of_orders.id (optional)
  title text not null,
  body text,
  image_url text,
  status text not null default 'open',    -- open | investigating | resolved
  created_at timestamptz not null default now()
);
create index if not exists idx_pl_complaints_org on pl_complaints (org_id, created_at desc);

alter table pl_price_lists enable row level security;
alter table pl_overrides    enable row level security;
alter table pl_complaints   enable row level security;

drop policy if exists pl_price_lists_all on pl_price_lists;
drop policy if exists pl_overrides_all    on pl_overrides;
drop policy if exists pl_complaints_all    on pl_complaints;

create policy pl_price_lists_all on pl_price_lists for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pl_overrides_all on pl_overrides for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pl_complaints_all on pl_complaints for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
