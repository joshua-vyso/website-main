-- OrderFlow data model: customers, orders, order items. Org-scoped RLS, mirroring
-- the existing pp_* tables. Idempotent. Paste into the Supabase SQL editor.

create table if not exists of_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  -- standard | daily | weekly | monthly agreed pricing
  pricing_status text not null default 'standard',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_customers_org on of_customers (org_id, name);

create table if not exists of_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid references of_customers(id) on delete set null,
  -- draft | confirmed | invoiced | paid
  status text not null default 'draft',
  invoice_number text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_orders_org on of_orders (org_id, created_at desc);

create table if not exists of_order_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  order_id uuid not null references of_orders(id) on delete cascade,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_order_items_order on of_order_items (order_id);

-- Row level security: each org only sees its own rows (same shape as pp_*).
alter table of_customers   enable row level security;
alter table of_orders      enable row level security;
alter table of_order_items enable row level security;

drop policy if exists of_customers_all   on of_customers;
drop policy if exists of_orders_all       on of_orders;
drop policy if exists of_order_items_all  on of_order_items;

create policy of_customers_all on of_customers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy of_orders_all on of_orders for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy of_order_items_all on of_order_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
