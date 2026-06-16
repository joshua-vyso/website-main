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
  if (value == null) return <span className="text-[#9A9DA1]">—</span>;
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
      className="block rounded-2xl border border-[#E7E7E2] bg-white p-4 transition-colors hover:border-[#1E5E54]/30"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#5F6368]">{label}</span>
        <span className="text-[15px] text-[#9A9DA1]">›</span>
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sublabel ? <div className="mt-1 text-[12px] text-[#9A9DA1]">{sublabel}</div> : null}
    </Link>
  );
}
