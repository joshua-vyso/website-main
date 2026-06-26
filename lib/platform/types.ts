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

/** A supplier's latest price for a stock item (`pp_item_suppliers`). */
export interface ItemSupplierPrice {
  id: string;
  org_id: string;
  stock_item_id: string;
  supplier_name: string;
  price: number;
  created_at: string;
}

/** A received/used stock movement (`pp_movements`). */
export interface StockMovement {
  id: string;
  org_id: string;
  stock_item_id: string;
  change: number;
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
