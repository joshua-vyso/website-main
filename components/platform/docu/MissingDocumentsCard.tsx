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
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Missing documents</h3>
        <span className="rounded-full bg-[#F0F0EC] px-1.5 py-0.5 text-[10px] text-[#9A9DA1]">demo</span>
      </div>

      <div className="mt-3 space-y-2.5">
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: SEVERITY_DOT[insight.severity] }}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#1A1C1E]">{insight.title}</p>
              <p className="mt-0.5 text-[12px] text-[#5F6368]">{insight.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
