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
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Document flow</h3>
      <p className="mt-0.5 text-[12px] text-[#A0A49C]">Order → Delivery → Invoice → Statement</p>

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
                    borderColor: '#EAEDF2',
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
        <p className="mt-3 text-[12px] text-[#6B6F68]">{missingSummary(missing)}</p>
      ) : null}
    </div>
  );
}

function StageNode({ stage }: { stage: DocumentRelationship }) {
  const className =
    stage.state === 'current'
      ? 'rounded-[14px] border border-[#3E7BC4]/40 bg-[#EAF2FC] px-3.5 py-2 text-[12px] font-semibold text-[#1F5FA8]'
      : stage.state === 'present'
        ? 'rounded-[14px] border border-[#EEF1F5] bg-white px-3.5 py-2 text-[12px] font-medium text-[#171A17]'
        : 'rounded-[14px] border border-dashed border-[#E2E6EC] px-3.5 py-2 text-[12px] text-[#A0A49C]';

  return <span className={className}>{stage.label}</span>;
}

function missingSummary(missing: DocumentRelationship[]): string {
  const labels = missing.map((s) => s.label);
  if (labels.length === 1) return `${labels[0]} not yet received.`;
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(', ')} and ${last} not yet received.`;
}
