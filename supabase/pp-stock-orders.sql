-- Stock orders created from the Reordering page ("Send to team"). Header + lines,
-- so the page can show order history grouped by week. Org-scoped RLS. Idempotent.

create table if not exists pp_stock_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier text,
  status text not null default 'sent',           -- draft | sent | completed | cancelled
  total numeric not null default 0,
  item_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pp_stock_orders_org on pp_stock_orders (org_id, created_at desc);

create table if not exists pp_stock_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  order_id uuid not null references pp_stock_orders(id) on delete cascade,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  product_name text not null,
  qty numeric not null default 0,
  unit text,
  unit_price numeric,
  line_total numeric
);
create index if not exists idx_pp_stock_order_items_order on pp_stock_order_items (order_id);

alter table pp_stock_orders enable row level security;
alter table pp_stock_order_items enable row level security;

drop policy if exists pp_stock_orders_all on pp_stock_orders;
create policy pp_stock_orders_all on pp_stock_orders for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists pp_stock_order_items_all on pp_stock_order_items;
create policy pp_stock_order_items_all on pp_stock_order_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
