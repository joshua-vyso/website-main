-- ============================================================================
-- Core Data + OrderFlow v2 schema
-- ----------------------------------------------------------------------------
-- Core Data is the shared source of truth for operational records across Vyso:
--   Customers            → of_customers      (extended below)
--   Contacts             → cd_contacts       (new)
--   Delivery addresses   → cd_delivery_addresses (new)
--   Products & services  → pp_stock_items    (extended below)
--   Price lists          → pl_price_lists + pl_overrides (extended below)
--   Payment terms        → cd_payment_terms  (new)
--   VAT settings         → cd_vat_rates      (new)
--   Company profile      → cd_company_profile (new, one row per org)
--   Document templates   → cd_doc_templates  (new)
-- OrderFlow operational entities (quotes, real invoices, credit notes, delivery
-- notes, payments, activity, numbering) are the of_* tables below.
--
-- REQUIRES orderflow-schema.sql + pricepilot-schema.sql to have run first
-- (extends of_customers / pp_stock_items / pl_* and references documents).
-- Idempotent — safe to re-run. Paste into the Supabase dashboard SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Customers (Core Data) — extend of_customers
-- ----------------------------------------------------------------------------
alter table of_customers add column if not exists trading_name text;
alter table of_customers add column if not exists vat_number text;
alter table of_customers add column if not exists registration_number text;
-- active | inactive | on_hold
alter table of_customers add column if not exists account_status text not null default 'active';
-- retail | wholesale | hospitality | restaurant | hotel | other
alter table of_customers add column if not exists customer_type text not null default 'other';
alter table of_customers add column if not exists payment_terms_days int;
alter table of_customers add column if not exists credit_limit numeric;
alter table of_customers add column if not exists default_price_list_id uuid references pl_price_lists(id) on delete set null;
alter table of_customers add column if not exists billing_address text;
alter table of_customers add column if not exists tags text[] not null default '{}';
alter table of_customers add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. Customer contacts
-- ----------------------------------------------------------------------------
create table if not exists cd_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid not null references of_customers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cd_contacts_org on cd_contacts (org_id);
create index if not exists idx_cd_contacts_customer on cd_contacts (customer_id);

-- ----------------------------------------------------------------------------
-- 3. Delivery addresses
-- ----------------------------------------------------------------------------
create table if not exists cd_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid not null references of_customers(id) on delete cascade,
  nickname text,
  street text,
  suburb text,
  city text,
  province text,
  postal_code text,
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cd_addresses_org on cd_delivery_addresses (org_id);
create index if not exists idx_cd_addresses_customer on cd_delivery_addresses (customer_id);

-- ----------------------------------------------------------------------------
-- 4. Products & services (Core Data) — extend pp_stock_items
--    (category, pack, unit, avg_unit_price, updated_at already exist)
-- ----------------------------------------------------------------------------
alter table pp_stock_items add column if not exists subcategory text;
alter table pp_stock_items add column if not exists sku text;
-- null = org default VAT rate applies
alter table pp_stock_items add column if not exists vat_rate numeric;
alter table pp_stock_items add column if not exists active boolean not null default true;
-- product | service
alter table pp_stock_items add column if not exists kind text not null default 'product';
alter table pp_stock_items add column if not exists notes text;

-- ----------------------------------------------------------------------------
-- 5. Price lists (Core Data) — extend pl_*
--    custom_price is an absolute selling price that wins over margin pricing.
--    valid_from/valid_until duplicate pl-validity.sql (idempotent) so this file
--    is the ONLY migration the OrderFlow v2 build needs.
-- ----------------------------------------------------------------------------
alter table pl_overrides add column if not exists custom_price numeric;
alter table pl_price_lists add column if not exists notes text;
alter table pl_price_lists add column if not exists valid_from date;
alter table pl_price_lists add column if not exists valid_until date;

