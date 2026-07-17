-- Vyso performance indexes
-- ---------------------------------------------------------------------------
-- Postgres does NOT auto-index foreign keys, so the predicates the app filters
-- on every document delete / feed / list were doing full sequential table
-- scans. These indexes turn them into O(log n) lookups. All are idempotent
-- (IF NOT EXISTS) and safe to run repeatedly.
--
-- HOW TO APPLY: paste this whole file into the Supabase dashboard SQL editor
-- (project ronanesmpfhxhvjytfvi) and run it once. No data is modified.
-- ---------------------------------------------------------------------------

-- ProcurePulse movements — filtered by source_document_id on every delete/feed
-- and by stock_item_id on every orphan check. The single biggest deletion win.
CREATE INDEX IF NOT EXISTS idx_pp_movements_source_document_id ON pp_movements (source_document_id);
CREATE INDEX IF NOT EXISTS idx_pp_movements_stock_item_id     ON pp_movements (stock_item_id);

-- Document lists — every Doc-U screen filters by org_id and orders by
-- created_at; awaiting/flagged also filter by status.
CREATE INDEX IF NOT EXISTS idx_documents_org_created        ON documents (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_org_status_created ON documents (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_supplier_id        ON documents (supplier_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id          ON documents (folder_id);

-- Feature gate — read on literally every authenticated page render.
CREATE INDEX IF NOT EXISTS idx_org_features_org_feature ON org_features (org_id, feature_key);

-- ProcurePulse stock + supplier-price lookups (feed path).
CREATE INDEX IF NOT EXISTS idx_pp_stock_items_org_id           ON pp_stock_items (org_id);
CREATE INDEX IF NOT EXISTS idx_pp_item_suppliers_stock_item_id ON pp_item_suppliers (stock_item_id);

-- of_order_items is the fastest-growing table and PricePilot/analytics all filter it by
-- org_id, but the only existing index is on order_id — so those queries seq-scan. The
-- composite also serves the frequent (org_id, stock_item_id) product rollups.
-- In production add CONCURRENTLY (a plain build briefly locks the table):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_of_order_items_org ON of_order_items (org_id, stock_item_id);
CREATE INDEX IF NOT EXISTS idx_of_order_items_org ON of_order_items (org_id, stock_item_id);
