/**
 * Doc-U intelligence types — the contract for the detail-panel features
 * (flags, relationships, activity, AI summary, supplier intelligence, routing,
 * confidence breakdown, workflow, smart search). Web-only; not mirrored.
 *
 * `source: 'derived' | 'mock'` on the intelligence shapes records whether a
 * value comes from real document data or is illustrative until a backend lands.
 */
import type { DocumentStatus, DocumentType, ExtractedData, FeatureKey } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Statement totals (TRANSACTION SUMMARY) — parsed from a statement's footer and
// cached in extracted_data.summary. Powers the totals card + reconciliation CSV.
// ---------------------------------------------------------------------------
export interface StatementSummary {
  /** Statement date as printed (e.g. "23/MAY/2026") or ISO if resolvable. */
  statement_date: string | null;
  opening_balance: number | null;
  payments: number | null;
  total_purchases: number | null;
  total_pallet_refunds: number | null;
  total_pallet_usage: number | null;
  vat: number | null;
  total_charges: number | null;
  closing_balance: number | null;
  net_financial_transactions: number | null;
  audit_error: number | null;
}

/**
 * Web-only view over documents.extracted_data that also carries the user-set
 * custom type and the parsed statement summary (both stored in the same jsonb,
 * so no schema change / mirror edit is needed).
 */
export interface DocuExtractedData extends ExtractedData {
  custom_type?: string;
  summary?: StatementSummary | null;
}

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
// A short (≤500 char) operational briefing plus two at-a-glance metadata chips.
// ---------------------------------------------------------------------------
export interface AiSummary {
  /** The briefing — capped at 500 characters server-side. */
  text: string;
  total_spend: string | null;
  supplier: string | null;
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
