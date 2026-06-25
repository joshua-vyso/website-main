-- Custom units of measurement per org. Backs the "Units of measurement" section
-- in ProcurePulse → Settings and the typeable unit dropdown on the Products page.
-- Idempotent. Paste into the Supabase dashboard SQL editor and run once.

ALTER TABLE pp_settings ADD COLUMN IF NOT EXISTS custom_units text[] DEFAULT '{}';
