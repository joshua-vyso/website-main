-- PricePilot customer pricing — validity window on price lists.
-- A price list with a customer_id is that customer's contract/negotiated pricing;
-- valid_from/valid_until bound when it applies and drive expiry reminders.
-- Additive + idempotent. RLS already covers pl_price_lists.

alter table pl_price_lists add column if not exists valid_from date;
alter table pl_price_lists add column if not exists valid_until date;
