'use client';

import Link from 'next/link';
import { KpiTile } from '@/components/platform/ui';
import { DocumentsTable } from '@/components/platform/DocumentsTable';
import { computeKpis } from '@/lib/platform/documents';
import type { DocumentWithSupplier } from '@/lib/platform/types';

export function InboxView({
  docs,
  title,
  subtitle,
}: {
  docs: DocumentWithSupplier[];
  title: string;
  subtitle: string;
}) {
  const kpis = computeKpis(docs);

  return (
    <div className="px-8 py-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">{title}</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative">
            <input
              type="text"
              readOnly
              placeholder="Search documents…"
              className="h-10 w-64 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:outline-none"
            />
          </div>
          <Link
            href="/app/docu/upload"
            className="inline-flex h-10 items-center rounded-xl bg-[#D9730D] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B]"
          >
            Upload document
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <KpiTile
          label="Total documents"
          value={String(kpis.total)}
          sublabel="Across all suppliers"
          href="/app/docu"
        />
        <KpiTile
          label="Awaiting review"
          value={String(kpis.awaiting)}
          accent="#D9730D"
          sublabel="Extracted + pending"
          href="/app/docu/awaiting"
        />
        <KpiTile
          label="Flagged"
          value={String(kpis.flagged)}
          accent="#A32D2D"
          sublabel="Needs attention"
          href="/app/docu/flagged"
        />
        <KpiTile
          label="Avg confidence"
          value={kpis.avgConfidence != null ? `${kpis.avgConfidence}%` : '—'}
          accent="#0F6E56"
          sublabel="Last 7 days"
          href="/app/docu/confidence"
        />
      </div>

      {/* Table */}
      <DocumentsTable docs={docs} />
    </div>
  );
}
