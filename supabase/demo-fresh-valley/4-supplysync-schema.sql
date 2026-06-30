-- SupplySync data model: supplier intelligence (NOT inventory) for a Cape Town
-- fresh-produce wholesaler. Org-scoped RLS, mirroring the existing of_*/pl_*
-- tables. Idempotent. Paste into the Supabase SQL editor.
--
--   ss_suppliers            -- the supply base: rating, risk, status, performance, spend
--   ss_supplier_documents   -- compliance docs per supplier: contract / coa / bee / insurance

create table if not exists ss_suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  -- produce type / category this supplier covers, e.g. Stone Fruit, Citrus, Root Veg
  category text not null,
  -- primary contact
  contact_name text,
  contact_phone text,
  contact_email text,
  -- preferred | active | review
  status text not null default 'active',
  -- low | medium | high supply-risk classification
  risk text not null default 'low',
  -- overall supplier rating, 1-5 stars
  rating numeric not null default 3,
  -- performance scores (0-100); reliability mirrors the view's "reliability" column
  reliability int not null default 80,
  quality int not null default 80,
  delivery_pct int not null default 85,
  on_time_pct int not null default 90,
  -- stable | rising | volatile pricing behaviour
  price_trend text not null default 'stable',
  lead_time_days int not null default 2,
  last_issue text,
  last_order date,
  -- month-to-date spend with this supplier, in ZAR
  spend_mtd numeric not null default 0,
  currency text not null default 'ZAR',
  -- free-form running notes / history: [{ body, date, author }]
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_suppliers_org on ss_suppliers (org_id, name);

create table if not exists ss_supplier_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  -- contract | coa | bee-certificate | insurance | tax-clearance
  doc_type text not null,
  label text not null,
  -- valid | expiring | missing
  status text not null default 'valid',
  expiry date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_documents_org on ss_supplier_documents (org_id, expiry);
create index if not exists idx_ss_supplier_documents_supplier on ss_supplier_documents (supplier_id);

-- Row level security: each org only sees its own rows (same shape as of_*/pl_*).
alter table ss_suppliers          enable row level security;
alter table ss_supplier_documents enable row level security;

drop policy if exists ss_suppliers_all          on ss_suppliers;
drop policy if exists ss_supplier_documents_all  on ss_supplier_documents;

create policy ss_suppliers_all on ss_suppliers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_documents_all on ss_supplier_documents for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
