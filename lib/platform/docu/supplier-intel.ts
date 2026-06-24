/**
 * Supplier intelligence (feature 12). Derived from the org's own documents for
 * the document's supplier — totals, recency, spend, confidence, linked modules.
 */
import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { SupplierIntelligence } from './types';
import { docTotal } from './extract';
import { deriveFlags } from './flags';
import { getRoutes } from './routing';

/** Documents belonging to a supplier (by id, falling back to joined name). */
function forSupplier(
  orgDocs: DocumentWithSupplier[],
  supplierId: string | null,
  name: string,
): DocumentWithSupplier[] {
  return orgDocs.filter((d) =>
    supplierId ? d.supplier_id === supplierId : d.supplier?.name === name,
  );
}

export function deriveSupplierIntelligence(
  supplierId: string | null,
  name: string,
  orgDocs: DocumentWithSupplier[],
): SupplierIntelligence {
  const docs = forSupplier(orgDocs, supplierId, name);

  const confidences = docs
    .map((d) => d.confidence)
    .filter((c): c is number => typeof c === 'number');
  const avgConfidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length)
      : null;

  const totalSpend = docs.reduce((s, d) => s + (docTotal(d) ?? 0), 0);
  const months = new Set(docs.map((d) => (d.created_at ?? '').slice(0, 7)).filter(Boolean));
  const avgMonthlySpend = months.size > 0 ? Math.round(totalSpend / months.size) : totalSpend || null;

  const lastReceived =
    docs.map((d) => d.created_at).filter(Boolean).sort().slice(-1)[0] ?? null;

  const flagged = docs.filter((d) => deriveFlags(d, orgDocs).length > 0).length;

  const moduleKeys = new Set(
    docs.flatMap((d) => getRoutes(d.document_type).filter((r) => r.recommended).map((r) => r.key)),
  );

  return {
    supplierId,
    name,
    totalDocuments: docs.length,
    avgMonthlySpend,
    lastReceived,
    flaggedDiscrepancies: flagged,
    avgConfidence,
    linkedModules: [...moduleKeys],
  };
}
