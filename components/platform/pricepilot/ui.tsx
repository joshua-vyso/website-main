'use client';

import { useState, type ReactNode } from 'react';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import type { MarginBand } from '@/lib/platform/pricepilot';

/**
 * Pricing Health ring — a single 0–100 score on a soft track, score + band
 * label in the centre. Adapted from the ProcurePulse DonutChart visual style.
 */
export function ScoreRing({
  score,
  color,
  label,
  size = 168,
  thickness = 16,
}: {
  score: number;
  color: string;
  label?: string;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score / 100));
  const dash = frac * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F5" strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="of-num text-[40px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{score}</span>
        {label ? (
          <span className="mt-1.5 text-[12px] font-medium" style={{ color }}>
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Horizontal margin-distribution bars — one row per band, count + share. */
export function MarginBars({ bands }: { bands: MarginBand[] }) {
  const maxPct = Math.max(...bands.map((b) => b.pct), 1);
  return (
    <div className="flex flex-col gap-3">
      {bands.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="of-num w-14 shrink-0 text-right text-[12px] text-[#6B6F68]">{b.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${b.pct === 0 ? 0 : Math.max(4, (b.pct / maxPct) * 100)}%`, backgroundColor: b.color }}
            />
          </div>
          <span className="of-num w-16 shrink-0 text-[12px] text-[#8A8E86]">
            {b.count} · {b.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Snapshot stat — a label, a big value, and an optional sub line (e.g. progress
 * toward a target). Calmer than a KPI card; used in the Revenue & Profit row.
 */
export function StatTile({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  subColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{value}</div>
      {sub != null ? (
        <div className="mt-2 text-[12px]" style={subColor ? { color: subColor } : { color: '#8A8E86' }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/** Thin progress meter toward a target (0–100% of target). */
export function TargetMeter({ pct, color = '#3E7BC4' }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

export type TrendPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface TrendPoints {
  points: number[];
  labels: string[];
  hasData: boolean;
}

export interface TrendSeries {
  weekly: TrendPoints;
  monthly: TrendPoints;
  quarterly: TrendPoints;
  yearly: TrendPoints;
}

/** Margin Trend — realized gross-margin % over time, with a period toggle. */
export function MarginTrendCard({ series, target }: { series: TrendSeries; target: number }) {
  const [period, setPeriod] = useState<TrendPeriod>('monthly');
  const active = series[period];
  const points = active.points;
  const hasData = active.hasData;
  const latest = points.length ? points[points.length - 1] : 0;
  const first = points.length ? points[0] : 0;
  const delta = latest - first;
  const periods: { key: TrendPeriod; label: string }[] = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly' },
    { key: 'yearly', label: 'Yearly' },
  ];
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF1F5] px-5 py-4">
        <div>
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Margin trend</h2>
          <p className="mt-0.5 text-[12px] text-[#8A8E86]">Realized gross margin from sales</p>
        </div>
        <div className="inline-flex rounded-[10px] border border-[#EEF1F5] bg-[#F6F8FB] p-0.5">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                period === p.key
                  ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]'
                  : 'text-[#8A8E86] hover:text-[#174C87]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-4 pt-5">
        {hasData ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="of-num text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{Math.round(latest)}%</div>
                <div className="of-num mt-1.5 text-[12px]" style={{ color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} pts over period
                </div>
              </div>
              <div className="text-right text-[12px] text-[#8A8E86]">Target <span className="of-num">{Math.round(target)}%</span></div>
            </div>
            <div className="mt-3">
              <AreaChart data={points} height={110} />
            </div>
            <div className="of-num mt-1 flex justify-between text-[11px] text-[#A0A49C]">
              <span>{active.labels[0]}</span>
              <span>{active.labels[active.labels.length - 1]}</span>
            </div>
          </>
        ) : (
          <div className="flex h-[150px] items-center justify-center text-center text-[13px] text-[#8A8E86]">
            No costed sales in this period yet.
          </div>
        )}
      </div>
    </div>
  );
}

/** Section card shell — title row + body, matching the calm enterprise look. */
export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] px-5 py-4">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">{title}</h2>
        {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
