/**
 * Field-level confidence breakdown (feature 3). Real — maps the per-field
 * confidences already stored in extracted_data into the 7 canonical categories.
 */
import { FIELD_REVIEW_THRESHOLD } from '@/lib/platform/tokens';
import type { Document } from '@/lib/platform/types';
import type { ConfidenceCategory, ConfidenceCategoryKey } from './types';
import { findFieldConfidence } from './extract';

const CATEGORY_LABELS: Record<ConfidenceCategoryKey, string> = {
  supplier: 'Supplier',
  invoice_number: 'Invoice number',
  date: 'Date',
  total_amount: 'Total amount',
  line_items: 'Line items',
  vat_tax: 'VAT / tax',
  document_type: 'Document type',
};

export function deriveConfidenceCategories(doc: Document): ConfidenceCategory[] {
  const lines = doc.extracted_data?.line_items ?? [];
  const lineAvg =
    lines.length > 0
      ? Math.round(lines.reduce((s, l) => s + (l.confidence ?? 0), 0) / lines.length)
      : null;

  const raw: Record<ConfidenceCategoryKey, number | null> = {
    supplier: findFieldConfidence(doc, 'supplier'),
    invoice_number: findFieldConfidence(doc, 'invoice', 'document #', 'reference'),
    date: findFieldConfidence(doc, 'date', 'effective'),
    total_amount: findFieldConfidence(doc, 'total', 'amount'),
    line_items: lineAvg,
    vat_tax: findFieldConfidence(doc, 'vat', 'tax'),
    document_type: typeof doc.confidence === 'number' ? Math.round(doc.confidence) : null,
  };

  return (Object.keys(CATEGORY_LABELS) as ConfidenceCategoryKey[]).map((key) => {
    const confidence = raw[key];
    return {
      key,
      label: CATEGORY_LABELS[key],
      confidence,
      isLow: confidence != null && confidence < FIELD_REVIEW_THRESHOLD,
      source: confidence != null ? 'derived' : 'fallback',
    };
  });
}
