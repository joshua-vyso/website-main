-- ============================================================================
-- Customer rebates
-- ----------------------------------------------------------------------------
-- A standing rebate % per customer (set on the OrderFlow → Rebates page) that is
-- snapshotted onto each invoice at creation and deducted from the invoice
-- (off the subtotal, after any discount, before VAT). Idempotent. Paste in the
-- Supabase SQL editor.
-- ============================================================================

-- The customer's current rebate % (null / 0 = none).
alter table of_customers add column if not exists rebate_pct numeric;

-- Snapshot of the rebate applied to a specific invoice (frozen at creation, so
-- changing the customer's rebate later never rewrites past invoices).
alter table of_invoices add column if not exists rebate_pct numeric not null default 0;
