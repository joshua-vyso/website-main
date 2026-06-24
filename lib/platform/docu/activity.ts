/**
 * Activity timeline (feature 7). Real events come from document timestamps
 * (created_at, updated_at, reviewed_at, approved_at, archived_at); a couple of
 * intermediate steps are synthesized and marked `source: 'mock'`.
 */
import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { ActivityEvent } from './types';

export function deriveActivity(doc: DocumentWithSupplier): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  events.push({
    kind: 'uploaded',
    at: doc.created_at,
    label: `Document uploaded — ${doc.filename}`,
    source: 'derived',
  });

  if (doc.status !== 'pending') {
    events.push({
      kind: 'extracted',
      at: doc.updated_at,
      label:
        typeof doc.confidence === 'number'
          ? `AI extraction completed · ${Math.round(doc.confidence)}% confidence`
          : 'AI extraction completed',
      source: 'derived',
    });
  }

  if (doc.supplier?.name) {
    events.push({
      kind: 'supplier_matched',
      at: doc.updated_at,
      label: `Supplier matched — ${doc.supplier.name}`,
      source: 'mock',
    });
  }

  events.push({ kind: 'flags_detected', at: doc.updated_at, label: 'Risk checks run', source: 'mock' });

  if (doc.reviewed_at) {
    events.push({ kind: 'reviewed', at: doc.reviewed_at, label: 'Marked reviewed', source: 'derived' });
  }
  if (doc.approved_at) {
    const rejected = doc.status === 'rejected';
    events.push({
      kind: rejected ? 'rejected' : 'approved',
      at: doc.approved_at,
      label: rejected ? 'Rejected' : 'Approved',
      source: 'derived',
    });
  }
  if (doc.archived_at) {
    events.push({ kind: 'archived', at: doc.archived_at, label: 'Archived', source: 'derived' });
  }

  return events.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
}
