/**
 * Missing-document detection (feature 11). Surfaces expected-but-absent related
 * documents. Mock heuristics until real document linkage lands.
 */
import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { MissingDocInsight } from './types';

export function getMissingDocs(doc: DocumentWithSupplier): MissingDocInsight[] {
  const supplier = doc.supplier?.name ?? 'this supplier';
  const out: MissingDocInsight[] = [];

  if (doc.document_type === 'statement') {
    out.push({
      id: 'missing-invoices',
      title: '2 matching invoices missing',
      detail: `This statement from ${supplier} references invoices that aren't in Doc-U yet.`,
      severity: 'warning',
    });
  }
  if (doc.document_type === 'invoice') {
    out.push({
      id: 'missing-delivery',
      title: 'No matching delivery note',
      detail: `No delivery note from ${supplier} is linked to this invoice.`,
      severity: 'info',
    });
  }
  if (doc.document_type === 'delivery_note') {
    out.push({
      id: 'awaiting-invoice',
      title: 'Awaiting invoice',
      detail: `Goods received from ${supplier}; the matching supplier invoice hasn't arrived.`,
      severity: 'info',
    });
  }

  return out;
}
