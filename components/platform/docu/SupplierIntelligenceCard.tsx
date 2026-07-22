'use client';

import type { SupplierIntelligence } from '@/lib/platform/docu/types';

/** Initials from a supplier name — up to two letters, uppercased. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Supplier intelligence summary — a calm, scannable snapshot of a supplier
 * derived from the org's own documents (totals, spend, confidence, modules).
 */
export function SupplierIntelligenceCard({ intel }: { intel: SupplierIntelligence }) {
  const rows: { label: string; value: string; accent?: string }[] = [
    {
      label: 'Total documents',
      value: intel.totalDocuments.toLocaleString('en-ZA'),
    },
    {
      label: 'Avg monthly spend',
      value:
        intel.avgMonthlySpend != null
          ? `R ${Math.round(intel.avgMonthlySpend).toLocaleString('en-ZA')}`
          : '—',
    },
    {
      label: 'Last received',
      value: intel.lastReceived ? formatDate(intel.lastReceived) : '—',
    },
    {
      label: 'Avg confidence',
      value: intel.avgConfidence != null ? `${Math.round(intel.avgConfidence)}%` : '—',
    },
    {
      label: 'Flagged discrepancies',
      value: intel.flaggedDiscrepancies.toLocaleString('en-ZA'),
      accent: intel.flaggedDiscrepancies > 0 ? '#A32D2D' : undefined,
    },
  ];

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FC] text-[13px] font-semibold text-[#1F5FA8]">
          {initials(intel.name)}
        </div>
        <div className="min-w-0">
          <div className="of-display truncate text-[16px] font-semibold text-[#171A17]">{intel.name}</div>
          <div className="text-[12px] text-[#A0A49C]">Supplier intelligence</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{r.label}</div>
            <div
              className="of-num mt-1 truncate text-[15px] font-semibold text-[#171A17]"
              style={r.accent ? { color: r.accent } : undefined}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[#EEF1F5] pt-3">
        <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Linked modules</div>
        {intel.linkedModules.length === 0 ? (
          <p className="mt-1 text-[13px] text-[#A0A49C]">—</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {intel.linkedModules.map((m) => (
              <span
                key={m}
                className="inline-flex items-center rounded-full bg-[#EEF1F5] px-2.5 py-1 text-[11px] font-medium text-[#6B6F68]"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
