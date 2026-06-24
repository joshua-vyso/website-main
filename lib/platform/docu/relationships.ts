/**
 * Document relationships (feature 5) — the operational chain
 * Order → Delivery note → Invoice → Statement. Mock until real linkage lands.
 */
import type { DocumentType, DocumentWithSupplier } from '@/lib/platform/types';
import type { DocumentRelationship, RelationStage } from './types';

const STAGES: { stage: RelationStage; label: string; type: DocumentType }[] = [
  { stage: 'order', label: 'Purchase order', type: 'order' },
  { stage: 'delivery_note', label: 'Delivery note', type: 'delivery_note' },
  { stage: 'invoice', label: 'Invoice', type: 'invoice' },
  { stage: 'statement', label: 'Statement', type: 'statement' },
];

/** Map a document's type onto its stage in the chain. */
function stageOf(type: DocumentType | null): RelationStage | null {
  const hit = STAGES.find((s) => s.type === type);
  return hit?.stage ?? null;
}

/**
 * Build the chain for a document. The doc's own stage is `current`; earlier
 * stages are shown `present` and later stages `missing` (mock heuristic).
 */
export function getRelationshipFlow(doc: DocumentWithSupplier): DocumentRelationship[] {
  const current = stageOf(doc.document_type);
  const currentIdx = STAGES.findIndex((s) => s.stage === current);

  return STAGES.map((s, i) => {
    let state: DocumentRelationship['state'] = 'present';
    if (current && s.stage === current) state = 'current';
    else if (currentIdx === -1) state = i < 2 ? 'present' : 'missing';
    else if (i > currentIdx) state = 'missing';
    return {
      stage: s.stage,
      documentId: s.stage === current ? doc.id : null,
      label: s.label,
      state,
    };
  });
}
