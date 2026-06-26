-- Link a stock movement to the OrderFlow order that caused it (a sale). We can't
-- reuse source_document_id — that's FK'd to documents — so add a dedicated order_id.
-- Enables order-keyed idempotency + restocking when an order is deleted.
-- Idempotent. Paste in the Supabase SQL editor.

alter table pp_movements add column if not exists order_id uuid;

create index if not exists idx_pp_movements_order_id on pp_movements (order_id);
