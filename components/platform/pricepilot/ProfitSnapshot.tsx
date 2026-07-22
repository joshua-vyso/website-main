'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zar, zar2 } from '@/lib/platform/pricepilot';

export interface BreakdownOrder {
  id: string;
  invoice: string;
  customer: string;
  date: string;
  revenue: number; // full invoice revenue
  costableRev: number; // revenue of costed lines (cost/profit/margin are computed on this)
  cost: number;
  profit: number;
  margin: number | null;
  uncosted: boolean;
}

type MetricKey = 'revenue' | 'gross_profit' | 'margin' | 'net';

export interface ProfitSnapshotProps {
  revenue: number;
  grossProfit: number;
  realizedMargin: number | null;
  netProfit: number | null;
  opex: number | null;
  target: number;
  revenueTarget: number | null;
  gpTarget: number | null;
  orders: BreakdownOrder[];
}

function Meter({ pct, color = '#3E7BC4' }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

/**
 * Revenue & profit snapshot — four tiles that expand in place to reveal the
 * exact per-order maths behind each number.
 */
export function ProfitSnapshot(props: ProfitSnapshotProps) {
  const { revenue, grossProfit, realizedMargin, netProfit, opex, target, revenueTarget, gpTarget, orders } = props;
  const [open, setOpen] = useState<MetricKey | null>(null);

  const revPct = revenueTarget ? (revenue / revenueTarget) * 100 : null;
  const gpPct = gpTarget ? (grossProfit / gpTarget) * 100 : null;

  const tiles: {
    key: MetricKey;
    label: string;
    value: string;
    sub: React.ReactNode;
    subColor?: string;
  }[] = [
    {
      key: 'revenue',
      label: 'Revenue',
      value: zar(revenue),
      sub:
        revPct != null ? (
          <>
            <span>
              {Math.round(revPct)}% of {zar(revenueTarget!)} target
            </span>
            <Meter pct={revPct} />
          </>
        ) : (
          'No revenue target set'
        ),
    },
    {
      key: 'gross_profit',
      label: 'Gross profit',
      value: zar(grossProfit),
      subColor: '#0F6E56',
      sub:
        gpPct != null ? (
          <>
            <span>
              {Math.round(gpPct)}% of {zar(gpTarget!)} target
            </span>
            <Meter pct={gpPct} color="#0F6E56" />
          </>
        ) : (
          'On costed sales'
        ),
    },
    {
      key: 'margin',
      label: 'Avg margin (realized)',
      value: realizedMargin != null ? `${Math.round(realizedMargin)}%` : '—',
      sub: `Target ${Math.round(target)}%`,
      subColor: realizedMargin != null && realizedMargin >= target ? '#0F6E56' : '#854F0B',
    },
    {
      key: 'net',
      label: 'Est. net profit',
      value: netProfit != null ? zar(netProfit) : '—',
      sub: opex != null ? `after ${zar(opex)} opex` : 'Operating costs not set',
      subColor: netProfit != null && netProfit >= 0 ? '#0F6E56' : netProfit != null ? '#A32D2D' : undefined,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const active = open === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setOpen(active ? null : t.key)}
              aria-expanded={active}
              className={`rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-all hover:border-[#C9DEF7] ${
                active ? 'border-[#3E7BC4] ring-1 ring-[#3E7BC4]/20' : 'border-[#EAEDF2]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{t.label}</span>
                <span className={`text-[#C7C9C5] transition-transform ${active ? 'rotate-180' : ''}`} aria-hidden>
                  ⌄
                </span>
              </div>
              <div className="of-num mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{t.value}</div>
              <div className="of-num mt-2 text-[12px]" style={{ color: t.subColor ?? '#A0A49C' }}>
                {t.sub}
              </div>
            </button>
          );
        })}
      </div>

      {open ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <Breakdown metric={open} {...props} />
        </div>
      ) : null}
    </div>
  );
}

