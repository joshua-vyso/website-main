/**
 * Smart flagging engine (feature 4). REAL flags derive from real document data;
 * a few illustrative heuristics are marked `source: 'mock'`.
 */
import { DOC_LOW_CONFIDENCE_THRESHOLD } from '@/lib/platform/tokens';
import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { DocumentFlag, FlagKind, FlagSeverity } from './types';
import { docTotal, findFieldValue } from './extract';

export const FLAG_META: Record<FlagKind, { label: string; severity: FlagSeverity }> = {
  duplicate_invoice: { label: 'Duplicate invoice', severity: 'critical' },
  price_spike: { label: 'Price spike', severity: 'warning' },
  missing_delivery_note: { label: 'Missing delivery note', severity: 'warning' },
  credit_note: { label: 'Credit note detected', severity: 'info' },
  unusual_spend: { label: 'Unusual spend', severity: 'warning' },
  unknown_supplier: { label: 'Unknown supplier', severity: 'warning' },
  low_confidence: { label: 'Low extraction confidence', severity: 'warning' },
};

export const FLAG_SEVERITY_COLOR: Record<FlagSeverity, { bg: string; fg: string }> = {
  critical: { bg: '#FCEBEB', fg: '#A32D2D' },
  warning: { bg: '#FBEEDA', fg: '#854F0B' },
  info: { bg: '#E6F1FB', fg: '#0C447C' },
};

const INVOICE_LABELS = ['invoice #', 'invoice no', 'invoice number', 'document #', 'reference'];

/** Compute flags for `doc` against the rest of the org's documents. */
export function deriveFlags(
  doc: DocumentWithSupplier,
  orgDocs: DocumentWithSupplier[] = [],
): DocumentFlag[] {
  const flags: DocumentFlag[] = [];
  const add = (kind: FlagKind, detail: string, source: 'derived' | 'mock') =>
    flags.push({ kind, severity: FLAG_META[kind].severity, label: FLAG_META[kind].label, detail, source });

  // REAL — low extraction confidence
  if (typeof doc.confidence === 'number' && doc.confidence < DOC_LOW_CONFIDENCE_THRESHOLD) {
    add('low_confidence', `Overall confidence ${Math.round(doc.confidence)}% — manual review recommended.`, 'derived');
  }

  // REAL — unknown supplier
  if (!doc.supplier_id && !doc.supplier) {
    add('unknown_supplier', 'No supplier is matched to this document yet.', 'derived');
  }

  // REAL — duplicate invoice (same supplier + same invoice number across the org)
  const invNo = findFieldValue(doc, ...INVOICE_LABELS);
  if (invNo) {
    const dup = orgDocs.some(
      (o) =>
        o.id !== doc.id &&
        o.supplier_id === doc.supplier_id &&
        findFieldValue(o, ...INVOICE_LABELS) === invNo,
    );
    if (dup) add('duplicate_invoice', `Invoice ${invNo} also appears on another document.`, 'derived');
  }

  // REAL-ish — credit note keyword
  const hay = (
    doc.filename +
    ' ' +
    (doc.extracted_data?.fields ?? []).map((f) => f.value).join(' ') +
    ' ' +
    (doc.extracted_data?.line_items ?? []).map((l) => l.description).join(' ')
  ).toLowerCase();
  if (/\bcredit\b/.test(hay)) {
    add('credit_note', 'Document references a credit — confirm it offsets a prior invoice.', 'derived');
  }

  // HEURISTIC / illustrative
  const total = docTotal(doc);
  if (total != null && total > 12000) {
    add('unusual_spend', `Total of R ${Math.round(total).toLocaleString('en-ZA')} is above the usual range for this supplier.`, 'mock');
  }
  if (doc.document_type === 'statement') {
    add('missing_delivery_note', '2 line items have no matching delivery note on file.', 'mock');
  }
  if (doc.document_type === 'invoice' && /butternut|tomato|onion|banana/.test(hay)) {
    add('price_spike', 'A unit price is up ~14% versus last month.', 'mock');
  }

  return flags;
}
