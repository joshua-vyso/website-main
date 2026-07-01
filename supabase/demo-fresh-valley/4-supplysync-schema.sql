-- SupplySync data model: supplier INTELLIGENCE (not inventory) for a Cape Town
-- fresh-produce wholesaler. Org-scoped RLS, mirroring the existing of_*/pl_*
-- tables. Idempotent — safe to re-run. Paste into the Supabase SQL editor.
--
--   ss_suppliers            -- the supply base: scorecard, risk, status, spend, trends
--   ss_supplier_contacts    -- multiple contacts per supplier (sales/accounts/dispatch/…)
--   ss_supplier_documents   -- compliance docs per supplier (contract / coa / bee / …)
--   ss_supplier_pricing     -- pricing history visibility per item/category
--   ss_supplier_risks       -- risk register (missing docs, late delivery, volatility, …)
--   ss_supplier_history     -- relationship timeline + communication log + follow-ups

-- ---------------------------------------------------------------------------
-- Suppliers (base table already exists; this block also ADDs the intelligence
-- columns for anyone whose ss_suppliers predates the overhaul).
-- ---------------------------------------------------------------------------
create table if not exists ss_suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  category text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text not null default 'active',        -- preferred | active | review
  risk text not null default 'low',             -- low | medium | high
  rating numeric not null default 3,            -- 1-5 stars
  reliability int not null default 80,          -- component scores, 0-100
  quality int not null default 80,
  delivery_pct int not null default 85,
  on_time_pct int not null default 90,
  price_trend text not null default 'stable',   -- stable | rising | volatile
  lead_time_days int not null default 2,
  last_issue text,
  last_order date,
  spend_mtd numeric not null default 0,
  currency text not null default 'ZAR',
  notes jsonb not null default '[]'::jsonb,      -- [{ body, date, author }]
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_suppliers_org on ss_suppliers (org_id, name);

-- Intelligence columns (additive; no-op if already present).
alter table ss_suppliers add column if not exists overall_score int;                       -- 0-100 (null → derived)
alter table ss_suppliers add column if not exists price_stability int not null default 80;  -- 0-100
alter table ss_suppliers add column if not exists delivery_consistency int not null default 85;
alter table ss_suppliers add column if not exists responsiveness int not null default 85;
alter table ss_suppliers add column if not exists compliance_score int not null default 90;
alter table ss_suppliers add column if not exists avg_monthly_spend numeric not null default 0;
alter table ss_suppliers add column if not exists categories text[] not null default '{}';  -- produce lines supplied
alter table ss_suppliers add column if not exists market_position text not null default 'at'; -- below | at | above
alter table ss_suppliers add column if not exists late_deliveries int not null default 0;
alter table ss_suppliers add column if not exists quality_issues int not null default 0;
alter table ss_suppliers add column if not exists complaints int not null default 0;
alter table ss_suppliers add column if not exists response_hours numeric not null default 6;
alter table ss_suppliers add column if not exists reliability_trend jsonb not null default '[]'::jsonb; -- number[]
alter table ss_suppliers add column if not exists delivery_trend jsonb not null default '[]'::jsonb;    -- number[]
alter table ss_suppliers add column if not exists score_trend jsonb not null default '[]'::jsonb;       -- number[]
alter table ss_suppliers add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Contacts — multiple people per supplier.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  name text not null,
  role text not null default 'Sales',           -- Sales | Accounts | Dispatch | Owner/Manager | After-hours
  email text,
  phone text,
  preferred_method text not null default 'Call',-- Call | WhatsApp | Email
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_contacts_supplier on ss_supplier_contacts (supplier_id, sort_order);
create index if not exists idx_ss_supplier_contacts_org on ss_supplier_contacts (org_id);

-- ---------------------------------------------------------------------------
-- Documents — compliance checklist per supplier.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  doc_type text not null,                        -- contract | coa | bee-certificate | insurance | tax-clearance | food-safety | bank-confirmation | price-list
  label text not null,
  status text not null default 'valid',          -- valid | expiring | expired | missing
  expiry date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_documents_org on ss_supplier_documents (org_id, expiry);
create index if not exists idx_ss_supplier_documents_supplier on ss_supplier_documents (supplier_id);

-- ---------------------------------------------------------------------------
-- Pricing — pricing-history visibility per item/category (SupplySync surfaces
-- pricing intelligence; actual purchasing stays in ProcurePulse).
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_pricing (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  item text not null,                            -- e.g. Oranges, Golden apples
  category text not null,                        -- e.g. Citrus, Pome Fruit
  unit text not null default 'kg',
  current_price numeric not null default 0,
  previous_price numeric not null default 0,
  market_avg numeric not null default 0,
  last_updated date,
  trend jsonb not null default '[]'::jsonb,       -- number[] mini-series
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_pricing_supplier on ss_supplier_pricing (supplier_id, sort_order);
create index if not exists idx_ss_supplier_pricing_org on ss_supplier_pricing (org_id, category);

-- ---------------------------------------------------------------------------
-- Risk register — one row per open risk; statuses are user-editable.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_risks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid references ss_suppliers(id) on delete cascade,
  risk_type text not null,                       -- Missing Document | Expiring Document | Late Delivery | Quality Issue | Price Volatility | Low Responsiveness | No Recent Update | Compliance Issue
  severity text not null default 'medium',       -- low | medium | high | critical
  description text not null default '',
  suggested_action text,
  owner text,
  status text not null default 'open',           -- open | in_progress | resolved | ignored
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_risks_org on ss_supplier_risks (org_id, status);
create index if not exists idx_ss_supplier_risks_supplier on ss_supplier_risks (supplier_id);

-- ---------------------------------------------------------------------------
-- Relationship history — timeline + communication log + follow-ups.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid references ss_suppliers(id) on delete cascade,
  event_type text not null,                      -- document_uploaded | price_list_received | late_delivery | compliance_issue | marked_preferred | note_added | order_linked | call | whatsapp | email | meeting | price_update | document_request | complaint | delivery_issue
  channel text,                                  -- Call | WhatsApp | Email | Meeting | Price Update | Document Request | Complaint | Delivery Issue
  summary text not null default '',
  contact_name text,
  follow_up text,                                -- next action, if any
  follow_up_date date,
  follow_up_done boolean not null default false,
  owner text,
  event_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_history_org on ss_supplier_history (org_id, event_date desc);
create index if not exists idx_ss_supplier_history_supplier on ss_supplier_history (supplier_id, event_date desc);

-- ---------------------------------------------------------------------------
-- Row level security: each org only sees its own rows (same shape as of_*/pl_*).
-- ---------------------------------------------------------------------------
alter table ss_suppliers          enable row level security;
alter table ss_supplier_contacts  enable row level security;
alter table ss_supplier_documents enable row level security;
alter table ss_supplier_pricing   enable row level security;
alter table ss_supplier_risks     enable row level security;
alter table ss_supplier_history   enable row level security;

drop policy if exists ss_suppliers_all          on ss_suppliers;
drop policy if exists ss_supplier_contacts_all   on ss_supplier_contacts;
drop policy if exists ss_supplier_documents_all  on ss_supplier_documents;
drop policy if exists ss_supplier_pricing_all     on ss_supplier_pricing;
drop policy if exists ss_supplier_risks_all       on ss_supplier_risks;
drop policy if exists ss_supplier_history_all      on ss_supplier_history;

create policy ss_suppliers_all on ss_suppliers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_contacts_all on ss_supplier_contacts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_documents_all on ss_supplier_documents for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_pricing_all on ss_supplier_pricing for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_risks_all on ss_supplier_risks for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_history_all on ss_supplier_history for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
