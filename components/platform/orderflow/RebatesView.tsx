'use client';

/**
 * OrderFlow Rebates — a per-customer standing rebate %.
 *
 * Every customer is listed with an inline, editable rebate % field. Whatever you
 * set here is snapshotted onto that customer's future invoices at creation and
 * auto-deducted from the total (off the subtotal, after any discount, before
 * VAT). Blank / 0 / negative means "no rebate" (stored as null).
 *
 * Writes are org-scoped to of_customers.rebate_pct, then toast + refresh.
 * Migration-safe: rebate_pct lives in supabase/rebates.sql — if it hasn't been
 * run yet the update surfaces a "could not find the column" error, which we turn
 * into a clear one-liner instead of crashing (mirrors the drop-missing pattern
 * in PriceListsView.tsx).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import type { OfCustomer } from '@/lib/platform/orderflow';
import { Kpi, useToast } from './ui';
import { EmptyState, SearchInput } from '@/components/platform/coredata/ui';

/** True when a Supabase error really means rebates.sql hasn't been run yet. */
const MISSING_COLUMN_RE = /rebate_pct|could not find|schema cache|does not exist|column/i;

/** Normalise a customer's stored rebate to a clean number (0 = none). */
function rebateOf(c: OfCustomer): number {
  const n = Number(c.rebate_pct);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Display string for the rebate field's default value ('' = none). */
function rebateStr(c: OfCustomer): string {
  const n = rebateOf(c);
  return n > 0 ? String(n) : '';
}

export function RebatesView({ customers }: { customers: OfCustomer[] }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.name} ${c.trading_name ?? ''}`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const onRebateCount = useMemo(() => customers.filter((c) => rebateOf(c) > 0).length, [customers]);

  // Persist a customer's rebate %. A value ≤ 0 or blank clears it (null).
  async function saveRebate(customer: OfCustomer, raw: string) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const trimmed = raw.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(/[%\s]/g, ''));
    if (parsed != null && !Number.isFinite(parsed)) {
      toast('Enter a number, e.g. 5');
      return;
    }
    // ≤ 0 or blank → no rebate (null) so it cleanly falls out of invoice maths.
    // Cap at 100% — a rebate can't exceed the invoice value.
    const value = parsed != null && parsed > 0 ? Math.min(100, parsed) : null;

    // No-op if unchanged.
    const current = rebateOf(customer);
    if ((value ?? 0) === current) return;

    setBusyId(customer.id);
    const { error } = await supabase
      .from('of_customers')
      .update({ rebate_pct: value })
      .eq('id', customer.id)
      .eq('org_id', org.id);
    setBusyId(null);
    if (error) {
      toast(
        MISSING_COLUMN_RE.test(error.message)
          ? 'Run supabase/rebates.sql in your Supabase SQL editor'
          : error.message,
      );
      return;
    }
    toast(value == null ? `Rebate cleared for ${customer.name}` : `Rebate set to ${value}% for ${customer.name}`);
    router.refresh();
  }

  const hasAny = customers.length > 0;

  return (
    <div>
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Rebates</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            A standing rebate % per customer — auto-deducted from that customer&apos;s future invoices (after any
            discount, before VAT).
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Customers" value={String(customers.length)} />
        <Kpi
          label="On a rebate"
          value={String(onRebateCount)}
          accent={onRebateCount > 0 ? '#0F6E56' : undefined}
        />
      </div>

      {/* Search */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-right font-medium">Rebate %</th>
              </tr>
            </thead>
            <tbody>
              {!hasAny ? (
                <tr>
                  <td colSpan={2} className="p-0">
                    <div className="px-4 py-8">
                      <EmptyState
                        title="No customers yet"
                        body="Add customers in OrderFlow → Customers, then set a standing rebate % here. It's auto-deducted from each customer's future invoices."
                      />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                    No customers match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1C1E]">{c.name}</div>
                      {c.trading_name ? (
                        <div className="max-w-[280px] truncate text-[11px] text-[#9A9DA1]">{c.trading_name}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          key={rebateStr(c)}
                          defaultValue={rebateStr(c)}
                          placeholder="—"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v.replace(/[%\s]/g, '') !== rebateStr(c)) void saveRebate(c, v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          disabled={busyId === c.id}
                          inputMode="decimal"
                          aria-label={`Rebate % for ${c.name}`}
                          className="h-8 w-[80px] rounded-lg border border-[#D7DAD8] bg-white px-2 text-right text-[13px] text-[#1A1C1E] tabular-nums placeholder:text-[#C9CCCA] focus:border-[#1E5E54]/50 focus:outline-none disabled:opacity-50"
                        />
                        <span className="text-[12px] text-[#9A9DA1]">%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-[#9A9DA1]">
        The rebate is snapshotted onto each new invoice and deducted after any discount, before VAT. Blank or 0 means no
        rebate. Rebates need supabase/rebates.sql to be run.
      </p>
    </div>
  );
}
