-- Enable OrderFlow + PricePilot for your workspace so they light up in the
-- sidebar (the module registry already marks them active in code).
-- Change the org name on the WHERE line to whichever workspace you log in as.
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run once.

-- 0. Widen the feature_key CHECK constraint to the full current module list.
--    (The original constraint predates orderflow/pricepilot, so it rejects them.)
ALTER TABLE org_features DROP CONSTRAINT IF EXISTS org_features_feature_key_check;
ALTER TABLE org_features ADD CONSTRAINT org_features_feature_key_check
  CHECK (feature_key IN (
    'docu', 'procurepulse', 'pricepilot', 'marginview', 'wastelog',
    'shiftboard', 'suppliers', 'orderflow', 'reportgen'
  ));

-- 1. Flip any existing (disabled) rows on.
UPDATE org_features
SET enabled = true
WHERE feature_key IN ('orderflow', 'pricepilot')
  AND org_id = (SELECT id FROM organisations WHERE name = 'Turn ''n Slice' LIMIT 1);

-- 2. Insert the rows that don't exist yet.
INSERT INTO org_features (org_id, feature_key, enabled)
SELECT o.id, f.k, true
FROM (SELECT id FROM organisations WHERE name = 'Turn ''n Slice' LIMIT 1) o
CROSS JOIN (VALUES ('orderflow'), ('pricepilot')) AS f(k)
WHERE NOT EXISTS (
  SELECT 1 FROM org_features e WHERE e.org_id = o.id AND e.feature_key = f.k
);
