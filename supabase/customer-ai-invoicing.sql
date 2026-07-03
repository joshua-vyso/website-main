-- ============================================================================
-- Per-customer AI invoicing parameters + order-name mappings
-- ----------------------------------------------------------------------------
-- Personalised, customizable settings on each customer that steer how an
-- uploaded customer order (Doc-U) is rectified into a Turn 'n Slice invoice:
-- how their coded/misspelled item names map to the catalogue, which price and
-- VAT treatment to apply, and how the invoice reads. Consumed by
-- lib/platform/orderflow-from-doc.ts (syncOrderFromDocument) and the classic
-- invoice template.
--
-- REQUIRES orderflow-schema.sql + core-data.sql to have run first (extends
-- of_customers, references pp_stock_items). Idempotent — safe to re-run.
-- Paste into the Supabase dashboard SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Per-customer AI invoicing parameters (on of_customers)
-- ----------------------------------------------------------------------------
-- The account code this seller uses for the customer, e.g. "BAK001".
alter table of_customers add column if not exists account_code text;
-- zero_rated | standard | exempt  (fresh produce is zero-rated in SA)
alter table of_customers add column if not exists vat_treatment text not null default 'zero_rated';
-- price_list | order_prices — where the invoice price comes from. Turn 'n Slice
-- re-prices every line from their own list, so default to price_list.
alter table of_customers add column if not exists invoice_price_basis text not null default 'price_list';
-- auto | bulk | order_unit — which quantity to bill when an order carries both.
alter table of_customers add column if not exists invoice_quantity_basis text not null default 'auto';
-- Strip category prefixes like "FF - ", "VEG - ", "PSAL - " from order names
-- before matching to the catalogue.
alter table of_customers add column if not exists strip_order_prefixes boolean not null default true;
-- Customer-match confidence (0-100) at/above which an uploaded order auto-invoices.
alter table of_customers add column if not exists ai_auto_invoice_confidence int not null default 80;
-- Auto-invoice even when some lines couldn't be priced (else it holds for review).
alter table of_customers add column if not exists ai_allow_unpriced boolean not null default false;
-- Override the org default payment terms for this customer's invoices (null = default).
alter table of_customers add column if not exists invoice_terms_days_override int;
-- Free-text "Terms:" line printed on the invoice (e.g. "30 days", "COD").
alter table of_customers add column if not exists invoice_terms_text text;
-- A standing note printed on every invoice for this customer.
alter table of_customers add column if not exists invoice_note text;
-- Free-form natural-language rules for the AI generator: how this customer
-- orders and how to rectify it. The mapping table below operationalises the
-- exact renames; this captures the fuzzy rules.
alter table of_customers add column if not exists ai_invoice_instructions text;

-- ----------------------------------------------------------------------------
-- 2. Per-customer order-name → catalogue mappings
-- ----------------------------------------------------------------------------
-- One row per quirky name a customer uses. raw_name is what appears on their
-- order ("FF - NAARTJIES Box"); it resolves to a catalogue item and an optional
-- clean invoice name + billing unit ("Naartjies", "box").
create table if not exists cd_customer_item_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid not null references of_customers(id) on delete cascade,
  raw_name text not null,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  -- Clean name to print on the invoice (falls back to the catalogue item name).
  invoice_name text,
  -- Billing unit shown on the invoice, e.g. "box", "pkt", "pun", "ea", "kg".
  unit text,
  -- auto | bulk | order_unit — per-alias quantity basis (overrides the customer default).
  quantity_basis text,
  created_at timestamptz not null default now(),
  unique (org_id, customer_id, raw_name)
);
create index if not exists idx_cd_customer_item_aliases_customer
  on cd_customer_item_aliases (org_id, customer_id);

alter table cd_customer_item_aliases enable row level security;
drop policy if exists cd_customer_item_aliases_all on cd_customer_item_aliases;
create policy cd_customer_item_aliases_all on cd_customer_item_aliases for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
