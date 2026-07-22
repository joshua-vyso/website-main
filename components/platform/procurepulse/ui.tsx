'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  STOCK_STATUS_COLORS,
  trendColor,
  trendLabel,
} from '@/lib/platform/procurepulse';
import type { StockStatus } from '@/lib/platform/types';

/** Horizontal sub-navigation across the ProcurePulse desktop screens. */
const TABS = [
  { label: 'Dashboard', href: '/app/procurepulse' },
  { label: 'Products', href: '/app/procurepulse/products' },
  { label: 'Stock orders', href: '/app/procurepulse/reorder' },
  { label: 'Recipes', href: '/app/procurepulse/recipes' },
  { label: 'Live stock', href: '/app/procurepulse/stock' },
  { label: 'Counts', href: '/app/procurepulse/counts' },
  { label: 'Intelligence', href: '/app/procurepulse/intelligence' },
  { label: 'Alerts', href: '/app/procurepulse/alerts' },
  { label: 'Settings', href: '/app/procurepulse/settings' },
];

export function PpSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#EAEDF2]">
      {TABS.map((t) => {
        const active =
          t.href === '/app/procurepulse'
            ? pathname === t.href
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${
              active
                ? 'border-[#3E7BC4] font-medium text-[#171A17]'
                : 'border-transparent text-[#6B6F68] hover:text-[#171A17]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LiveChip({ label = 'Live · updated 2m ago' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[12px] font-medium text-[#0F6E56]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
      {label}
    </span>
  );
}

export function PageHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[14px] text-[#8A8E86]">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2.5">{right}</div> : null}
    </div>
  );
}

export function StockStatusPill({ status }: { status: StockStatus }) {
  const c = STOCK_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}

export function TrendText({ pct }: { pct: number | null }) {
  return (
    <span className="of-num text-[13px] font-medium" style={{ color: trendColor(pct) }}>
      {trendLabel(pct)}
    </span>
  );
}

export function DocBadge({ label = 'Doc-U' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#EAF2FC] px-2.5 py-1 text-[11px] font-medium text-[#1F5FA8]">
      {label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div
        className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]"
        style={accent ? { color: accent } : { color: '#171A17' }}
      >
        {value}
      </div>
    </div>
  );
}

/** Accent button (primary CTA). */
export function PpButton({
  children,
  href,
  variant = 'solid',
}: {
  children: ReactNode;
  href?: string;
  variant?: 'solid' | 'outline';
}) {
  const cls =
    variant === 'solid'
      ? 'bg-[#1F5FA8] font-semibold text-white transition-colors hover:bg-[#174C87]'
      : 'border border-[#E2E6EC] bg-white font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]';
  const base = `inline-flex h-[42px] items-center justify-center rounded-[11px] px-[18px] text-[14px] ${cls}`;
  return href ? (
    <Link href={href} className={base}>
      {children}
    </Link>
  ) : (
    <button type="button" className={base}>
      {children}
    </button>
  );
}

export function LevelBar({
  value,
  threshold,
  status,
}: {
  value: number;
  threshold: number;
  status: StockStatus;
}) {
  const max = Math.max(threshold * 2, value, 1);
  const pct = Math.min(100, Math.max(3, (value / max) * 100));
  const fill = status === 'out' ? '#A32D2D' : status === 'low' ? '#EF9F27' : '#1D9E75';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: fill }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG charts (pure, driven by a number[] series)
// ---------------------------------------------------------------------------

function chartPaths(data: number[], w: number, h: number, pad = 6) {
  if (data.length === 0) return { line: '', area: '' };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area =
    `M ${pts[0][0]},${pts[0][1]} ` +
    pts
      .slice(1)
      .map(([x, y]) => `L ${x},${y}`)
      .join(' ') +
    ` L ${w},${h} L 0,${h} Z`;
  return { line, area };
}

export function AreaChart({
  data,
  color = '#3E7BC4',
  fill = '#EAF2FC',
  height = 120,
}: {
  data: number[];
  color?: string;
  fill?: string;
  height?: number;
}) {
  const W = 600;
  const { line, area } = chartPaths(data, W, height);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={fill} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={3} />
    </svg>
  );
}

export function Sparkline({
  data,
  color = '#A32D2D',
  width = 100,
  height = 40,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const { line } = chartPaths(data, width, height, 4);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} />
    </svg>
  );
}

/** Donut chart from labelled, coloured slices (pure SVG; segments via dash-arrays). */
export function DonutChart({
  segments,
  size = 150,
  thickness = 24,
  centerLabel,
  centerSub,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F5" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const frac = s.value / total;
              const dash = frac * c;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return el;
            })}
        </g>
      </svg>
      {centerLabel ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="of-num text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{centerLabel}</span>
          {centerSub ? <span className="mt-1 text-[11px] text-[#A0A49C]">{centerSub}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings primitives (visual)
// ---------------------------------------------------------------------------

export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-[26px] w-[46px] items-center rounded-full px-[3px] ${
        on ? 'justify-end bg-[#1F5FA8]' : 'justify-start bg-[#E2E6EC]'
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white" />
    </span>
  );
}

export function Stepper({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center rounded-[10px] bg-[#F2F2EF] text-[14px]">
      <span className="px-3 py-1.5 font-medium text-[#6B6F68]">−</span>
      <span className="of-num min-w-[28px] px-1 text-center font-medium text-[#171A17]">{value}</span>
      <span className="px-3 py-1.5 font-medium text-[#1F5FA8]">+</span>
    </span>
  );
}
