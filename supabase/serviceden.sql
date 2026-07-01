-- ServiceDen — a lightweight module for SERVICE businesses (customers, custom
-- services, and invoices you build from those services and export to PDF).
-- Org-scoped RLS, same shape as the of_*/ss_* tables. Idempotent — safe to
-- re-run. Paste into the Supabase SQL editor.
--
-- Access to the module UI is gated in-app to a single account (joshua@vyso.co.za),
-- but the tables are ordinary org-scoped tables so the data lives under the
-- Vyso organisation like everything else.

create table if not exists sd_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_customers_org on sd_customers (org_id, name);

create table if not exists sd_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  description text,
  -- how the service is billed: hour | day | fixed | project | month | unit
  unit text not null default 'fixed',
  unit_price numeric not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_services_org on sd_services (org_id, sort_order);

create table if not exists sd_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid references sd_customers(id) on delete set null,
  invoice_number text not null,
  -- draft | sent | paid
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  -- VAT / tax percentage applied to the subtotal
  tax_rate numeric not null default 15,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_invoices_org on sd_invoices (org_id, created_at desc);

create table if not exists sd_invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  invoice_id uuid not null references sd_invoices(id) on delete cascade,
  -- the service this line came from (nullable — kept for reference only; the
  -- description/price below are a SNAPSHOT so editing a service later never
  -- rewrites a past invoice)
  service_id uuid references sd_services(id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_invoice_items_invoice on sd_invoice_items (invoice_id, sort_order);
create index if not exists idx_sd_invoice_items_org on sd_invoice_items (org_id);

-- Row level security (org-scoped, same pattern as of_*/ss_*).
alter table sd_customers     enable row level security;
alter table sd_services      enable row level security;
alter table sd_invoices      enable row level security;
alter table sd_invoice_items enable row level security;

drop policy if exists sd_customers_all     on sd_customers;
drop policy if exists sd_services_all       on sd_services;
drop policy if exists sd_invoices_all        on sd_invoices;
drop policy if exists sd_invoice_items_all    on sd_invoice_items;

create policy sd_customers_all on sd_customers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_services_all on sd_services for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_invoices_all on sd_invoices for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sd_invoice_items_all on sd_invoice_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
