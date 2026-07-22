'use client';

import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/platform/tokens';
import type { DocumentStatus } from '@/lib/platform/types';

export function StatusPill({ status }: { status: DocumentStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.fg }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ConfidenceText({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#8A8E86]">—</span>;
  const color = value >= 80 ? '#0F6E56' : value >= 70 ? '#854F0B' : '#A32D2D';
  return (
    <span className="font-semibold" style={{ color }}>
      {Math.round(value)}%
    </span>
  );
}

export function KpiTile({
  label,
  value,
  sublabel,
  accent,
  href,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[#EAEDF2] bg-white px-6 py-[22px] shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</span>
        <span className="text-[15px] text-[#8A8E86]">›</span>
      </div>
      <div
        className="of-num mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em]"
        style={accent ? { color: accent } : { color: '#171A17' }}
      >
        {value}
      </div>
      {sublabel ? <div className="mt-1.5 text-[13px] text-[#6B6F68]">{sublabel}</div> : null}
    </Link>
  );
}
