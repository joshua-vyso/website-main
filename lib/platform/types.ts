/**
 * Canonical TypeScript types for the Vyso platform.
 *
 * This file is the single source of truth for the data model and is mirrored
 * into each app (`website/lib/platform/types.ts`, `mobile/lib/types.ts`). Keep
 * the copies byte-identical — only edit this canonical version and re-copy.
 */

/** Every feature-gateable module. Matches `org_features.feature_key`. */
export type FeatureKey =
  | 'docu'
  | 'procurepulse'
  | 'pricepilot'
  | 'marginview'
  | 'wastelog'
  | 'shiftboard'
  | 'orderflow'
  | 'reportgen'
  | 'suppliers';

/** Whether a module is live or marketed as upcoming. */
export type ModuleStatus = 'active' | 'soon';

/** The AppIcon master assets exported from Figma (`/assets/icons/*.svg`). */
export type AppIconKey =
  | 'docu'
  | 'proc'
  | 'margin'
  | 'waste'
  | 'shift'
  | 'supplier'
  | 'dash';

export type OrgTier = 'start' | 'build' | 'scale';
export type UserRole = 'owner' | 'admin' | 'member';
export type DocumentStatus =
  | 'pending'
  | 'extracted'
  | 'reviewed'
  | 'error'
  | 'approved'
  | 'rejected'
  | 'archived';
export type DocumentType =
  | 'invoice'
  | 'statement'
  | 'delivery_note'
  | 'price_list'
  | 'order';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  tier: OrgTier;
  created_at: string;
}

export interface OrgFeature {
  id: string;
  org_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string | null;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  initials: string | null;
  location: string | null;
  contact_email: string | null;
  created_at: string;
}

/** A single extracted key/value pair with an OCR/model confidence (0–100). */
export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

/** A single product line from a statement/invoice table. */
export interface ExtractedLineItem {
  reference?: string;
  description: string;
  weight?: string;
  quantity?: string;
  units_per_box?: string;
  /** Total kilograms for the line = weight × quantity (Doc-U computes it). */
  total_kg?: string;
  /** Counting unit the quantity is measured in: boxes / punnets / bags / kg … */
  unit?: string;
  unit_price?: string;
  amount?: string;
  confidence: number;
}

/** The shape stored in `documents.extracted_data` (jsonb). */
export interface ExtractedData {
  fields: ExtractedField[];
  line_items?: ExtractedLineItem[];
}

