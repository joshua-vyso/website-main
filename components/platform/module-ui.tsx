'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppIcon } from '@/components/platform/AppIcon';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import type { AppIconKey } from '@/lib/platform/types';
import { WIDGET_SEVERITY_STYLE, type ModuleWidget } from '@/lib/platform/module-widgets';

// ---------------------------------------------------------------------------
// Module header — icon + title + description + primary/secondary actions
// ---------------------------------------------------------------------------

export function ModuleHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: AppIconKey;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <AppIcon name={icon} size={40} />
        <div className="min-w-0">
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">{title}</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Primary action used across skeleton modules. */
export function PrimaryAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">
      {children}
    </button>
  );
}
export function SecondaryAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
}

export function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]" style={accent ? { color: accent } : { color: '#171A17' }}>
        {value}
      </div>
      {sub != null ? <div className="mt-1.5 text-[12px] text-[#A0A49C]">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic status badge
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info';
const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#EEF1F5', fg: '#6B6F68' },
  positive: { bg: '#E1F5EE', fg: '#0F6E56' },
  warning: { bg: '#FBEEDA', fg: '#854F0B' },
  critical: { bg: '#FCEBEB', fg: '#A32D2D' },
  info: { bg: '#E6F1FB', fg: '#0C447C' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const s = TONE_STYLE[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section card (title + body)
// ---------------------------------------------------------------------------

export function SectionCard({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
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

// ---------------------------------------------------------------------------
// Placeholder chart — illustrative, sample data
// ---------------------------------------------------------------------------

const SAMPLE = [12, 18, 15, 22, 19, 27, 24, 31, 28, 35];

export function PlaceholderChart({ data = SAMPLE, color = '#3E7BC4', fill = '#EAF2FC', height = 120, caption = 'Illustrative — live data once connected' }: { data?: number[]; color?: string; fill?: string; height?: number; caption?: string }) {
  return (
    <div>
      <AreaChart data={data} color={color} fill={fill} height={height} />
      <p className="mt-2 text-[11px] text-[#8A8E86]">{caption}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight data table shell
// ---------------------------------------------------------------------------

export interface Column {
  label: string;
  align?: 'left' | 'right';
}

export function DataTable({ columns, rows, empty }: { columns: Column[]; rows: ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
              {columns.map((c, i) => (
                <th key={i} className={`px-3 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">{empty}</td></tr>
            ) : (
              rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[#F5F9FE] last:border-0 hover:bg-[#F5F9FE]">
                  {r.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-3 ${columns[ci]?.align === 'right' ? 'of-num text-right' : 'text-left'} ${ci === 0 ? 'font-semibold text-[#171A17]' : 'text-[#2C333B]'}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated circular progress ring (premium feel; animates in on mount)
// ---------------------------------------------------------------------------

export function ProgressRing({
  pct,
  color,
  size = 84,
  thickness = 8,
  children,
}: {
  pct: number;
  color: string;
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, shown / 100)) * c;
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
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </g>
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  );
}

/**
 * A number that animates to `value`. Animates from 0 on mount and from its
 * CURRENT displayed value on later changes — so live readouts (e.g. dragging a
 * slider) chase smoothly instead of snapping back to zero each tick.
 */
export function CountUp({ value, format, duration = 700, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [n, setN] = useState(0);
  const fromRef = useRef(0);
  const nRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (value - from) * eased;
      nRef.current = cur;
      setN(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = nRef.current;
    };
  }, [value, duration]);
  return <span className={className}>{format(n)}</span>;
}

// ---------------------------------------------------------------------------
// Interactive doughnut — gap-free SVG sector paths, hover-expand + click-select
// ---------------------------------------------------------------------------

function sectorPath(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(rO, a0)} A ${rO} ${rO} 0 ${large} 1 ${pt(rO, a1)} L ${pt(rI, a1)} A ${rI} ${rI} 0 ${large} 0 ${pt(rI, a0)} Z`;
}

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

export function InteractiveDonut({
  segments,
  activeKey,
  onHover,
  onSelect,
  size = 200,
  thickness = 30,
  center,
}: {
  segments: DonutSegment[];
  activeKey: string | null;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const rOuter = (size - 20) / 2;
  const rInner = rOuter - thickness;
  const start = -Math.PI / 2;
  const tau = Math.PI * 2;
  const pad = 0.018;
  let cum = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const a = { ...s, offset: cum, frac };
    cum += frac;
    return a;
  });
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={(rOuter + rInner) / 2} fill="none" stroke="#F4F4F1" strokeWidth={thickness} />
        {arcs.map((s) => {
          const isActive = activeKey === s.key;
          const dimmed = activeKey != null && !isActive;
          const a0 = start + s.offset * tau + pad;
          const a1 = start + (s.offset + s.frac) * tau - pad;
          return (
            <path
              key={s.key}
              d={sectorPath(size / 2, size / 2, isActive ? rOuter + 6 : rOuter, rInner, a0, a1)}
              fill={s.color}
              opacity={dimmed ? 0.32 : 1}
              className="cursor-pointer"
              style={{ transition: 'opacity 0.22s ease' }}
              onMouseEnter={() => onHover(s.key)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(s.key)}
            />
          );
        })}
      </svg>
      {center ? <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile-companion widget preview card
// ---------------------------------------------------------------------------

export function ModuleWidgetCard({ widget, onAction }: { widget: ModuleWidget; onAction?: (w: ModuleWidget) => void }) {
  const s = WIDGET_SEVERITY_STYLE[widget.severity ?? 'neutral'];
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
        <span className="text-[12px] text-[#8A8E86]">{widget.title}</span>
      </div>
      <div className="mt-1.5 text-[20px] font-bold leading-none" style={{ color: s.fg }}>{widget.value}</div>
      {widget.subtitle ? <div className="mt-1.5 text-[11px] text-[#8A8E86]">{widget.subtitle}</div> : null}
      {widget.trend ? <div className="mt-1 text-[11px]" style={{ color: s.fg }}>{widget.trend}</div> : null}
      {widget.actionLabel && onAction ? (
        <button type="button" onClick={() => onAction(widget)} className="mt-2 text-[12px] font-medium text-[#1F5FA8] hover:underline">
          {widget.actionLabel} →
        </button>
      ) : null}
    </div>
  );
}
