'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocuNav } from './DocuNav';
import {
  buildReconciliationCsv,
  fmtZar,
  monthKeyOf,
  monthLabelOf,
  parseStatementDate,
  toReconRow,
  type ReconRow,
} from '@/lib/platform/docu/reconciliation';
import type { DocumentWithSupplier } from '@/lib/platform/types';

const COLS = 'min-w-[1080px] grid-cols-[100px_150px_repeat(7,108px)_72px]';

type Row = ReconRow & { monthKey: string };

function rowTime(r: Row): number {
  const d = parseStatementDate(r.date);
  return d ? d.getTime() : 0;
}

/**
 * Reconciliation as collapsible month tiles, grouped by the date PARSED from
 * each statement (not the upload date). Each month has its own CSV export.
 * Polls + refreshes on focus so newly added/parsed statements appear live.
 */
export function ReconciliationView({ statements }: { statements: DocumentWithSupplier[] }) {
  const router = useRouter();

  // The server already rendered fresh data, so there's no mount-time refresh.
  // We refresh when the user returns to the tab (so a statement uploaded/parsed
  // elsewhere shows up), and ONLY poll on an interval while something is still
  // extracting — an idle reconciliation tab makes zero background server hits.
  const hasPending = statements.some((s) => s.status === 'pending');
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const iv = hasPending ? setInterval(refresh, 5000) : undefined;
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      if (iv) clearInterval(iv);
    };
  }, [router, hasPending]);

  const groups = useMemo(() => {
    const rows: Row[] = statements
      .map(toReconRow)
      .filter((r): r is ReconRow => r != null)
      .map((r) => {
        const d = parseStatementDate(r.date);
        return { ...r, monthKey: d ? monthKeyOf(d) : 'undated' };
      });
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (!map.has(r.monthKey)) map.set(r.monthKey, []);
      map.get(r.monthKey)!.push(r);
    }
    return [...map.entries()]
      .map(([key, rs]) => ({ key, label: monthLabelOf(key), rows: rs.sort((a, b) => rowTime(a) - rowTime(b)) }))
      .sort((a, b) => (a.key === 'undated' ? 1 : b.key === 'undated' ? -1 : a.key < b.key ? 1 : -1));
  }, [statements]);

  const parsedCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const missing = statements.length - parsedCount;

  const defaultOpen = groups.find((g) => g.key !== 'undated')?.key ?? groups[0]?.key;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => overrides[k] ?? k === defaultOpen;
  const toggle = (k: string) => setOverrides((prev) => ({ ...prev, [k]: !isOpen(k) }));

  function downloadMonth(label: string, rows: Row[]) {
    const csv = buildReconciliationCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases-summary-${label.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-8 py-7">
      <DocuNav />

      <div className="mt-6">
        <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">Reconciliation</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          Statement totals by month — grouped by the date on each statement. Export any month as CSV.
        </p>
      </div>

      {missing > 0 ? (
        <p className="mt-4 rounded-xl bg-[#FBEEDA] px-3 py-2 text-[13px] text-[#854F0B]">
          {missing} statement{missing === 1 ? '' : 's'} {missing === 1 ? 'has' : 'have'} no parsed totals yet — newly
          uploaded statements are parsed automatically.
        </p>
      ) : null}

      {parsedCount === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No statement totals yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
            Upload supplier statements and Doc-U parses their transaction summaries here, ready to
            export.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {groups.map((g) => {
            const open = isOpen(g.key);
            return (
              <div key={g.key} className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    className="flex items-center gap-2 text-left"
                    aria-expanded={open}
                  >
                    <span className={`text-[#9A9DA1] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
                      ▾
                    </span>
                    <span className="text-[15px] font-semibold text-[#1A1C1E]">{g.label}</span>
                    <span className="text-[12px] text-[#9A9DA1]">
                      {g.rows.length} statement{g.rows.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMonth(g.label, g.rows)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#1E5E54] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45]"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Export CSV
                  </button>
                </div>

                {open ? (
                  <div className="overflow-x-auto border-t border-[#E7E7E2]">
                    <div className={`grid ${COLS} items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-2.5 text-[12px] text-[#5F6368]`}>
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
                    {g.rows.map((r) => {
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
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
