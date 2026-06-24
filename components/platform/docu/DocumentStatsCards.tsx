'use client';

import { KpiTile } from '@/components/platform/ui';
import { computeKpis } from '@/lib/platform/documents';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/** The Doc-U inbox KPI grid. */
export function DocumentStatsCards({ docs }: { docs: DocumentWithSupplier[] }) {
  const kpis = computeKpis(docs);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        label="Avg confidence"
        value={kpis.avgConfidence != null ? `${kpis.avgConfidence}%` : '—'}
        accent="#0F6E56"
        sublabel="Last 7 days"
        href="/app/docu/confidence"
      />
    </div>
  );
}
