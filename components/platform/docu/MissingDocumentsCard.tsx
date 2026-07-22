'use client';

import type { FlagSeverity, MissingDocInsight } from '@/lib/platform/docu/types';

/** Severity → dot colour for missing-document insights. */
const SEVERITY_DOT: Record<FlagSeverity, string> = {
  critical: '#A32D2D',
  warning: '#854F0B',
  info: '#0C447C',
};

/**
 * Missing-document detection (feature 11). Illustrative insights surfaced in the
 * detail panel — each a severity dot + title + detail. Renders nothing when the
 * org has no gaps to flag.
 */
export function MissingDocumentsCard({ insights }: { insights: MissingDocInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex items-center gap-2">
        <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Missing documents</h3>
        <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#A0A49C]">demo</span>
      </div>

      <div className="mt-3 space-y-2.5">
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: SEVERITY_DOT[insight.severity] }}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#171A17]">{insight.title}</p>
              <p className="mt-0.5 text-[12px] text-[#A0A49C]">{insight.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
