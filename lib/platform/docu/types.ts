/**
 * Doc-U intelligence types — the contract for the detail-panel features
 * (flags, relationships, activity, AI summary, supplier intelligence, routing,
 * confidence breakdown, workflow, smart search). Web-only; not mirrored.
 *
 * `source: 'derived' | 'mock'` on the intelligence shapes records whether a
 * value comes from real document data or is illustrative until a backend lands.
 */
import type { DocumentStatus, DocumentType, FeatureKey } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Flags (feature 4)
// ---------------------------------------------------------------------------
export type FlagKind =
  | 'duplicate_invoice'
  | 'price_spike'
  | 'missing_delivery_note'
  | 'credit_note'
  | 'unusual_spend'
  | 'unknown_supplier'
  | 'low_confidence';

export type FlagSeverity = 'info' | 'warning' | 'critical';

export interface DocumentFlag {
  kind: FlagKind;
  severity: FlagSeverity;
  label: string;
  detail: string;
  source: 'derived' | 'mock';
}

// ---------------------------------------------------------------------------
// Relationships (feature 5) — mock chain PO → Delivery → Invoice → Statement
// ---------------------------------------------------------------------------
export type RelationStage = 'order' | 'delivery_note' | 'invoice' | 'statement';

export interface DocumentRelationship {
  stage: RelationStage;
  documentId: string | null;
  label: string;
  state: 'present' | 'missing' | 'current';
}

// ---------------------------------------------------------------------------
// Activity timeline (feature 7)
// ---------------------------------------------------------------------------
export type ActivityKind =
  | 'uploaded'
  | 'extracted'
  | 'supplier_matched'
  | 'flags_detected'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface ActivityEvent {
  kind: ActivityKind;
  at: string | null;
  label: string;
  actor?: string | null;
  source: 'derived' | 'mock';
}

// ---------------------------------------------------------------------------
// AI summary (feature 1) — cached on documents.ai_summary
// ---------------------------------------------------------------------------
export interface AiSummaryPriceMovement {
  label: string;
  direction: 'up' | 'down' | 'flat';
  detail: string;
}

export interface AiSummaryLinkedDoc {
  id?: string;
  label: string;
  relation: string;
}

export interface AiSummary {
  headline: string;
  total_spend: string | null;
  supplier: string | null;
  key_categories: string[];
  price_movements: AiSummaryPriceMovement[];
  discrepancies: string[];
  suggested_actions: string[];
  linked_documents: AiSummaryLinkedDoc[];
  generated_at: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Supplier intelligence (feature 12) — derived from the org's own documents
// ---------------------------------------------------------------------------
export interface SupplierIntelligence {
  supplierId: string | null;
  name: string;
  totalDocuments: number;
  avgMonthlySpend: number | null;
  lastReceived: string | null;
  flaggedDiscrepancies: number;
  avgConfidence: number | null;
  linkedModules: FeatureKey[];
}

// ---------------------------------------------------------------------------
// Supplier auto-matching (feature 2)
// ---------------------------------------------------------------------------
export interface SupplierMatch {
  /** The canonical supplier name resolved from a raw/alias string. */
  canonical: string | null;
  /** Match confidence 0–100. */
  confidence: number;
  /** True when the name was inferred (not an exact existing supplier). */
  matched: boolean;
  /** The raw value the match was derived from. */
  raw: string | null;
}

// ---------------------------------------------------------------------------
// Routing (feature 10)
// ---------------------------------------------------------------------------
export interface ModuleRoute {
  key: FeatureKey;
  label: string;
  reason: string;
  recommended: boolean;
}

// ---------------------------------------------------------------------------
// Confidence breakdown (feature 3) — derived from extracted_data.fields[]
// ---------------------------------------------------------------------------
export type ConfidenceCategoryKey =
  | 'supplier'
  | 'invoice_number'
  | 'date'
  | 'total_amount'
  | 'line_items'
  | 'vat_tax'
  | 'document_type';

export interface ConfidenceCategory {
  key: ConfidenceCategoryKey;
  label: string;
  confidence: number | null;
  isLow: boolean;
  source: 'derived' | 'fallback';
}

// ---------------------------------------------------------------------------
// Approval workflow (feature 6)
// ---------------------------------------------------------------------------
export type WorkflowAction = 'review' | 'approve' | 'reject' | 'archive';

export interface WorkflowTransition {
  action: WorkflowAction;
  toStatus: DocumentStatus;
  label: string;
  /** Visual emphasis: primary CTA vs secondary. */
  primary: boolean;
  /** Whether this action is legal from the current status. */
  available: boolean;
}

// ---------------------------------------------------------------------------
// Missing-document detection (feature 11) — mock
// ---------------------------------------------------------------------------
export interface MissingDocInsight {
  id: string;
  title: string;
  detail: string;
  severity: FlagSeverity;
}

// ---------------------------------------------------------------------------
// Smart search (feature 8) — structured for later semantic search
// ---------------------------------------------------------------------------
export interface ParsedSearch {
  text: string;
  supplier?: string;
  docType?: DocumentType;
  minAmount?: number;
  flag?: FlagKind;
  dateFrom?: string;
  dateTo?: string;
}
