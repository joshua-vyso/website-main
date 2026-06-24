'use client';

import { useState } from 'react';
import { deriveConfidenceCategories } from '@/lib/platform/docu/confidence';
import type { ConfidenceCategory } from '@/lib/platform/docu/types';
import type { Document } from '@/lib/platform/types';

function barColor(confidence: number): string {
  return confidence >= 90 ? '#1D9E75' : confidence >= 70 ? '#EF9F27' : '#E24B4A';
}

/**
 * Field-level confidence breakdown for the Doc-U detail panel. Collapsible card
 * listing the 7 extraction categories with a thin confidence bar each.
 */
export function ConfidenceBreakdown({ doc }: { doc: Document }) {
  const cats = deriveConfidenceCategories(doc);
  const [open, setOpen] = useState(true);

  const lowCount = cats.filter((c) => c.isLow).length;

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-[#1A1C1E]">Confidence breakdown</span>
        <span
          className="text-[#9A9DA1] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="mt-3.5 space-y-2.5">
          {cats.map((cat: ConfidenceCategory) => {
            const hasValue = cat.confidence != null;
            return (
              <div key={cat.key} className="flex items-center gap-3">
                <span
                  className="w-[140px] shrink-0 text-[13px]"
                  style={cat.isLow ? { color: '#854F0B' } : { color: '#5F6368' }}
                >
                  {cat.label}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F0EC]">
                  {hasValue ? (
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${cat.confidence}%`,
                        backgroundColor: barColor(cat.confidence as number),
                      }}
                    />
                  ) : null}
                </span>
                <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-[#1A1C1E]">
                  {hasValue ? (
                    `${Math.round(cat.confidence as number)}%`
                  ) : (
                    <span className="text-[#9A9DA1]">—</span>
                  )}
                </span>
              </div>
            );
          })}

          {lowCount > 0 ? (
            <p className="pt-1 text-[12px] text-[#854F0B]">
              {lowCount} {lowCount === 1 ? 'field' : 'fields'} below 90% — worth a check
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
