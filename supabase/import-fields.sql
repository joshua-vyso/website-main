-- ============================================================================
-- Core Data fields for the QuickBooks customer/product import
-- ----------------------------------------------------------------------------
-- Flat, editable fields on of_customers matching the QuickBooks Customer List
-- columns that don't already have a home, plus a purchase-cost on products.
-- (Contacts/ship-to land as plain text fields for now — editable in the profile;
-- the cd_contacts / cd_delivery_addresses tables exist if richer records are
-- wanted later.) Idempotent. Paste in the Supabase SQL editor.
-- ============================================================================

-- Customers (of_customers)
alter table of_customers add column if not exists delivery_address text;   -- Ship to 1–5 (joined)
alter table of_customers add column if not exists contact_name text;       -- First + Last Name
alter table of_customers add column if not exists contact_title text;       -- Job Title
alter table of_customers add column if not exists alt_phone text;           -- Alt. Phone
alter table of_customers add column if not exists fax text;                 -- Fax
alter table of_customers add column if not exists opening_balance numeric;  -- Balance (ZAR)
alter table of_customers add column if not exists currency text default 'ZAR';

-- Products (pp_stock_items) — purchase cost (Price already → avg_unit_price).
alter table pp_stock_items add column if not exists cost numeric;