function Breakdown({ metric, ...p }: ProfitSnapshotProps & { metric: MetricKey }) {
  const { orders, grossProfit, netProfit, opex } = p;

  if (orders.length === 0) {
    return <p className="py-10 text-center text-[13px] text-[#8A8E86]">No invoiced sales this month yet.</p>;
  }

  const title: Record<MetricKey, string> = {
    revenue: 'Revenue by order · this month',
    gross_profit: 'Gross profit by order · this month',
    margin: 'Margin by order · this month',
    net: 'Net profit · this month',
  };

  const sorted =
    metric === 'margin'
      ? [...orders].sort((a, b) => (a.margin ?? 999) - (b.margin ?? 999)) // worst margins first
      : [...orders].sort((a, b) => (metric === 'gross_profit' || metric === 'net' ? b.profit - a.profit : b.revenue - a.revenue));

  const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);
  const totalCost = orders.reduce((s, o) => s + o.cost, 0);
  const totalProfit = orders.reduce((s, o) => s + o.profit, 0);
  // Realized margin uses costable revenue (cost + profit) as the denominator, so the
  // footer matches the "Avg margin (realized)" tile even when some lines lack cost.
  const totalCostableRev = totalCost + totalProfit;
  const anyUncosted = orders.some((o) => o.uncosted);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF1F5] px-5 py-3.5">
        <h3 className="of-display text-[16px] font-semibold text-[#171A17]">{title[metric]}</h3>
        <span className="text-[12px] text-[#A0A49C]"><span className="of-num">{orders.length}</span> orders</span>
      </div>

      {/* Net profit gets a small ledger above the per-order table */}
      {metric === 'net' ? (
        <div className="border-b border-[#EEF1F5] px-5 py-4">
          <div className="mx-auto max-w-sm space-y-2 text-[14px]">
            <Row label="Gross profit (costed sales)" value={zar(grossProfit)} />
            <Row
              label="Operating costs"
              value={opex != null ? `− ${zar(opex)}` : 'not set'}
              muted={opex == null}
            />
            <div className="border-t border-[#EEF1F5] pt-2">
              <Row
                label="Net profit"
                value={netProfit != null ? zar(netProfit) : '—'}
                bold
                color={netProfit != null ? (netProfit >= 0 ? '#0F6E56' : '#A32D2D') : undefined}
              />
            </div>
            {opex == null ? (
              <p className="pt-1 text-[12px] text-[#8A8E86]">
                <Link href="/app/marginview/goals" className="font-medium text-[#1F5FA8] hover:underline">
                  Set your monthly operating costs
                </Link>{' '}
                to see net profit.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
              <th className="px-5 py-2.5 text-left font-medium">Invoice</th>
              <th className="px-3 py-2.5 text-left font-medium">Customer</th>
              {metric === 'revenue' ? (
                <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
              ) : (
                <>
                  <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                  <th className="px-5 py-2.5 text-right font-medium">Margin</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                <td className="px-5 py-3">
                  <Link href={`/app/orderflow/orders/${o.id}`} className="of-num font-semibold text-[#171A17] hover:text-[#174C87]">
                    {o.invoice}
                  </Link>
                </td>
                <td className="px-3 py-3 text-[#2C333B]">{o.customer}</td>
                {metric === 'revenue' ? (
                  <td className="of-num px-5 py-3 text-right font-semibold text-[#171A17]">{zar2(o.revenue)}</td>
                ) : (
                  <>
                    <td className="of-num px-3 py-3 text-right text-[#6B6F68]">
                      {o.costableRev > 0 ? zar2(o.costableRev) : '—'}
                      {o.uncosted ? (
                        <span className="block text-[11px] text-[#A0A49C]" title={`Full invoice ${zar2(o.revenue)}`}>
                          of {zar2(o.revenue)}
                        </span>
                      ) : null}
                    </td>
                    <td className="of-num px-3 py-3 text-right text-[#6B6F68]">
                      {o.costableRev > 0 ? zar2(o.cost) : '—'}
                    </td>
                    <td
                      className="of-num px-3 py-3 text-right font-semibold"
                      style={{ color: o.profit > 0 ? '#0F6E56' : o.profit < 0 ? '#A32D2D' : '#8A8E86' }}
                    >
                      {o.costableRev > 0 ? zar2(o.profit) : '—'}
                    </td>
                    <td className="of-num px-5 py-3 text-right text-[#6B6F68]">
                      {o.margin != null ? `${Math.round(o.margin)}%` : '—'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#EAEDF2] bg-[#FBFCFE] font-semibold text-[#171A17]">
              <td className="px-5 py-3" colSpan={2}>
                Total
              </td>
              {metric === 'revenue' ? (
                <td className="of-num px-5 py-3 text-right">{zar(totalRevenue)}</td>
              ) : (
                <>
                  <td className="of-num px-3 py-3 text-right">
                    {zar(totalCostableRev)}
                    {anyUncosted ? (
                      <span className="block text-[11px] font-normal text-[#A0A49C]">of {zar(totalRevenue)}</span>
                    ) : null}
                  </td>
                  <td className="of-num px-3 py-3 text-right">{zar(totalCost)}</td>
                  <td className="of-num px-3 py-3 text-right text-[#0F6E56]">{zar(totalProfit)}</td>
                  <td className="of-num px-5 py-3 text-right">
                    {totalCostableRev > 0 ? `${Math.round((totalProfit / totalCostableRev) * 100)}%` : '—'}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {anyUncosted && metric !== 'revenue' ? (
        <p className="border-t border-[#EEF1F5] px-5 py-3 text-[12px] text-[#8A8E86]">
          Some lines have no recorded cost yet, so profit and margin are based on the costed portion of each order.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-[#8A8E86]' : 'text-[#6B6F68]'}>{label}</span>
      <span className={`of-num ${bold ? 'font-semibold' : 'font-medium'}`} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
