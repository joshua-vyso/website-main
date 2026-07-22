'use client';

import { getRelationshipFlow } from '@/lib/platform/docu/relationships';
import type { DocumentRelationship } from '@/lib/platform/docu/types';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Visualises the operational chain Order → Delivery → Invoice → Statement.
 * The document's own stage reads as `current`; earlier stages `present`,
 * later stages `missing` (dashed). A muted line summarises any gaps.
 */
export function DocumentRelationshipFlow({ doc }: { doc: DocumentWithSupplier }) {
  const stages = getRelationshipFlow(doc);
  const missing = stages.filter((s) => s.state === 'missing');

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Document flow</h3>
      <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Order → Delivery → Invoice → Statement</p>

      <div className="mt-4 flex flex-wrap items-center gap-y-3">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1] : null;
          const connectorDashed = !!prev && (prev.state === 'missing' || stage.state === 'missing');
          return (
            <div key={stage.stage} className="flex items-center">
              {prev ? (
                <span
                  aria-hidden
                  className="mx-2 h-px w-6 shrink-0 border-t"
                  style={{
                    borderColor: '#E7E7E2',
                    borderStyle: connectorDashed ? 'dashed' : 'solid',
                  }}
                />
              ) : null}
              <StageNode stage={stage} />
            </div>
          );
        })}
      </div>

      {missing.length > 0 ? (
        <p className="mt-3 text-[12px] text-[#5F6368]">{missingSummary(missing)}</p>
      ) : null}
    </div>
  );
}

function StageNode({ stage }: { stage: DocumentRelationship }) {
  const className =
    stage.state === 'current'
      ? 'rounded-xl border border-[#3E7BC4]/30 bg-[#EAF2FC] px-3 py-2 text-[12px] font-medium text-[#1F5FA8]'
      : stage.state === 'present'
        ? 'rounded-xl border border-[#E7E7E2] bg-white px-3 py-2 text-[12px] text-[#1A1C1E]'
        : 'rounded-xl border border-dashed border-[#E7E7E2] px-3 py-2 text-[12px] text-[#9A9DA1]';

  return <span className={className}>{stage.label}</span>;
}

function missingSummary(missing: DocumentRelationship[]): string {
  const labels = missing.map((s) => s.label);
  if (labels.length === 1) return `${labels[0]} not yet received.`;
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(', ')} and ${last} not yet received.`;
}
