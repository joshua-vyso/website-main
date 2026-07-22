'use client';

import { useMemo, useState } from 'react';
import type { Supplier, SupplierRisk, SupplierStatus } from '@/lib/platform/supplysync-data';
import { useSupplySync } from '@/components/platform/supplysync/context';
import {
  EmptyState,
  ScorePill,
  SupplierNameButton,
  SupplierStatusBadge,
} from '@/components/platform/supplysync/shared';
import { DataTable } from '@/components/platform/module-ui';
import { RowActionsMenu, useToast } from '@/components/platform/orderflow/ui';

// ---------------------------------------------------------------------------
// Filter / sort option types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | SupplierStatus;
type RiskFilter = 'all' | SupplierRisk;
type ComplianceFilter = 'all' | 'complete' | 'outstanding';
type PreferredFilter = 'all' | 'preferred';
type SortKey = 'reliability' | 'lastOrder' | 'risk' | 'overall';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'On review' },
];

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: 'all', label: 'All risk levels' },
  { value: 'low', label: 'Low risk' },
  { value: 'medium', label: 'Medium risk' },
  { value: 'high', label: 'High risk' },
];

const COMPLIANCE_OPTIONS: { value: ComplianceFilter; label: string }[] = [
  { value: 'all', label: 'All compliance' },
  { value: 'complete', label: 'Docs complete' },
  { value: 'outstanding', label: 'Docs outstanding' },
];

const PREFERRED_OPTIONS: { value: PreferredFilter; label: string }[] = [
  { value: 'all', label: 'All suppliers' },
  { value: 'preferred', label: 'Preferred only' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'reliability', label: 'Sort: Reliability' },
  { value: 'lastOrder', label: 'Sort: Last order' },
  { value: 'risk', label: 'Sort: Risk' },
  { value: 'overall', label: 'Sort: Overall score' },
];

const RISK_RANK: Record<SupplierRisk, number> = { high: 3, medium: 2, low: 1 };

const SELECT_CLASS =
  'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#3E7BC4]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lastOrderTime(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// ---------------------------------------------------------------------------
// Suppliers directory tab
// ---------------------------------------------------------------------------

export function SuppliersTab() {
  const { suppliers, isEmpty, openProfile, toggleCompare, openCompare } = useSupplySync();
  const { node: toastNode, show } = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [compliance, setCompliance] = useState<ComplianceFilter>('all');
  const [preferred, setPreferred] = useState<PreferredFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('reliability');

  // Distinct categories from suppliers[].category (calm, sorted).
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of suppliers) if (s.category) set.add(s.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = suppliers.filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.category} ${s.contactName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category !== 'all' && s.category !== category) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (risk !== 'all' && s.risk !== risk) return false;
      if (compliance === 'complete' && s.docsToAction > 0) return false;
      if (compliance === 'outstanding' && s.docsToAction === 0) return false;
      if (preferred === 'preferred' && s.status !== 'preferred') return false;
      return true;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'reliability':
          return b.scorecard.reliability - a.scorecard.reliability;
        case 'lastOrder':
          return lastOrderTime(b.lastOrder) - lastOrderTime(a.lastOrder);
        case 'risk':
          return RISK_RANK[b.risk] - RISK_RANK[a.risk];
        case 'overall':
          return b.scorecard.overall - a.scorecard.overall;
        default:
          return 0;
      }
    });
    return sorted;
  }, [suppliers, query, category, status, risk, compliance, preferred, sortKey]);

  if (isEmpty) {
    return (
      <EmptyState
        title="No suppliers yet"
        hint="Add your first supplier to start building scorecards, tracking compliance documents and surfacing pricing intelligence for your supply base."
      />
    );
  }

  const rows = filtered.map((s: Supplier) => [
    // Supplier — opens the profile drawer
    <SupplierNameButton key="name" id={s.id} name={s.name} />,
    // Category
    <span key="cat" className="text-[13px] text-[#5F6368]">
      {s.category || '—'}
    </span>,
    // Main contact (name + faint phone)
    <div key="contact" className="min-w-[140px]">
      <div className="text-[13px] text-[#1A1C1E]">{s.contactName ?? '—'}</div>
      {s.contactPhone ? <div className="text-[11px] text-[#9A9DA1]">{s.contactPhone}</div> : null}
    </div>,
    // Status
    <SupplierStatusBadge key="status" status={s.status} />,
    // Overall
    <ScorePill key="overall" value={s.scorecard.overall} />,
    // Reliability
    <ScorePill key="rel" value={s.scorecard.reliability} suffix="%" />,
    // Price stability
    <ScorePill key="price" value={s.scorecard.priceStability} suffix="%" />,
    // Delivery consistency
    <ScorePill key="delivery" value={s.scorecard.deliveryConsistency} suffix="%" />,
    // Compliance
    <ScorePill key="compliance" value={s.scorecard.compliance} suffix="%" />,
    // Last order
    <span key="last" className="text-[13px] text-[#5F6368]">
      {fmtDate(s.lastOrder)}
    </span>,
    // Actions
    <div key="actions" className="flex justify-end">
      <RowActionsMenu
        actions={[
          { label: 'View profile', onClick: () => openProfile(s.id) },
          {
            label: 'Compare',
            onClick: () => {
              toggleCompare(s.id);
              openCompare();
            },
          },
          { label: 'Add note', onClick: () => openProfile(s.id) },
          {
            label: 'Request documents',
            onClick: () => show(`Document request sent to ${s.name} (demo)`),
          },
        ]}
      />
    </div>,
  ]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search suppliers, category or contact…"
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]"
        />

        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={SELECT_CLASS}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by risk"
          value={risk}
          onChange={(e) => setRisk(e.target.value as RiskFilter)}
          className={SELECT_CLASS}
        >
          {RISK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by compliance"
          value={compliance}
          onChange={(e) => setCompliance(e.target.value as ComplianceFilter)}
          className={SELECT_CLASS}
        >
          {COMPLIANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter preferred"
          value={preferred}
          onChange={(e) => setPreferred(e.target.value as PreferredFilter)}
          className={SELECT_CLASS}
        >
          {PREFERRED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort suppliers"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={SELECT_CLASS}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-[12px] text-[#9A9DA1]">
        {filtered.length} of {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}
      </p>

      {/* Table */}
      <DataTable
        columns={[
          { label: 'Supplier' },
          { label: 'Category' },
          { label: 'Main contact' },
          { label: 'Status' },
          { label: 'Overall' },
          { label: 'Reliability' },
          { label: 'Price stability' },
          { label: 'Delivery' },
          { label: 'Compliance' },
          { label: 'Last order' },
          { label: '', align: 'right' },
        ]}
        rows={rows}
        empty="No suppliers match these filters."
      />

      {toastNode}
    </div>
  );
}
