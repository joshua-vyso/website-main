'use client';

import { SUMMARY_ROWS, fmtZar } from '@/lib/platform/docu/reconciliation';
import type { StatementSummary } from '@/lib/platform/docu/types';

/**
 * Statement totals (parsed TRANSACTION SUMMARY) — opening/closing balance,
 * payments, purchases, pallet fees, VAT and the statement date. Rendered in the
 * detail panel's "Additional information" and feeds the reconciliation export.
 */
export function StatementTotalsCard({ summary }: { summary: StatementSummary }) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Statement totals</h3>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Parsed from the transaction summary</p>
        </div>
        {summary.statement_date ? (
          <span className="shrink-0 rounded-full bg-[#F0F0EC] px-2.5 py-1 text-[12px] font-medium text-[#5F6368]">
            {summary.statement_date}
          </span>
        ) : null}
      </div>

      <dl className="mt-3 divide-y divide-[#F0F0EC]">
        {SUMMARY_ROWS.map((row) => {
          const value = summary[row.key] as number | null;
          if (value == null) return null;
          const isClosing = row.key === 'closing_balance';
          return (
            <div key={row.key} className="flex items-center justify-between py-2 text-[13px]">
              <dt className="text-[#5F6368]">{row.label}</dt>
              <dd className={isClosing ? 'font-semibold text-[#1A1C1E]' : 'text-[#1A1C1E]'}>
                {fmtZar(value)}
              </dd>
            </div>
          );
        })}
      </dl>

      {summary.audit_error != null ? (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-[12px] ${
            Math.abs(summary.audit_error) < 0.01
              ? 'bg-[#E1F5EE] text-[#0F6E56]'
              : 'bg-[#FCEBEB] text-[#A32D2D]'
          }`}
        >
          Audit error: {fmtZar(summary.audit_error)}
          {Math.abs(summary.audit_error) < 0.01 ? ' · balanced' : ' · review'}
        </div>
      ) : null}
    </div>
  );
}