export interface Document {
  id: string;
  org_id: string;
  supplier_id: string | null;
  folder_id: string | null;
  filename: string;
  document_type: DocumentType | null;
  status: DocumentStatus;
  starred: boolean;
  confidence: number | null;
  extracted_data: ExtractedData | null;
  storage_path: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  /** Cached AI operational summary (typed as AiSummary in lib/platform/docu/types). */
  ai_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Document joined with a thin supplier projection — used by list/table views. */
export interface DocumentWithSupplier extends Document {
  supplier: Pick<Supplier, 'id' | 'name' | 'initials'> | null;
}

/** A user-created folder/category that documents are filed into. */
export interface DocumentFolder {
  id: string;
  org_id: string | null;
  name: string;
  starred: boolean;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ProcurePulse — procurement intelligence (live stock derived from Doc-U)
// ---------------------------------------------------------------------------

/** Live stock status, derived from on-hand vs the low-stock threshold. */
export type StockStatus = 'in_stock' | 'low' | 'out';

export type PpNotificationKind =
  | 'low_stock'
  | 'new_direct_doc'
  | 'new_market_statement'
  | 'price_change'
  | 'reorder';

/** A tracked product and its live level (`pp_stock_items`). */
export interface StockItem {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  /** Pack / weight, e.g. "300g · 12/box". */
  pack: string | null;
  /** Counting unit — boxes / punnets / bunches / units. */
  unit: string;
  on_hand: number;
  low_threshold: number;
  avg_unit_price: number | null;
  /** Weighted avg kilograms per counting unit, derived by the Doc-U feed.
   *  Null when no weight data exists. kg on hand = on_hand × kg_per_unit. */
  kg_per_unit: number | null;
  currency: string;
  /** Signed % change vs last week. */
  trend_pct: number | null;
  cheapest_supplier: string | null;
  /** The Doc-U document that last fed this line. */
  source_document_id: string | null;
  /** Level chart series. */
  stock_history: number[] | null;
  /** Price chart series. */
  price_history: number[] | null;
  updated_at: string;
  created_at: string;
}

/** A manual reorder request the user adds on the Reordering page
 *  (`pp_reorder_requests`). Sits alongside the auto-suggested draft PO. */
export interface ReorderRequest {
  id: string;
  org_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit: string | null;
  supplier: string | null;
  note: string | null;
  /** open | ordered | fulfilled | cancelled */
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A confirmed/dismissed/pending product-name link (`pp_name_aliases`). */
export interface ProductAlias {
  id: string;
  org_id: string;
  raw_name: string;
  normalized_name: string | null;
  suggested_name: string | null;
  custom_name: string | null;
  /** The suggested / confirmed canonical target item. */
  stock_item_id: string | null;
  /** pending | confirmed | dismissed */
  status: string;
  /** exact | ai | manual (Phase 2). */
  method: string | null;
  /** AI confidence 0..100 (Phase 2). */
  confidence: number | null;
  ai_rationale: string | null;
  /** The discovered (fed) item a pending suggestion is FOR (Phase 2). */
  discovered_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A supplier's latest price for a stock item (`pp_item_suppliers`). */
export interface ItemSupplierPrice {
  id: string;
  org_id: string;
  stock_item_id: string;
  supplier_name: string;
  price: number;
  created_at: string;
}

/**
 * The append-only stock-movement vocabulary. Stock intelligence only — there is
 * NO wastage reason here (wastage is a separate Vyso module). Legacy rows may
 * still carry 'received'/'adjustment'; new writes use these typed reasons.
 */
export type MovementReason =
  | 'document_sync'
  | 'manual_adjustment'
  | 'count_adjustment'
  | 'order_received'
  | 'recipe_reserved'
  | 'recipe_consumed'
  | 'transfer';

/** A stock movement (`pp_movements`) — the append-only stock ledger. */
export interface StockMovement {
  id: string;
  org_id: string;
  stock_item_id: string;
  change: number;
  /** A MovementReason for new rows; legacy rows may carry other strings. */
  reason: string | null;
  source_label: string | null;
  source_document_id: string | null;
  occurred_at: string;
  created_at: string;
}

/** A ProcurePulse notification (`pp_notifications`). */
export interface PpNotification {
  id: string;
  org_id: string;
  kind: PpNotificationKind;
  title: string;
  body: string | null;
  stock_item_id: string | null;
  document_id: string | null;
  read: boolean;
  created_at: string;
}

/** Per-org ProcurePulse settings (`pp_settings`). */
export interface PpSettings {
  org_id: string;
  notify_low_stock: boolean;
  notify_direct_docs: boolean;
  notify_market_statements: boolean;
  notify_price_spikes: boolean;
  weekly_summary: boolean;
  default_supplier: string | null;
  quiet_hours: string | null;
  /** Org-defined units of measurement, on top of the built-ins (web-only column). */
  custom_units: string[] | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Stock-intelligence models (ProcurePulse rebuild). All org-scoped via RLS.
// ---------------------------------------------------------------------------

/** How a product is measured/converted across purchase, stock and recipe (`pp_product_units`). */
export interface ProductUnit {
  id: string;
  org_id: string;
  stock_item_id: string;
  purchase_unit: string | null;
  stock_unit: string | null;
  recipe_unit: string | null;
  /** Multiply a purchase unit by this to get stock units. */
  conversion_factor: number | null;
  updated_at: string;
}

/** A reusable unit conversion (`pp_unit_conversions`). */
export interface UnitConversion {
  id: string;
  org_id: string;
  from_unit: string;
  to_unit: string;
  factor: number;
}

/** Stock, freshness + reorder thresholds for a product (`pp_stock_thresholds`). */
export interface StockThreshold {
  id: string;
  org_id: string;
  stock_item_id: string;
  low_threshold: number | null;
  par_level: number | null;
  lead_time_days: number | null;
  freshness_value: number | null;
  /** 'hours' | 'days' */
  freshness_unit: string | null;
  alerts_enabled: boolean;
  notes: string | null;
  updated_at: string;
}

/** A stock replenishment order (`pp_stock_orders`). */
export interface StockOrder {
  id: string;
  org_id: string;
  supplier: string | null;
  /** draft | sent | completed | cancelled */
  status: string;
  total: number | null;
  item_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A line on a stock order (`pp_stock_order_items`). */
export interface StockOrderItem {
  id: string;
  org_id: string;
  order_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
}

/** A production recipe (`pp_recipes`). */
export interface Recipe {
  id: string;
  org_id: string;
  name: string;
  output_product: string | null;
  output_qty: number | null;
  output_unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** An ingredient line of a recipe (`pp_recipe_ingredients`). */
export interface RecipeIngredient {
  id: string;
  org_id: string;
  recipe_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty_per_batch: number;
  unit: string | null;
}

/** A cycle/stock count (`pp_stock_counts`). */
export interface StockCount {
  id: string;
  org_id: string;
  /** open | completed */
  status: string;
  counted_by: string | null;
  counted_at: string | null;
  created_at: string;
}

/** A counted line within a stock count (`pp_stock_count_items`). */
export interface StockCountItem {
  id: string;
  org_id: string;
  count_id: string;
  stock_item_id: string | null;
  product_name: string;
  system_qty: number;
  counted_qty: number;
  variance: number;
}

/** A point-in-time supplier price observation (`pp_supplier_price_history`). */
export interface SupplierPriceHistory {
  id: string;
  org_id: string;
  stock_item_id: string;
  supplier_name: string;
  price: number;
  source_document_id: string | null;
  observed_at: string;
}

/** A ProcurePulse activity event for the dashboard feed (`procurepulse_activity_events`). */
export interface ProcurePulseActivityEvent {
  id: string;
  org_id: string;
  /** document_sync | manual_adjustment | count_adjustment | order_received | recipe_reserved | recipe_consumed | transfer | price_update */
  type: string;
  title: string;
  body: string | null;
  stock_item_id: string | null;
  ref_id: string | null;
  occurred_at: string;
  created_at: string;
}
