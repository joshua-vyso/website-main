'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Supplier, SupplierComparison, MarketPosition } from '@/lib/platform/supplysync-data';
import { useSupplySync, MAX_COMPARE } from '@/components/platform/supplysync/context';
import {
  ScorePill,
  POSITION_META,
  buildComparison,
  recommendationTone,
  INK,
  MUTE,
  FAINT,
} from '@/components/platform/supplysync/shared';
import { Badge } from '@/components/platform/module-ui';
import { Drawer } from '@/components/platform/orderflow/ui';

// ---------------------------------------------------------------------------
// Floating compare tray — sits above tables while suppliers are selected.
// ---------------------------------------------------------------------------

export function CompareBar() {
  const ss = useSupplySync();
  if (ss.compareIds.length === 0) return null;

  const canCompare = ss.compareIds.length >= 2;

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2">
      <div className="flex max-w-[92vw] items-center gap-3 rounded-2xl border border-[#EAEDF2] bg-white px-4 py-2.5 shadow-[0_16px_50px_-18px_rgba(26,28,30,0.45)]">
        {/* Selected supplier chips */}
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {ss.compareIds.map((id) => {
            const s = ss.supplierById(id);
            if (!s) return null;
            return (
              <span
                key={id}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBFCFE] py-1 pl-2.5 pr-1 text-[12px] font-medium text-[#171A17]"
                style={{ border: '1px solid #EAEDF2' }}
              >
                <span className="max-w-[140px] truncate">{s.name}</span>
                <button
                  type="button"
                  onClick={() => ss.toggleCompare(id)}
                  aria-label={`Remove ${s.name} from comparison`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>

        <span className="hidden shrink-0 whitespace-nowrap text-[12px] text-[#A0A49C] sm:inline">
          Select up to <span className="of-num">{MAX_COMPARE}</span>
        </span>

        <span className="h-5 w-px shrink-0 bg-[#EEF1F5]" aria-hidden />

        <button
          type="button"
          onClick={ss.clearCompare}
          className="inline-flex h-9 shrink-0 items-center rounded-[10px] px-3 text-[13px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={ss.openCompare}
          disabled={!canCompare}
          className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Compare (<span className="of-num">{ss.compareIds.length}</span>)
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-by-side comparison drawer
// ---------------------------------------------------------------------------

type ScoreKey = 'overall' | 'reliability' | 'quality' | 'delivery' | 'priceStability' | 'compliance';

const SCORE_ROWS: { key: ScoreKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'quality', label: 'Quality' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'priceStability', label: 'Price stability' },
  { key: 'compliance', label: 'Compliance' },
];

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <td className="sticky left-0 z-[1] whitespace-nowrap border-b border-[#EEF1F5] bg-white py-3 pl-4 pr-4 text-[13px] font-medium text-[#6B6F68]">
      {children}
    </td>
  );
}

function PositionCell({ position }: { position: MarketPosition }) {
  const m = POSITION_META[position];
  return (
    <span className="text-[13px] font-semibold" style={{ color: m.color }}>
      {m.label}
    </span>
  );
}

export function CompareDrawer() {
  const ss = useSupplySync();

  // Resolve the selected ids to live suppliers, keep only those that still exist.
  const suppliers: Supplier[] = ss.compareIds
    .map((id) => ss.supplierById(id))
    .filter((s): s is Supplier => Boolean(s));

  const rows: SupplierComparison[] = buildComparison(suppliers);

  // Best (max) value per score metric — used to subtly highlight the leader column.
  const bestByMetric: Record<ScoreKey, number> = {
    overall: rows.length ? Math.max(...rows.map((r) => r.overall)) : 0,
    reliability: rows.length ? Math.max(...rows.map((r) => r.reliability)) : 0,
    quality: rows.length ? Math.max(...rows.map((r) => r.quality)) : 0,
    delivery: rows.length ? Math.max(...rows.map((r) => r.delivery)) : 0,
    priceStability: rows.length ? Math.max(...rows.map((r) => r.priceStability)) : 0,
    compliance: rows.length ? Math.max(...rows.map((r) => r.compliance)) : 0,
  };

  // Column with the highest overall — softly tinted as the standout supplier.
  const bestOverallId =
    rows.length > 0 ? rows.reduce((a, b) => (b.overall > a.overall ? b : a)).supplierId : null;

  return (
    <Drawer open={ss.compareOpen} onClose={ss.closeCompare} width={720} title="Compare suppliers">
      {rows.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">Pick at least two suppliers</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">
            Select two or three suppliers from the table to see their scorecards, pricing position and
            recommendation side by side.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Comparison matrix — metrics down the left, one column per supplier */}
          <div className="overflow-x-auto rounded-2xl border border-[#EAEDF2]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[2] bg-[#FBFCFE] px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                    Metric
                  </th>
                  {rows.map((r) => {
                    const isBest = r.supplierId === bestOverallId;
                    return (
                      <th
                        key={r.supplierId}
                        className="border-l border-[#EEF1F5] px-4 py-3 align-bottom"
                        style={isBest ? { backgroundColor: '#0F6E560D' } : { backgroundColor: '#FBFCFE' }}
                      >
                        <button
                          type="button"
                          onClick={() => ss.openProfile(r.supplierId)}
                          className="of-display text-left text-[14px] font-semibold text-[#171A17] transition-colors hover:text-[#1F5FA8]"
                        >
                          {r.name}
                        </button>
                        {isBest ? (
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#0F6E56' }}>
                            Top overall
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white">
                {/* Score rows */}
                {SCORE_ROWS.map((sr) => (
                  <tr key={sr.key}>
                    <RowLabel>{sr.label}</RowLabel>
                    {rows.map((r) => {
                      const val = r[sr.key];
                      const isLeader = val === bestByMetric[sr.key];
                      return (
                        <td
                          key={r.supplierId}
                          className="border-b border-l border-[#EEF1F5] px-4 py-3"
                          style={r.supplierId === bestOverallId ? { backgroundColor: '#0F6E5608' } : undefined}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <ScorePill value={val} />
                            {isLeader ? (
                              <span className="text-[11px]" style={{ color: '#0F6E56' }} aria-label="best">
                                ▲
                              </span>
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Price position */}
                <tr>
                  <RowLabel>Price position</RowLabel>
                  {rows.map((r) => (
                    <td
                      key={r.supplierId}
                      className="border-b border-l border-[#EEF1F5] px-4 py-3"
                      style={r.supplierId === bestOverallId ? { backgroundColor: '#0F6E5608' } : undefined}
                    >
                      <PositionCell position={r.pricePosition} />
                    </td>
                  ))}
                </tr>

                {/* Last issue */}
                <tr>
                  <RowLabel>Last issue</RowLabel>
                  {rows.map((r) => (
                    <td
                      key={r.supplierId}
                      className="border-b border-l border-[#EEF1F5] px-4 py-3 text-[12px]"
                      style={{
                        color: r.lastIssue ? MUTE : FAINT,
                        ...(r.supplierId === bestOverallId ? { backgroundColor: '#0F6E5608' } : {}),
                      }}
                    >
                      {r.lastIssue ?? 'None recorded'}
                    </td>
                  ))}
                </tr>

                {/* Recommendation */}
                <tr>
                  <RowLabel>Recommendation</RowLabel>
                  {rows.map((r) => (
                    <td
                      key={r.supplierId}
                      className="border-l border-[#EEF1F5] px-4 py-3"
                      style={r.supplierId === bestOverallId ? { backgroundColor: '#0F6E5608' } : undefined}
                    >
                      <Badge label={r.recommendation} tone={recommendationTone(r.recommendation)} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Guidance note — SupplySync recommends; buying happens in ProcurePulse */}
          <p className="text-[12px] leading-relaxed" style={{ color: FAINT }}>
            Recommendations are guidance based on scorecards, compliance and pricing position. Actual purchasing
            happens in{' '}
            <Link href="/app/procurepulse" className="font-medium underline decoration-[#EAEDF2] underline-offset-2 transition-colors hover:text-[#1F5FA8]" style={{ color: MUTE }}>
              ProcurePulse
            </Link>
            .
          </p>

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[13px]" style={{ color: INK }}>
              Comparing <span className="of-num">{rows.length}</span> of up to <span className="of-num">{MAX_COMPARE}</span> suppliers
            </span>
            <button
              type="button"
              onClick={() => {
                ss.clearCompare();
                ss.closeCompare();
              }}
              className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
