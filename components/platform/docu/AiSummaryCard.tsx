'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AiSummary } from '@/lib/platform/docu/types';

/**
 * AI summary card for the Doc-U detail panel. Renders a cached, concise
 * (≤500 char) operational briefing plus spend/supplier chips, and can
 * generate / regenerate it via /api/ai/summary (Haiku).
 */
export function AiSummaryCard({
  documentId,
  initialSummary,
}: {
  documentId: string;
  initialSummary: AiSummary | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<AiSummary | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(regenerate: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, regenerate }),
      });
      if (!res.ok) {
        throw new Error(`Couldn’t generate summary (${res.status})`);
      }
      const json = await res.json();
      setSummary(json.summary as AiSummary);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      {/* Heading row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="of-display text-[16px] font-semibold text-[#171A17]">AI summary</h3>
          <p className="mt-0.5 text-[12px] text-[#A0A49C]">Operational briefing</p>
        </div>
        {summary ? (
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={loading}
            className="shrink-0 text-[13px] font-semibold text-[#1F5FA8] transition-colors hover:text-[#174C87] disabled:opacity-50"
          >
            Regenerate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={loading}
            className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
          >
            Generate AI summary
          </button>
        )}
      </div>

      {/* Loading line */}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-[#6B6F68]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#1F5FA8]" />
          <span className="animate-pulse">Generating operational summary…</span>
        </div>
      ) : null}

      {/* Error */}
      {error && !loading ? (
        <p className="mt-4 text-[13px] text-[#A32D2D]">{error}</p>
      ) : null}

      {/* Empty state */}
      {!summary && !loading && !error ? (
        <p className="mt-4 text-[13px] text-[#8A8E86]">
          No summary yet — generate a briefing to read spend, price movements and discrepancies at a glance.
        </p>
      ) : null}

      {/* Summary body */}
      {summary && !loading ? (
        <div className="mt-4 space-y-4">
          {/* Briefing (≤500 chars) */}
          <p className="text-[14px] leading-relaxed text-[#171A17]">{summary.text}</p>

          {/* Stat chips */}
          {summary.total_spend || summary.supplier ? (
            <div className="flex flex-wrap gap-2.5">
              {summary.total_spend ? (
                <div className="rounded-[14px] border border-[#EEF1F5] bg-[#E1F5EE] px-3.5 py-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Total spend</div>
                  <div className="of-num mt-1 text-[15px] font-semibold text-[#0F6E56]">{summary.total_spend}</div>
                </div>
              ) : null}
              {summary.supplier ? (
                <div className="rounded-[14px] border border-[#EEF1F5] bg-white px-3.5 py-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Supplier</div>
                  <div className="mt-1 text-[15px] font-semibold text-[#171A17]">{summary.supplier}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
