-- Per-unit weight in kilograms for each stock item, derived by the Doc-U feed
-- as a weighted average across feeding lines: Σ(qty·weight) / Σ(qty) (equivalently
-- Σ total_kg / Σ qty). Nullable — items with no weight data read "—" in the UI.
--
-- "Stock on hand (kg)" is DERIVED on read as on_hand × kg_per_unit, never stored
-- separately, so it stays consistent as units sell down (no second write to drift).
--
-- Idempotent. Paste into the Supabase dashboard → SQL editor and run once.
-- RLS is unchanged (the existing pp_stock_items policy is column-agnostic).
ALTER TABLE pp_stock_items ADD COLUMN IF NOT EXISTS kg_per_unit numeric;
