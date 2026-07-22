'use client';

import { FLAG_SEVERITY_COLOR } from '@/lib/platform/docu/flags';
import type { DocumentFlag } from '@/lib/platform/docu/types';

/**
 * Renders document flags. `compact` shows a small dot cluster (table cell);
 * otherwise full cards (detail panel).
 */
export function FlagsList({ flags, compact = false }: { flags: DocumentFlag[]; compact?: boolean }) {
  if (flags.length === 0) {
    return compact ? (
      <span className="text-[12px] text-[#A0A49C]">—</span>
    ) : (
      <p className="text-[13px] text-[#8A8E86]">No flags — this document looks clean.</p>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        {flags.slice(0, 3).map((f, i) => (
          <span
            key={i}
            title={f.label}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: FLAG_SEVERITY_COLOR[f.severity].fg }}
          />
        ))}
        {flags.length > 3 ? <span className="of-num text-[11px] text-[#A0A49C]">+{flags.length - 3}</span> : null}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((f, i) => {
        const c = FLAG_SEVERITY_COLOR[f.severity];
        return (
          <div key={i} className="flex items-start gap-2.5 rounded-[14px] border border-[#EEF1F5] bg-white p-3.5">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.fg }} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-[#171A17]">{f.label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ backgroundColor: c.bg, color: c.fg }}
                >
                  {f.severity}
                </span>
                {f.source === 'mock' ? (
                  <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#A0A49C]">demo</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] text-[#A0A49C]">{f.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