-- ----------------------------------------------------------------------------
-- 6. Payment terms
-- ----------------------------------------------------------------------------
create table if not exists cd_payment_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  days int not null default 30,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cd_payment_terms_org on cd_payment_terms (org_id);

-- ----------------------------------------------------------------------------
-- 7. VAT / tax settings
-- ----------------------------------------------------------------------------
create table if not exists cd_vat_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  rate numeric not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_cd_vat_rates_org on cd_vat_rates (org_id);

-- ----------------------------------------------------------------------------
-- 8. Company profile (one row per org) — the "from" identity on documents
-- ----------------------------------------------------------------------------
create table if not exists cd_company_profile (
  org_id uuid primary key references organisations(id) on delete cascade,
  company_name text,
  vat_number text,
  registration_number text,
  address text,
  email text,
  phone text,
  -- logo as a base64 data URL (bounded client-side, same pattern as sd_settings)
  logo_data text,
  bank_name text,
  account_name text,
  account_number text,
  branch_code text,
  swift text,
  invoice_footer text,
  terms text,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. Document templates
-- ----------------------------------------------------------------------------
create table if not exists cd_doc_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- invoice | quote | delivery_note | credit_note | statement
  template_type text not null default 'invoice',
  name text not null,
  -- left | right | center
  logo_placement text not null default 'left',
  footer_text text,
  terms text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cd_doc_templates_org on cd_doc_templates (org_id);

-- ----------------------------------------------------------------------------
-- 10. Invoices — a real entity (previously just invoice_number on of_orders)
-- ----------------------------------------------------------------------------
create table if not exists of_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid references of_customers(id) on delete set null,
  order_id uuid references of_orders(id) on delete set null,
  invoice_number text not null,
  -- draft | sent | viewed | partially_paid | paid | overdue | cancelled | credited
  status text not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  vat_rate numeric not null default 15,
  -- absolute discount in rands, applied to the subtotal before VAT
  discount numeric not null default 0,
  customer_po text,
  billing_address text,
  delivery_address text,
  delivery_instructions text,
  notes text,
  terms text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_of_invoices_org on of_invoices (org_id, created_at desc);
create index if not exists idx_of_invoices_customer on of_invoices (customer_id);
create index if not exists idx_of_invoices_order on of_invoices (order_id);

create table if not exists of_invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  invoice_id uuid not null references of_invoices(id) on delete cascade,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  -- required note when the price was manually overridden away from the price list
  override_note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_invoice_items_invoice on of_invoice_items (invoice_id);

-- ----------------------------------------------------------------------------
-- 11. Quotes
-- ----------------------------------------------------------------------------
create table if not exists of_quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid references of_customers(id) on delete set null,
  quote_number text not null,
  -- draft | sent | accepted | rejected | expired
  status text not null default 'draft',
  issue_date date not null default current_date,
  valid_until date,
  vat_rate numeric not null default 15,
  customer_po text,
  delivery_address text,
  notes text,
  converted_order_id uuid references of_orders(id) on delete set null,
  converted_invoice_id uuid references of_invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_of_quotes_org on of_quotes (org_id, created_at desc);
create index if not exists idx_of_quotes_customer on of_quotes (customer_id);

create table if not exists of_quote_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  quote_id uuid not null references of_quotes(id) on delete cascade,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  override_note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_quote_items_quote on of_quote_items (quote_id);

-- ----------------------------------------------------------------------------
-- 12. Orders — extend with delivery, PO, numbering and links
--     (status now also allows: picking | out_for_delivery)
-- ----------------------------------------------------------------------------
alter table of_orders add column if not exists order_number text;
alter table of_orders add column if not exists delivery_address_id uuid references cd_delivery_addresses(id) on delete set null;
-- snapshot of the address text at order time (survives address edits/deletes)
alter table of_orders add column if not exists delivery_address text;
alter table of_orders add column if not exists delivery_instructions text;
alter table of_orders add column if not exists customer_po text;
alter table of_orders add column if not exists delivery_date date;
alter table of_orders add column if not exists quote_id uuid references of_quotes(id) on delete set null;
alter table of_orders add column if not exists invoice_id uuid references of_invoices(id) on delete set null;
alter table of_orders add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 13. Credit notes
-- ----------------------------------------------------------------------------
create table if not exists of_credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  invoice_id uuid references of_invoices(id) on delete set null,
  customer_id uuid references of_customers(id) on delete set null,
  credit_number text not null,
  -- draft | issued
  status text not null default 'issued',
  reason text,
  notes text,
  issue_date date not null default current_date,
  vat_rate numeric not null default 15,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_credit_notes_org on of_credit_notes (org_id, created_at desc);
create index if not exists idx_of_credit_notes_invoice on of_credit_notes (invoice_id);

create table if not exists of_credit_note_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  credit_note_id uuid not null references of_credit_notes(id) on delete cascade,
  invoice_item_id uuid references of_invoice_items(id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_credit_note_items_cn on of_credit_note_items (credit_note_id);

-- ----------------------------------------------------------------------------
-- 14. Delivery notes
-- ----------------------------------------------------------------------------
create table if not exists of_delivery_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  order_id uuid references of_orders(id) on delete set null,
  invoice_id uuid references of_invoices(id) on delete set null,
  customer_id uuid references of_customers(id) on delete set null,
  dn_number text not null,
  -- draft | out_for_delivery | delivered
  status text not null default 'draft',
  delivery_address text,
  instructions text,
  -- placeholder fields for the future Fleet module
  driver_name text,
  vehicle text,
  delivered_at timestamptz,
  signed_by text,
  -- uploaded proof-of-delivery, stored in Doc-U
  pod_document_id uuid references documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_delivery_notes_org on of_delivery_notes (org_id, created_at desc);
create index if not exists idx_of_delivery_notes_order on of_delivery_notes (order_id);

create table if not exists of_delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  delivery_note_id uuid not null references of_delivery_notes(id) on delete cascade,
  name text not null,
  qty numeric not null default 0,
  unit text,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_dn_items_dn on of_delivery_note_items (delivery_note_id);

-- ----------------------------------------------------------------------------
-- 15. Payments
-- ----------------------------------------------------------------------------
create table if not exists of_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  invoice_id uuid not null references of_invoices(id) on delete cascade,
  customer_id uuid references of_customers(id) on delete set null,
  amount numeric not null,
  -- eft | cash | card | other
  method text not null default 'eft',
  paid_on date not null default current_date,
  reference text,
  notes text,
  receipt_document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_payments_org on of_payments (org_id, created_at desc);
create index if not exists idx_of_payments_invoice on of_payments (invoice_id);

-- ----------------------------------------------------------------------------
-- 16. Activity feed (customer timeline + entity history)
-- ----------------------------------------------------------------------------
create table if not exists of_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  actor_email text,
  -- customer | quote | order | invoice | credit_note | delivery_note | payment | price_list | product | document
  entity_type text not null,
  entity_id uuid,
  customer_id uuid,
  -- short machine key, e.g. invoice_created, payment_recorded, status_changed
  event text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_of_activity_org on of_activity (org_id, created_at desc);
create index if not exists idx_of_activity_customer on of_activity (org_id, customer_id, created_at desc);
create index if not exists idx_of_activity_entity on of_activity (org_id, entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 17. OrderFlow settings (numbering + defaults, one row per org)
-- ----------------------------------------------------------------------------
create table if not exists of_settings (
  org_id uuid primary key references organisations(id) on delete cascade,
  invoice_prefix text not null default 'INV-',
  invoice_next int not null default 1,
  quote_prefix text not null default 'QTE-',
  quote_next int not null default 1,
  order_prefix text not null default 'ORD-',
  order_next int not null default 1,
  credit_prefix text not null default 'CN-',
  credit_next int not null default 1,
  dn_prefix text not null default 'DN-',
  dn_next int not null default 1,
  number_pad int not null default 4,
  default_payment_terms_days int not null default 30,
  default_vat_rate numeric not null default 15,
  updated_at timestamptz not null default now()
);

-- Atomic document numbering: increments the caller-org counter and returns the
-- formatted number in one statement, so two parallel creates can never collide.
create or replace function of_next_number(p_kind text)
returns text
language plpgsql
security invoker
as $$
declare
  v_org uuid;
  v_prefix text;
  v_n int;
  v_pad int;
begin
  select p.org_id into v_org from profiles p where p.id = auth.uid();
  if v_org is null then
    raise exception 'no organisation for current user';
  end if;
  insert into of_settings (org_id) values (v_org) on conflict (org_id) do nothing;

  if p_kind = 'invoice' then
    update of_settings set invoice_next = invoice_next + 1, updated_at = now()
      where org_id = v_org returning invoice_prefix, invoice_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'quote' then
    update of_settings set quote_next = quote_next + 1, updated_at = now()
      where org_id = v_org returning quote_prefix, quote_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'order' then
    update of_settings set order_next = order_next + 1, updated_at = now()
      where org_id = v_org returning order_prefix, order_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'credit_note' then
    update of_settings set credit_next = credit_next + 1, updated_at = now()
      where org_id = v_org returning credit_prefix, credit_next - 1, number_pad into v_prefix, v_n, v_pad;
  elsif p_kind = 'delivery_note' then
    update of_settings set dn_next = dn_next + 1, updated_at = now()
      where org_id = v_org returning dn_prefix, dn_next - 1, number_pad into v_prefix, v_n, v_pad;
  else
    raise exception 'unknown numbering kind: %', p_kind;
  end if;

  return v_prefix || lpad(v_n::text, greatest(v_pad, length(v_n::text)), '0');
end;
$$;
grant execute on function of_next_number(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 18. Doc-U linking — attach uploaded documents (PO / POD / receipts) to
--     OrderFlow entities and customers
-- ----------------------------------------------------------------------------
alter table documents add column if not exists entity_type text;
alter table documents add column if not exists entity_id uuid;
alter table documents add column if not exists customer_id uuid references of_customers(id) on delete set null;
create index if not exists idx_documents_entity on documents (entity_type, entity_id);
create index if not exists idx_documents_customer on documents (customer_id);

-- ----------------------------------------------------------------------------
-- 19. Row level security for every new table (same org policy as of_*/pp_*)
-- ----------------------------------------------------------------------------
alter table cd_contacts            enable row level security;
alter table cd_delivery_addresses  enable row level security;
alter table cd_payment_terms       enable row level security;
alter table cd_vat_rates           enable row level security;
alter table cd_company_profile     enable row level security;
alter table cd_doc_templates       enable row level security;
alter table of_invoices            enable row level security;
alter table of_invoice_items       enable row level security;
alter table of_quotes              enable row level security;
alter table of_quote_items         enable row level security;
alter table of_credit_notes        enable row level security;
alter table of_credit_note_items   enable row level security;
alter table of_delivery_notes      enable row level security;
alter table of_delivery_note_items enable row level security;
alter table of_payments            enable row level security;
alter table of_activity            enable row level security;
alter table of_settings            enable row level security;

drop policy if exists cd_contacts_all            on cd_contacts;
drop policy if exists cd_delivery_addresses_all  on cd_delivery_addresses;
drop policy if exists cd_payment_terms_all       on cd_payment_terms;
drop policy if exists cd_vat_rates_all           on cd_vat_rates;
drop policy if exists cd_company_profile_all     on cd_company_profile;
drop policy if exists cd_doc_templates_all       on cd_doc_templates;
drop policy if exists of_invoices_all            on of_invoices;
drop policy if exists of_invoice_items_all       on of_invoice_items;
drop policy if exists of_quotes_all              on of_quotes;
drop policy if exists of_quote_items_all         on of_quote_items;
drop policy if exists of_credit_notes_all        on of_credit_notes;
drop policy if exists of_credit_note_items_all   on of_credit_note_items;
drop policy if exists of_delivery_notes_all      on of_delivery_notes;
drop policy if exists of_delivery_note_items_all on of_delivery_note_items;
drop policy if exists of_payments_all            on of_payments;
drop policy if exists of_activity_all            on of_activity;
drop policy if exists of_settings_all            on of_settings;

create policy cd_contacts_all on cd_contacts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy cd_delivery_addresses_all on cd_delivery_addresses for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy cd_payment_terms_all on cd_payment_terms for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy cd_vat_rates_all on cd_vat_rates for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy cd_company_profile_all on cd_company_profile for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy cd_doc_templates_all on cd_doc_templates for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoices_all on of_invoices for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_invoice_items_all on of_invoice_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_quotes_all on of_quotes for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_quote_items_all on of_quote_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_credit_notes_all on of_credit_notes for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_credit_note_items_all on of_credit_note_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_delivery_notes_all on of_delivery_notes for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_delivery_note_items_all on of_delivery_note_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_payments_all on of_payments for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_activity_all on of_activity for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
create policy of_settings_all on of_settings for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 20. Backfill — promote legacy "invoiced orders" into real of_invoices rows
--     (one invoice per order that already carries an invoice_number)
-- ----------------------------------------------------------------------------
insert into of_invoices (org_id, customer_id, order_id, invoice_number, status, issue_date, created_at)
select o.org_id, o.customer_id, o.id, o.invoice_number,
       case o.status when 'paid' then 'paid' when 'partially_paid' then 'partially_paid' else 'sent' end,
       o.created_at::date, o.created_at
from of_orders o
where o.invoice_number is not null
  and not exists (select 1 from of_invoices i where i.order_id = o.id);

insert into of_invoice_items (org_id, invoice_id, stock_item_id, name, qty, unit, unit_price)
select oi.org_id, i.id, oi.stock_item_id, oi.name, oi.qty, oi.unit, oi.unit_price
from of_invoices i
join of_order_items oi on oi.order_id = i.order_id
where not exists (select 1 from of_invoice_items x where x.invoice_id = i.id);

update of_orders o set invoice_id = i.id
from of_invoices i
where i.order_id = o.id and o.invoice_id is null;

-- Seed numbering above any legacy invoice numbers so new invoices never collide.
insert into of_settings (org_id)
select distinct org_id from of_orders
on conflict (org_id) do nothing;

update of_settings s
set invoice_next = greatest(s.invoice_next, coalesce((
  select max((regexp_match(o.invoice_number, '(\d+)\s*$'))[1]::int) + 1
  from of_orders o
  where o.org_id = s.org_id and o.invoice_number ~ '\d'
), 1));

-- ----------------------------------------------------------------------------
-- 21. Sensible defaults per org — payment terms + VAT rates (skip orgs that
--     already have their own)
-- ----------------------------------------------------------------------------
insert into cd_payment_terms (org_id, name, days, description, is_default)
select o.id, t.name, t.days, t.description, t.is_default
from organisations o
cross join (values
  ('Cash on delivery', 0,  'Payment due on delivery', false),
  ('7 days',           7,  null,                      false),
  ('14 days',          14, null,                      false),
  ('30 days',          30, 'Standard account terms',  true)
) as t(name, days, description, is_default)
where not exists (select 1 from cd_payment_terms x where x.org_id = o.id);

insert into cd_vat_rates (org_id, name, rate, description, active)
select o.id, t.name, t.rate, t.description, true
from organisations o
cross join (values
  ('Standard rate', 15::numeric, 'Standard South African VAT'),
  ('Zero-rated',    0::numeric,  'Zero-rated supplies')
) as t(name, rate, description)
where not exists (select 1 from cd_vat_rates x where x.org_id = o.id);
