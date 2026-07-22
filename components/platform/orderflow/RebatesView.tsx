'use client';

/**
 * OrderFlow Rebates — per-customer standing rebate %.
 *
 * The page lists ONLY the customers that actually have a rebate. You add one
 * via "New rebate" (pick a customer, set a %); it then appears in the list
 * where the % stays inline-editable and can be removed. Whatever is set here is
 * snapshotted onto that customer's future invoices at creation and auto-deducted
 * from the total (off the subtotal, after any discount, before VAT).
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
import { useToast } from './ui';
import { CustomerSelect } from './builder';
import {
  EmptyState,
  SearchInput,
  Modal,
  Field,
  inputClass,
  PrimaryBtn,
  SecondaryBtn,
  ConfirmDialog,
} from '@/components/platform/coredata/ui';

/**
 * True when a Supabase error really means rebates.sql hasn't been run yet.
 * Kept tight on purpose: the real PostgREST miss is "Could not find the
 * 'rebate_pct' column … in the schema cache". A broad "column"/"does not exist"
 * match would swallow legitimate post-migration errors (e.g. not-null / check
 * violations mention "column") and wrongly tell the user to run the migration.
 */
const MISSING_COLUMN_RE = /rebate_pct|could not find|schema cache/i;

/** Normalise a customer's stored rebate to a clean number (0 = none). */
function rebateOf(c: OfCustomer): number {
  const n = Number(c.rebate_pct);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Display string for an inline rebate field. */
function rebateStr(c: OfCustomer): string {
  const n = rebateOf(c);
  return n > 0 ? String(n) : '';
}

/**
 * Parse a raw rebate input. Returns a clamped positive number, `null` for
 * "no rebate" (blank / ≤ 0), or `'invalid'` for non-numeric junk.
 */
function parseRebate(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(/[%\s]/g, ''));
  if (!Number.isFinite(n)) return 'invalid';
  return n > 0 ? Math.min(100, n) : null;
}

export function RebatesView({ customers }: { customers: OfCustomer[] }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OfCustomer | null>(null);

  // New-rebate modal state.
  const [showNew, setShowNew] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [newPct, setNewPct] = useState('');
  const [saving, setSaving] = useState(false);

  // Only customers that currently have a rebate are listed.
  const rebated = useMemo(
    () => customers.filter((c) => rebateOf(c) > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  // Candidates for a new rebate: everyone who isn't already on one.
  const candidates = useMemo(() => customers.filter((c) => rebateOf(c) === 0), [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rebated;
    return rebated.filter((c) => `${c.name} ${c.trading_name ?? ''}`.toLowerCase().includes(q));
  }, [rebated, search]);

  // Core write. `value` null clears the rebate. Returns success so callers can
  // close their UI only on a real save.
  async function writeRebate(customer: OfCustomer, value: number | null): Promise<boolean> {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return false;
    }
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
      return false;
    }
    toast(value == null ? `Rebate removed for ${customer.name}` : `Rebate set to ${value}% for ${customer.name}`);
    router.refresh();
    return true;
  }

  // Inline edit of an existing row's %.
  async function saveInline(customer: OfCustomer, raw: string) {
    const parsed = parseRebate(raw);
    if (parsed === 'invalid') {
      toast('Enter a number, e.g. 5');
      return;
    }
    if ((parsed ?? 0) === rebateOf(customer)) return; // no-op
    await writeRebate(customer, parsed);
  }

  // Create a rebate from the modal.
  async function createRebate() {
    if (saving) return;
    const customer = candidates.find((c) => c.id === newCustomerId);
    if (!customer) {
      toast('Pick a customer.');
      return;
    }
    const parsed = parseRebate(newPct);
    if (parsed === 'invalid' || parsed == null) {
      toast('Enter a rebate %, e.g. 5');
      return;
    }
    setSaving(true);
    const ok = await writeRebate(customer, parsed);
    setSaving(false);
    if (ok) {
      setShowNew(false);
      setNewCustomerId(null);
      setNewPct('');
    }
  }

  function openNew() {
    setNewCustomerId(null);
    setNewPct('');
    setShowNew(true);
  }

  const hasRebates = rebated.length > 0;

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
        <PrimaryBtn onClick={openNew}>+ New rebate</PrimaryBtn>
      </div>

      {!hasRebates ? (
        <div className="mt-6">
          <EmptyState
            title="No rebates yet"
            body="Create a rebate for a customer — it's snapshotted onto their future invoices and auto-deducted from each total (after any discount, before VAT)."
            action={<PrimaryBtn onClick={openNew}>+ New rebate</PrimaryBtn>}
          />
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search customers on a rebate…" />
          </div>

          {/* Table */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                    <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                    <th className="px-2 py-2.5 text-right font-medium">Rebate %</th>
                    <th className="px-4 py-2.5 text-right font-medium">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
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
                                if (v.replace(/[%\s]/g, '') !== rebateStr(c)) void saveInline(c, v);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              disabled={busyId === c.id}
                              inputMode="decimal"
                              aria-label={`Rebate % for ${c.name}`}
                              className="h-8 w-[80px] rounded-lg border border-[#D7DAD8] bg-white px-2 text-right text-[13px] text-[#1A1C1E] tabular-nums placeholder:text-[#C9CCCA] focus:border-[#3E7BC4]/50 focus:outline-none disabled:opacity-50"
                            />
                            <span className="text-[12px] text-[#9A9DA1]">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setRemoving(c)}
                            disabled={busyId === c.id}
                            className="text-[12px] font-medium text-[#A32D2D] transition-colors hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="mt-4 text-[11px] text-[#9A9DA1]">
        The rebate is snapshotted onto each new invoice and deducted after any discount, before VAT. Rebates need
        supabase/rebates.sql to be run.
      </p>

      {/* New-rebate modal */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New rebate"
        subtitle="Set a standing rebate % for a customer. It's deducted from their future invoices automatically."
        footer={
          <>
            <SecondaryBtn onClick={() => setShowNew(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={createRebate} disabled={saving || !newCustomerId}>
              {saving ? 'Saving…' : 'Save rebate'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Customer">
            {candidates.length === 0 ? (
              <p className="text-[13px] text-[#9A9DA1]">
                {customers.length === 0
                  ? 'No customers yet — add customers in OrderFlow → Customers first.'
                  : 'Every customer already has a rebate. Edit or remove one in the list.'}
              </p>
            ) : (
              <CustomerSelect customers={candidates} value={newCustomerId} onChange={setNewCustomerId} />
            )}
          </Field>
          <Field label="Rebate %" hint="e.g. 5">
            <input
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createRebate();
              }}
              placeholder="0"
              inputMode="decimal"
              disabled={candidates.length === 0}
              className={`${inputClass} tabular-nums disabled:opacity-50`}
            />
          </Field>
        </div>
      </Modal>

      {/* Remove confirmation */}
      <ConfirmDialog
        open={removing != null}
        title="Remove rebate?"
        body={removing ? `${removing.name} will no longer have a rebate on future invoices. Existing invoices keep their snapshotted rebate.` : undefined}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const c = removing;
          setRemoving(null);
          if (c) void writeRebate(c, null);
        }}
      />
    </div>
  );
}
