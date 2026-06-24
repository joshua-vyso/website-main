'use client';

import { useMemo } from 'react';
import { DocuNav } from './DocuNav';
import { buildReconciliationCsv, fmtZar, toReconRow, type ReconRow } from '@/lib/platform/docu/reconciliation';
import type { DocumentWithSupplier } from '@/lib/platform/types';

const COLS = 'min-w-[1080px] grid-cols-[100px_150px_repeat(7,108px)_72px]';

function rowTime(r: ReconRow): number {
  const t = new Date(r.date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Purchases-summary reconciliation: one row per statement (parsed totals), with
 * a CSV export matching the supplier purchases-summary spreadsheet.
 */
export function ReconciliationView({ statements }: { statements: DocumentWithSupplier[] }) {
  const rows = useMemo(
    () =>
      statements
        .map(toReconRow)
        .filter((r): r is ReconRow => r != null)
        .sort((a, b) => rowTime(a) - rowTime(b)),
    [statements],
  );

  const missing = statements.length - rows.length;

  function downloadCsv() {
    const csv = buildReconciliationCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchases-summary.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-8 py-7">
      <DocuNav />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">Reconciliation</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            Statement totals by date — export the purchases summary as CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download CSV
        </button>
      </div>

      {missing > 0 ? (
        <p className="mt-4 rounded-xl bg-[#FBEEDA] px-3 py-2 text-[13px] text-[#854F0B]">
          {missing} statement{missing === 1 ? '' : 's'} {missing === 1 ? 'has' : 'have'} no parsed totals yet — newly
          uploaded statements are parsed automatically; re-upload older ones to include them.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No statement totals yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
            Upload supplier statements and Doc-U parses their transaction summaries here, ready to
            export.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <div className={`grid ${COLS} items-center border-b border-[#E7E7E2] bg-[#FBFBF9] px-5 py-3 text-[12px] text-[#5F6368]`}>
            <span>Date</span>
            <span>Supplier</span>
            <span className="text-right">Opening</span>
            <span className="text-right">Payments</span>
            <span className="text-right">Purchases</span>
            <span className="text-right">Pallet refunds</span>
            <span className="text-right">Pallet usage</span>
            <span className="text-right">VAT</span>
            <span className="text-right">Closing</span>
            <span className="text-right">Check</span>
          </div>
          {rows.map((r) => {
            const balanced = r.check != null && Math.abs(r.check) < 0.01;
            return (
              <div
                key={r.id}
                className={`grid ${COLS} items-center border-b border-[#F0F0EC] px-5 py-2.5 text-[13px] last:border-b-0`}
              >
                <span className="text-[#1A1C1E]">{r.date}</span>
                <span className="truncate text-[#5F6368]">{r.supplier}</span>
                <span className="text-right text-[#1A1C1E]">{fmtZar(r.opening)}</span>
                <span className="text-right text-[#1A1C1E]">{fmtZar(r.payments)}</span>
                <span className="text-right text-[#1A1C1E]">{fmtZar(r.purchases)}</span>
                <span className="text-right text-[#5F6368]">{fmtZar(r.palletRefunds)}</span>
                <span className="text-right text-[#5F6368]">{fmtZar(r.palletUsage)}</span>
                <span className="text-right text-[#5F6368]">{fmtZar(r.vat)}</span>
                <span className="text-right font-medium text-[#1A1C1E]">{fmtZar(r.closing)}</span>
                <span className={`text-right font-medium ${r.check == null ? 'text-[#9A9DA1]' : balanced ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}`}>
                  {r.check == null ? '—' : balanced ? '✓' : r.check.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
