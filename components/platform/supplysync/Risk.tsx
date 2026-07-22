'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSupplySync } from './context';
import {
  EmptyState,
  SeverityBadge,
  RiskStatusBadge,
  DocStatusBadge,
  SupplierNameButton,
  RED,
  AMBER,
  GREEN,
  MUTE,
} from './shared';
import { KpiStrip, Kpi, SectionCard, DataTable } from '@/components/platform/module-ui';
import { RowActionsMenu, useToast } from '@/components/platform/orderflow/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import type {
  SupplierRiskStatus,
  SupplierDocumentStatus,
  SupplierDocument,
} from '@/lib/platform/supplysync-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Short, calm date rendering (e.g. "3 Jul 2026") or an em-dash for null. */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Documents that are not yet valid (need attention) rank above valid ones. */
const DOC_ORDER: Record<SupplierDocumentStatus, number> = {
  missing: 0,
  expired: 1,
  expiring: 2,
  valid: 3,
};

/** Flattened document row carrying its owning supplier for the compliance table. */
interface FlatDoc {
  supplierId: string;
  supplierName: string;
  doc: SupplierDocument;
}

// ---------------------------------------------------------------------------
// Risk & Compliance workspace
// ---------------------------------------------------------------------------

export function RiskTab() {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show } = useToast();

  // Optimistic status overrides for the risk register, keyed by risk id.
  const [statusOverride, setStatusOverride] = useState<Record<string, SupplierRiskStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Effective status = server value merged with any optimistic override.
  const effectiveStatus = (id: string, base: SupplierRiskStatus): SupplierRiskStatus =>
    statusOverride[id] ?? base;

  // --- Summary metrics -----------------------------------------------------
  const summary = useMemo(() => {
    let highRisk = 0;
    let missingDocs = 0;
    let expiringDocs = 0;
    let lateDeliveries = 0;
    let qualityIssues = 0;
    let volatility = 0;
    for (const s of ss.suppliers) {
      if (s.risk === 'high') highRisk += 1;
      for (const d of s.docs) {
        if (d.status === 'missing' || d.status === 'expired') missingDocs += 1;
        if (d.status === 'expiring') expiringDocs += 1;
      }
      lateDeliveries += s.performance.lateDeliveries;
      qualityIssues += s.performance.qualityIssues;
      const dear = s.pricing.some((p) => p.diffVsMarketPct >= 8);
      if (s.priceTrend === 'volatile' || dear) volatility += 1;
    }
    return { highRisk, missingDocs, expiringDocs, lateDeliveries, qualityIssues, volatility };
  }, [ss.suppliers]);

  // --- Flattened compliance documents (needs-attention first) --------------
  const flatDocs = useMemo<FlatDoc[]>(() => {
    const rows: FlatDoc[] = [];
    for (const s of ss.suppliers) {
      for (const d of s.docs) {
        rows.push({ supplierId: s.id, supplierName: s.name, doc: d });
      }
    }
    rows.sort((a, b) => {
      const byStatus = DOC_ORDER[a.doc.status] - DOC_ORDER[b.doc.status];
      if (byStatus !== 0) return byStatus;
      return a.supplierName.localeCompare(b.supplierName);
    });
    return rows;
  }, [ss.suppliers]);

  // --- Real write: update ss_supplier_risks.status -------------------------
  async function updateRiskStatus(id: string, next: SupplierRiskStatus, confirmMsg: string) {
    const prev = statusOverride[id];
    setStatusOverride((m) => ({ ...m, [id]: next })); // optimistic
    setSavingId(id);

    const supabase = createClient();
    if (!supabase || !org) {
      // Revert and report — no dead action, honest failure.
      setStatusOverride((m) => {
        const copy = { ...m };
        if (prev === undefined) delete copy[id];
        else copy[id] = prev;
        return copy;
      });
      setSavingId(null);
      show('Not connected — status not saved.');
      return;
    }

    const { error } = await supabase
      .from('ss_supplier_risks')
      .update({ status: next })
      .eq('id', id)
      .eq('org_id', org.id);

    setSavingId(null);

    if (error) {
      setStatusOverride((m) => {
        const copy = { ...m };
        if (prev === undefined) delete copy[id];
        else copy[id] = prev;
        return copy;
      });
      show(error.message);
      return;
    }

    show(confirmMsg);
    // Clear the optimistic override so the refreshed server value shows through.
    setStatusOverride((m) => {
      const copy = { ...m };
      delete copy[id];
      return copy;
    });
    router.refresh(); // reconcile with server truth
  }

  // Action set depends on the current (effective) status.
  function riskActions(id: string, status: SupplierRiskStatus) {
    const busy = savingId === id;
    if (status === 'open') {
      return [
        { label: busy ? 'Saving…' : 'Start', onClick: () => updateRiskStatus(id, 'in_progress', 'Risk marked in progress') },
        { label: 'Resolve', onClick: () => updateRiskStatus(id, 'resolved', 'Risk resolved') },
        { label: 'Ignore', onClick: () => updateRiskStatus(id, 'ignored', 'Risk ignored') },
      ];
    }
    if (status === 'in_progress') {
      return [
        { label: busy ? 'Saving…' : 'Resolve', onClick: () => updateRiskStatus(id, 'resolved', 'Risk resolved') },
        { label: 'Ignore', onClick: () => updateRiskStatus(id, 'ignored', 'Risk ignored') },
      ];
    }
    // resolved | ignored
    return [
      { label: busy ? 'Saving…' : 'Reopen', onClick: () => updateRiskStatus(id, 'open', 'Risk reopened') },
    ];
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  if (ss.isEmpty) {
    return (
      <EmptyState
        title="No suppliers yet"
        hint="Add your first supplier to start tracking risk, compliance documents and open issues in SupplySync."
      />
    );
  }

  // -------------------------------------------------------------------------
  // Risk register rows
  // -------------------------------------------------------------------------
  const riskRows: ReactNode[][] = ss.risks.map((r) => {
    const status = effectiveStatus(r.id, r.status);
    return [
      r.supplierId ? (
        <SupplierNameButton id={r.supplierId} name={r.supplierName || 'Supplier'} />
      ) : (
        <span className="text-[#6B6F68]">{r.supplierName || 'General'}</span>
      ),
      <span className="text-[#171A17]">{r.riskType || '—'}</span>,
      <SeverityBadge severity={r.severity} />,
      <span className="text-[#6B6F68]">{r.description || '—'}</span>,
      <span className="text-[#6B6F68]">{r.suggestedAction ?? '—'}</span>,
      <span className="text-[#6B6F68]">{r.owner ?? 'Unassigned'}</span>,
      <RiskStatusBadge status={status} />,
      <span className="of-num text-[#6B6F68]">{fmtDate(r.dueDate)}</span>,
      <div className="flex justify-end">
        <RowActionsMenu actions={riskActions(r.id, status)} />
      </div>,
    ];
  });

  // -------------------------------------------------------------------------
  // Compliance document rows
  // -------------------------------------------------------------------------
  const docRows: ReactNode[][] = flatDocs.map(({ supplierId, supplierName, doc }) => {
    const dr = doc.daysRemaining;
    let drColor = MUTE;
    let drText: string;
    if (dr === null) {
      drColor = RED;
      drText = '—';
    } else if (dr < 0) {
      drColor = RED;
      drText = `${Math.abs(dr)}d overdue`;
    } else if (dr <= 30) {
      drColor = AMBER;
      drText = `${dr}d left`;
    } else {
      drColor = GREEN;
      drText = `${dr}d left`;
    }

    return [
      <SupplierNameButton id={supplierId} name={supplierName} />,
      <span className="text-[#171A17]">{doc.label}</span>,
      <DocStatusBadge status={doc.status} />,
      <span className="of-num text-[#6B6F68]">{fmtDate(doc.expiry)}</span>,
      <span className="of-num font-medium" style={{ color: drColor }}>{drText}</span>,
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => show(`Document requested from ${supplierName} (demo)`)}
          className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
        >
          Request
        </button>
        <button
          type="button"
          onClick={() => show('Upload document (demo)')}
          className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => show('Marked reviewed (demo)')}
          className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
        >
          Mark reviewed
        </button>
      </div>,
    ];
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* 1) Risk summary KPIs */}
      <KpiStrip>
        <Kpi
          label="High-risk suppliers"
          value={String(summary.highRisk)}
          accent={summary.highRisk > 0 ? RED : undefined}
          sub="Rated high risk"
        />
        <Kpi
          label="Missing documents"
          value={String(summary.missingDocs)}
          accent={summary.missingDocs > 0 ? RED : undefined}
          sub="Missing or expired"
        />
        <Kpi
          label="Expiring soon"
          value={String(summary.expiringDocs)}
          accent={summary.expiringDocs > 0 ? AMBER : undefined}
          sub="Docs nearing expiry"
        />
        <Kpi
          label="Late deliveries"
          value={String(summary.lateDeliveries)}
          accent={summary.lateDeliveries > 0 ? AMBER : undefined}
          sub="Across all suppliers"
        />
        <Kpi
          label="Quality issues"
          value={String(summary.qualityIssues)}
          accent={summary.qualityIssues > 0 ? AMBER : undefined}
          sub="Logged incidents"
        />
        <Kpi
          label="Price volatility alerts"
          value={String(summary.volatility)}
          accent={summary.volatility > 0 ? RED : undefined}
          sub="Volatile or above-market"
        />
      </KpiStrip>

      {/* 2) Risk register */}
      <SectionCard title="Risk register">
        <DataTable
          columns={[
            { label: 'Supplier' },
            { label: 'Risk type' },
            { label: 'Severity' },
            { label: 'Description' },
            { label: 'Suggested action' },
            { label: 'Owner' },
            { label: 'Status' },
            { label: 'Due date' },
            { label: 'Actions', align: 'right' },
          ]}
          rows={riskRows}
          empty="No open risks — every supplier is clear."
        />
      </SectionCard>

      {/* 3) Compliance documents */}
      <SectionCard title="Compliance documents">
        <DataTable
          columns={[
            { label: 'Supplier' },
            { label: 'Document' },
            { label: 'Status' },
            { label: 'Expiry date' },
            { label: 'Days remaining' },
            { label: 'Action', align: 'right' },
          ]}
          rows={docRows}
          empty="No documents on file yet."
        />
      </SectionCard>

      {toastNode}
    </div>
  );
}
