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
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      {/* Heading row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#1A1C1E]">AI summary</h3>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Operational briefing</p>
        </div>
        {summary ? (
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={loading}
            className="shrink-0 text-[13px] text-[#5F6368] transition-colors hover:text-[#1A1C1E] disabled:opacity-50"
          >
            Regenerate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={loading}
            className="shrink-0 rounded-lg bg-[#1F5FA8] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
          >
            Generate AI summary
          </button>
        )}
      </div>

      {/* Loading line */}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-[#5F6368]">
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
        <p className="mt-4 text-[13px] text-[#9A9DA1]">
          No summary yet — generate a briefing to read spend, price movements and discrepancies at a glance.
        </p>
      ) : null}

      {/* Summary body */}
      {summary && !loading ? (
        <div className="mt-4 space-y-4">
          {/* Briefing (≤500 chars) */}
          <p className="text-[14px] leading-relaxed text-[#1A1C1E]">{summary.text}</p>

          {/* Stat chips */}
          {summary.total_spend || summary.supplier ? (
            <div className="flex flex-wrap gap-2.5">
              {summary.total_spend ? (
                <div className="rounded-xl border border-[#E7E7E2] bg-[#EAF2FC] px-3 py-2">
                  <div className="text-[11px] text-[#5F6368]">Total spend</div>
                  <div className="mt-0.5 text-[14px] font-semibold text-[#0F6E56]">{summary.total_spend}</div>
                </div>
              ) : null}
              {summary.supplier ? (
                <div className="rounded-xl border border-[#E7E7E2] bg-white px-3 py-2">
                  <div className="text-[11px] text-[#5F6368]">Supplier</div>
                  <div className="mt-0.5 text-[14px] font-semibold text-[#1A1C1E]">{summary.supplier}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
