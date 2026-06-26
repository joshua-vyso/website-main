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
    <nav className="flex flex-wrap gap-1.5">
      {TABS.map((t) => {
        const active =
          t.href === '/app/procurepulse'
            ? pathname === t.href
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-[#1A1C1E] text-white'
                : 'border border-[#E7E7E2] bg-white text-[#5F6368] hover:bg-black/[0.03]'
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
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-[#5F6368]">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2.5">{right}</div> : null}
    </div>
  );
}

export function StockStatusPill({ status }: { status: StockStatus }) {
  const c = STOCK_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}

export function TrendText({ pct }: { pct: number | null }) {
  return (
    <span className="text-[13px] font-medium" style={{ color: trendColor(pct) }}>
      {trendLabel(pct)}
    </span>
  );
}

export function DocBadge({ label = 'Doc-U' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#E3F0ED] px-2.5 py-1 text-[11px] font-medium text-[#1E5E54]">
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
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="text-[13px] text-[#9A9DA1]">{label}</div>
      <div
        className="mt-2 text-[26px] font-bold leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** Teal accent button (primary CTA). */
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
      ? 'bg-[#1E5E54] text-white'
      : 'border border-[#D7DAD8] bg-white text-[#5F6368]';
  const base = `inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[14px] font-medium ${cls}`;
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
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EFEFEC]">
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
  color = '#1E5E54',
  fill = '#E3F0ED',
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

// ---------------------------------------------------------------------------
// Settings primitives (visual)
// ---------------------------------------------------------------------------

export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-[26px] w-[46px] items-center rounded-full px-[3px] ${
        on ? 'justify-end bg-[#1E5E54]' : 'justify-start bg-[#D7DAD8]'
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white" />
    </span>
  );
}

export function Stepper({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-[#F2F2EF] text-[14px]">
      <span className="px-3 py-1.5 font-medium text-[#5F6368]">−</span>
      <span className="min-w-[28px] px-1 text-center font-medium text-[#1A1C1E]">{value}</span>
      <span className="px-3 py-1.5 font-medium text-[#1E5E54]">+</span>
    </span>
  );
}
