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
export type DocumentStatus = 'pending' | 'extracted' | 'reviewed' | 'error';
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

/** A single line item from a statement/invoice table (qty/price/amount). */
export interface ExtractedLineItem {
  reference?: string;
  description: string;
  quantity?: string;
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
  filename: string;
  document_type: DocumentType | null;
  status: DocumentStatus;
  confidence: number | null;
  extracted_data: ExtractedData | null;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Document joined with a thin supplier projection — used by list/table views. */
export interface DocumentWithSupplier extends Document {
  supplier: Pick<Supplier, 'id' | 'name' | 'initials'> | null;
}
