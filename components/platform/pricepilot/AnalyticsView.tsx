'use client';

import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/platform/procurepulse/ui';
import { zar, type AnalyticsRow, type AnalyticsTotals } from '@/lib/platform/pricepilot';

export interface DimensionData {
  customer: AnalyticsRow[];
  category: AnalyticsRow[];
  product: AnalyticsRow[];
  totals: AnalyticsTotals;
}

type WindowKey = '30d' | '90d' | 'all';
type Dimension = 'customer' | 'category' | 'product';

export interface AnalyticsViewProps {
  windows: Record<WindowKey, DimensionData>;
  target: number;
}

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];
const DIMENSIONS: { key: Dimension; label: string; noun: string; singular: string }[] = [
  { key: 'customer', label: 'By customer', noun: 'Customers', singular: 'Customer' },
  { key: 'category', label: 'By category', noun: 'Categories', singular: 'Category' },
  { key: 'product', label: 'By product', noun: 'Products', singular: 'Product' },
];

export function AnalyticsView({ windows, target }: AnalyticsViewProps) {
  const [win, setWin] = useState<WindowKey>('90d');
  const [dim, setDim] = useState<Dimension>('customer');

  const data = windows[win];
  const rows = data[dim];
  const totals = data.totals;
  const dimMeta = DIMENSIONS.find((d) => d.key === dim)!;
  const noun = dimMeta.noun;

  // reduce (not Math.max spread) so a very large dimension can't blow the arg limit.
  const maxContribution = rows.reduce((m, r) => Math.max(m, r.contributionPct), 1);

  // Top / bottom by margin among real, costed, revenue-bearing rows ('∅' = the
  // synthetic "No customer"/"Unknown product" catch-all, excluded from ranking).
  const ranked = useMemo(
    () =>
      rows
        .filter((r) => r.key !== '∅' && r.margin != null && r.revenue > 0)
        .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0)),
    [rows],
  );
  const topPerformers = ranked.slice(0, 3);
  // Take the lowest from the rows NOT already in the top 3 — guarantees no overlap.
  const bottomPerformers = ranked.length > 3 ? ranked.slice(3).slice(-3).reverse() : [];
  const activeCount = rows.filter((r) => r.key !== '∅' && r.revenue > 0).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Analytics</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Where your revenue and gross profit come from</p>
        </div>
        <div className="inline-flex rounded-[10px] border border-[#EEF1F5] bg-[#F6F8FB] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWin(w.key)}
              className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                win === w.key
                  ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]'
                  : 'text-[#8A8E86] hover:text-[#174C87]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Revenue" value={zar(totals.revenue)} />
        <KpiCard label="Gross profit" value={zar(totals.profit)} accent="#0F6E56" />
        <KpiCard
          label="Avg margin"
          value={totals.margin != null ? `${Math.round(totals.margin)}%` : '—'}
          accent={totals.margin != null && totals.margin >= target ? '#0F6E56' : '#854F0B'}
        />
        <KpiCard label={`Active ${noun.toLowerCase()}`} value={String(activeCount)} />
      </div>

      {/* Top / bottom performers by margin */}
      {ranked.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PerformerCard title="Top margin" rows={topPerformers} tone="up" />
          {bottomPerformers.length > 0 ? <PerformerCard title="Lowest margin" rows={bottomPerformers} tone="down" /> : null}
        </div>
      ) : null}

      {/* Dimension tabs */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDim(d.key)}
            className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
              dim === d.key
                ? 'border-[#3E7BC4] bg-[#1F5FA8] text-white'
                : 'border-[#E2E6EC] bg-white text-[#6B6F68] hover:border-[#3E7BC4]/40'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-5 py-2.5 text-left font-medium">{dimMeta.singular}</th>
                <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross profit</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="px-5 py-2.5 text-left font-medium">Profit contribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#8A8E86]">
                    No sales in this period yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                    <td className="px-5 py-3 font-semibold text-[#171A17]">{r.label}</td>
                    <td className="of-num px-3 py-3 text-right text-[#6B6F68]">{zar(r.revenue)}</td>
                    <td className="of-num px-3 py-3 text-right font-semibold text-[#171A17]">{zar(r.profit)}</td>
                    <td
                      className="of-num px-3 py-3 text-right font-semibold"
                      style={{ color: r.margin == null ? '#8A8E86' : r.margin >= target ? '#0F6E56' : '#854F0B' }}
                    >
                      {r.margin != null ? `${Math.round(r.margin)}%` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
                          <div
                            className="h-full rounded-full bg-[#1F5FA8]"
                            style={{ width: `${r.contributionPct <= 0 ? 0 : Math.max(3, (r.contributionPct / maxContribution) * 100)}%` }}
                          />
                        </div>
                        <span className="of-num w-10 shrink-0 text-right text-[12px] text-[#8A8E86]">
                          {Math.round(r.contributionPct)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-[#A0A49C]">
        Margin and gross profit use each product&rsquo;s latest cost; lines without a recorded cost are excluded from the
        profit figures.
      </p>
    </div>
  );
}

function PerformerCard({ title, rows, tone }: { title: string; rows: AnalyticsRow[]; tone: 'up' | 'down' }) {
  const color = tone === 'up' ? '#0F6E56' : '#A32D2D';
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{title}</h2>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-medium text-[#171A17]">{r.label}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="of-num font-semibold" style={{ color }}>
                {r.margin != null ? `${Math.round(r.margin)}%` : '—'}
              </span>
              <span className="of-num w-20 text-right text-[#8A8E86]">{zar(r.profit)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
