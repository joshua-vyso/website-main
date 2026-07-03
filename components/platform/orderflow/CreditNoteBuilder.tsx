'use client';

/**
 * New-credit-note builder — credit a customer against an existing invoice. When
 * no source invoice was passed in the URL the builder first shows a picker of
 * invoices with an outstanding balance; once an invoice is chosen its line
 * items are listed with a per-line checkbox + editable credit qty (≤ invoiced
 * qty, prefilled to full), a "credit everything" toggle, a REQUIRED reason and
 * optional notes. When the source invoice carries a rand discount, credit line
 * prices are stored discount-adjusted (scaled by the invoice's discount factor)
 * so a full credit never exceeds what was actually billed — and every
 * downstream recomputation of the credited amount stays consistent. Issuing
 * inserts of_credit_notes + of_credit_note_items, then
 * updates the invoice: if the balance due (total − paid − credited) drops to
 * zero while it isn't fully paid, its stored status becomes 'credited'. Writes
 * go straight to Supabase and log a credit_note_issued activity event.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { nextDocNumber } from './builder';
import { useToast } from './ui';
import { EmptyState, Field, SearchInput } from '@/components/platform/coredata/ui';
import {
  balanceDue,
  docTotals,
  paymentsTotal,
  setupMessage,
  zar2,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfCustomer,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
} from '@/lib/platform/orderflow';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface CreditLine {
  invoice_item_id: string;
  stock_item_id: string | null;
  name: string;
  unit: string | null;
  unit_price: number;
  invoicedQty: number;
  creditQty: number;
  checked: boolean;
}

export function CreditNoteBuilder({
  invoices,
  invoiceItems,
  payments,
  creditNotes,
  creditNoteItems,
  customers,
  initialInvoiceId,
}: {
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  customers: OfCustomer[];
  initialInvoiceId: string | null;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const itemsByInvoice = useMemo(() => {
    const m = new Map<string, OfInvoiceItem[]>();
    for (const it of invoiceItems) (m.get(it.invoice_id) ?? m.set(it.invoice_id, []).get(it.invoice_id)!).push(it);
    return m;
  }, [invoiceItems]);
  const paymentsByInvoice = useMemo(() => {
    const m = new Map<string, OfPayment[]>();
    for (const p of payments) (m.get(p.invoice_id) ?? m.set(p.invoice_id, []).get(p.invoice_id)!).push(p);
    return m;
  }, [payments]);
  const creditItemsByNote = useMemo(() => {
    const m = new Map<string, OfCreditNoteItem[]>();
    for (const it of creditNoteItems) (m.get(it.credit_note_id) ?? m.set(it.credit_note_id, []).get(it.credit_note_id)!).push(it);
    return m;
  }, [creditNoteItems]);

  /** Total already credited against an invoice (sum over its credit notes' items at each note's VAT rate). */
  const creditedByInvoice = useMemo(() => {
    const m = new Map<string, number>();
    for (const cn of creditNotes) {
      if (!cn.invoice_id) continue;
      const its = creditItemsByNote.get(cn.id) ?? [];
      const amt = docTotals(its, cn.vat_rate).total;
      m.set(cn.invoice_id, (m.get(cn.invoice_id) ?? 0) + amt);
    }
    return m;
  }, [creditNotes, creditItemsByNote]);

  /** Invoices with money still owing — the only ones worth crediting. */
  const outstanding = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== 'cancelled')
      .map((inv) => {
        const its = itemsByInvoice.get(inv.id) ?? [];
        const total = docTotals(its, inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
        const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
        const credited = creditedByInvoice.get(inv.id) ?? 0;
        const balance = balanceDue(total, paid, credited);
        const name = (inv.customer_id && customerById.get(inv.customer_id)?.name) || 'No customer';
        return { inv, total, paid, credited, balance, name, itemCount: its.length };
      })
      .filter((r) => r.balance > 0.005)
      .sort((a, b) => (b.inv.created_at || '').localeCompare(a.inv.created_at || ''));
  }, [invoices, itemsByInvoice, paymentsByInvoice, creditedByInvoice, customerById]);

  // Selected invoice (from the URL or the picker).
  const initialValid = initialInvoiceId && invoices.some((i) => i.id === initialInvoiceId) ? initialInvoiceId : null;
  const [invoiceId, setInvoiceId] = useState<string | null>(initialValid);
  const [pickerSearch, setPickerSearch] = useState('');

  const invoice = useMemo(() => (invoiceId ? invoices.find((i) => i.id === invoiceId) ?? null : null), [invoiceId, invoices]);
  const customer = invoice?.customer_id ? customerById.get(invoice.customer_id) ?? null : null;
  const invoiceLines = useMemo(() => (invoiceId ? itemsByInvoice.get(invoiceId) ?? [] : []), [invoiceId, itemsByInvoice]);

  // When the invoice carries a rand discount, credits are raised at
  // proportionally reduced unit prices (factor = discounted subtotal / plain
  // subtotal over ALL invoice lines) so "credit everything" matches what was
  // billed. Credit-note recomputations elsewhere use docTotals with no
  // discount, so the adjustment MUST live in the stored prices themselves.
  const discountFactor = useMemo(() => {
    if (!invoice || !(Number(invoice.discount) > 0)) return 1;
    const subtotal = invoiceLines.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    if (subtotal <= 0) return 1;
    return (subtotal - Math.min(Number(invoice.discount) || 0, subtotal)) / subtotal;
  }, [invoice, invoiceLines]);
  /** A line's discount-adjusted unit price (rounded to 4dp for clean storage). */
  const adjPrice = (p: number) => Math.round((Number(p) || 0) * discountFactor * 10000) / 10000;

  // Editable credit lines (rebuilt whenever a new invoice is selected).
  const [lines, setLines] = useState<CreditLine[]>([]);
  const [selectedFor, setSelectedFor] = useState<string | null>(null);
  if (invoiceId && selectedFor !== invoiceId) {
    const sorted = invoiceLines.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    setLines(
      sorted.map((it) => ({
        invoice_item_id: it.id,
        stock_item_id: it.stock_item_id,
        name: it.name,
        unit: it.unit,
        unit_price: Number(it.unit_price) || 0,
        invoicedQty: Number(it.qty) || 0,
        creditQty: Number(it.qty) || 0,
        checked: true,
      })),
    );
    setSelectedFor(invoiceId);
  }

  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const creditEverything = lines.length > 0 && lines.every((l) => l.checked && Math.abs(l.creditQty - l.invoicedQty) <= 0.0005);

  const selectedLines = lines.filter((l) => l.checked && (Number(l.creditQty) || 0) > 0);
  const totals = useMemo(
    () => docTotals(selectedLines.map((l) => ({ qty: l.creditQty, unit_price: adjPrice(l.unit_price) })), invoice?.vat_rate ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLines, invoice, discountFactor],
  );

  function updateLine(id: string, patch: Partial<CreditLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.invoice_item_id !== id) return l;
        const next = { ...l, ...patch };
        // Clamp the credit qty to the invoiced qty (never credit more than billed).
        if (next.creditQty > next.invoicedQty) next.creditQty = next.invoicedQty;
        if (next.creditQty < 0) next.creditQty = 0;
        return next;
      }),
    );
  }

  function toggleEverything(on: boolean) {
    setLines((prev) => prev.map((l) => ({ ...l, checked: on, creditQty: on ? l.invoicedQty : l.creditQty })));
  }

  const reasonReady = reason.trim().length > 0;
  const canIssue = !!invoice && selectedLines.length > 0 && reasonReady && !busy;

  async function issue() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    if (!invoice) {
      toast('Pick an invoice to credit.');
      return;
    }
    if (!reasonReady) {
      toast('A reason is required for a credit note.');
      return;
    }
    if (selectedLines.length === 0) {
      toast('Select at least one line to credit.');
      return;
    }
    setBusy(true);
    try {
      const number = await nextDocNumber(supabase, 'credit_note');

      const { data: cn, error: cnErr } = await supabase
        .from('of_credit_notes')
        .insert({
          org_id: org.id,
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          credit_number: number,
          status: 'issued',
          reason: reason.trim(),
          notes: notes.trim() || null,
          issue_date: new Date().toISOString().slice(0, 10),
          vat_rate: invoice.vat_rate,
        })
        .select('id')
        .single();
      if (cnErr || !cn) throw new Error(cnErr?.message ?? 'Could not create the credit note.');

      const { error: itemErr } = await supabase.from('of_credit_note_items').insert(
        selectedLines.map((l) => ({
          org_id: org.id,
          credit_note_id: cn.id,
          invoice_item_id: l.invoice_item_id,
          name: l.name,
          qty: Number(l.creditQty) || 0,
          unit: l.unit,
          // Stored discount-adjusted so downstream recomputations (which apply
          // no discount) never credit more than the invoice actually billed.
          unit_price: adjPrice(l.unit_price),
        })),
      );
      if (itemErr) {
        await supabase.from('of_credit_notes').delete().eq('id', cn.id);
        throw new Error(itemErr.message);
      }

      // Recompute the invoice's outstanding balance INCLUDING this new note. If
      // it drops to zero while the invoice isn't fully paid, the invoice is now
      // effectively settled by credit → store status 'credited'. Otherwise the
      // stored status is left as-is (its displayed status stays derived).
      const total = docTotals(invoiceLines, invoice.vat_rate, invoice.discount, invoice.rebate_pct ?? 0).total;
      const paid = paymentsTotal(paymentsByInvoice.get(invoice.id) ?? []);
      const creditedBefore = creditedByInvoice.get(invoice.id) ?? 0;
      // Both sides of this sum are on the discount-adjusted basis (stored
      // credit prices are adjusted); cap at the invoice's discounted total so
      // rounding drift can never over-state the credit.
      const creditedNow = Math.min(creditedBefore + totals.total, total);
      if (balanceDue(total, paid, creditedNow) <= 0.005 && paid < total - 0.005) {
        const { error: updErr } = await supabase
          .from('of_invoices')
          .update({ status: 'credited', updated_at: new Date().toISOString() })
          .eq('id', invoice.id);
        if (updErr) console.warn('invoice → credited status update failed:', updErr.message);
      }

      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'credit_note',
        entityId: cn.id,
        customerId: invoice.customer_id,
        event: 'credit_note_issued',
        description: `${number} · ${zar2(totals.total)} against ${invoice.invoice_number}`,
      });

      toast(`Credit note ${number} issued`);
      router.refresh();
      router.push(`/app/orderflow/credit-notes/${cn.id}`);
    } catch (e) {
      setBusy(false);
      toast(setupMessage(e instanceof Error ? e.message : 'Could not issue the credit note.'));
    }
  }

  // ---------------------------------------------------------------------------
  // Invoice picker (no ?invoice=<id> given)
  // ---------------------------------------------------------------------------
  if (!invoiceId) {
    const q = pickerSearch.trim().toLowerCase();
    const rows = q
      ? outstanding.filter((r) => r.inv.invoice_number.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      : outstanding;
    return (
      <div className="mx-auto max-w-[880px]">
        {toastNode}
        <div className="flex items-center gap-3">
          <Link href="/app/orderflow/credit-notes" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
            ← Credit notes
          </Link>
        </div>
        <h1 className="mt-1 text-[26px] font-bold text-[#1A1C1E]">New credit note</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">Pick the invoice to credit — only invoices with an outstanding balance are shown.</p>

        {outstanding.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Nothing to credit"
              body="Every invoice is either fully paid, already credited or cancelled. Credit notes are raised against invoices that still owe a balance."
              action={
                <Link
                  href="/app/orderflow/invoices"
                  className="inline-flex h-9 items-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]"
                >
                  View invoices
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <SearchInput value={pickerSearch} onChange={setPickerSearch} placeholder="Search invoice # or customer…" />
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                      <th className="px-4 py-2.5 text-left font-medium">Invoice #</th>
                      <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                      <th className="px-2 py-2.5 text-left font-medium">Issued</th>
                      <th className="px-2 py-2.5 text-right font-medium">Total</th>
                      <th className="px-2 py-2.5 text-right font-medium">Balance due</th>
                      <th className="w-24 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                          No invoices match your search.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr
                          key={r.inv.id}
                          onClick={() => setInvoiceId(r.inv.id)}
                          className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]"
                        >
                          <td className="px-4 py-3 font-medium text-[#1A1C1E]">{r.inv.invoice_number}</td>
                          <td className="px-2 py-3 text-[#1A1C1E]">{r.name}</td>
                          <td className="px-2 py-3 text-[#5F6368]">{fmtDate(r.inv.issue_date)}</td>
                          <td className="px-2 py-3 text-right tabular-nums text-[#5F6368]">{zar2(r.total)}</td>
                          <td className="px-2 py-3 text-right tabular-nums font-medium text-[#854F0B]">{zar2(r.balance)}</td>
                          <td className="px-2 py-3 text-right">
                            <span className="text-[13px] font-medium text-[#1E5E54]">Credit →</span>
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
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Credit builder (an invoice is selected)
  // ---------------------------------------------------------------------------
  const numCell =
    'h-8 w-full rounded-md border border-[#E7E7E2] px-1.5 text-right text-[13px] tabular-nums text-[#1A1C1E] focus:border-[#1E5E54]/50 focus:outline-none disabled:bg-[#FBFBF9] disabled:text-[#9A9DA1]';

  return (
    <div className="mx-auto max-w-[880px]">
      {toastNode}

      <div className="flex items-center gap-3">
        <Link href="/app/orderflow/credit-notes" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
          ← Credit notes
        </Link>
      </div>
      <h1 className="mt-1 text-[26px] font-bold text-[#1A1C1E]">New credit note</h1>

      <div className="mt-6 space-y-5 rounded-2xl border border-[#E7E7E2] bg-white p-6">
        {/* Source invoice summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7E7E2] bg-[#FBFBF9] px-4 py-3">
          <div className="text-[13px]">
            <span className="text-[#9A9DA1]">Crediting invoice</span>{' '}
            <Link href={`/app/orderflow/invoices/${invoice!.id}`} className="font-medium text-[#1E5E54] hover:underline">
              {invoice!.invoice_number}
            </Link>
            {customer ? <span className="text-[#5F6368]"> · {customer.name}</span> : null}
          </div>
          {!initialValid ? (
            <button
              type="button"
              onClick={() => {
                setInvoiceId(null);
                setSelectedFor(null);
              }}
              className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]"
            >
              Change invoice
            </button>
          ) : null}
        </div>

        {/* Credit everything toggle */}
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#1A1C1E]">
          <input
            type="checkbox"
            checked={creditEverything}
            onChange={(e) => toggleEverything(e.target.checked)}
            className="h-4 w-4 rounded border-[#D7DAD8] text-[#1E5E54] focus:ring-[#1E5E54]/40"
          />
          <span className="font-medium">Credit everything on this invoice</span>
          <span className="text-[#9A9DA1]">— check to credit every line in full</span>
        </label>

        {/* Lines to credit */}
        <div>
          <div className="mb-2 text-[13px] font-medium text-[#1A1C1E]">Lines to credit</div>
          {discountFactor < 1 ? (
            <p className="mb-2 text-[12px] text-[#9A9DA1]">
              Unit prices reflect the invoice&apos;s {zar2(Number(invoice!.discount) || 0)} discount, so a full credit matches what was billed.
            </p>
          ) : null}
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#E7E7E2] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
              This invoice has no line items to credit.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E7E7E2]">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                    <th className="w-[44px] px-3 py-2 text-left font-medium" />
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="w-[80px] px-2 py-2 text-right font-medium">Invoiced</th>
                    <th className="w-[96px] px-2 py-2 text-right font-medium">Credit qty</th>
                    <th className="w-[116px] px-2 py-2 text-right font-medium">Unit price</th>
                    <th className="w-[110px] px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.invoice_item_id} className={`border-b border-[#F6F6F2] last:border-0 ${l.checked ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={l.checked}
                          onChange={(e) => updateLine(l.invoice_item_id, { checked: e.target.checked })}
                          className="h-4 w-4 rounded border-[#D7DAD8] text-[#1E5E54] focus:ring-[#1E5E54]/40"
                          aria-label={`Credit ${l.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-[#1A1C1E]">{l.name}</span>
                        {l.unit ? <span className="block text-[11px] text-[#9A9DA1]">per {l.unit}</span> : null}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{l.invoicedQty}</td>
                      <td className="px-2 py-2.5">
                        <input
                          value={String(l.creditQty)}
                          onChange={(e) => updateLine(l.invoice_item_id, { creditQty: Number(e.target.value) || 0 })}
                          inputMode="decimal"
                          disabled={!l.checked}
                          className={numCell}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{zar2(adjPrice(l.unit_price))}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1C1E]">
                        {zar2((l.checked ? Number(l.creditQty) || 0 : 0) * adjPrice(l.unit_price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reason + notes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Reason" hint="required">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged goods returned"
              className={`h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:outline-none ${
                reason.trim() ? 'border-[#D7DAD8] focus:border-[#1E5E54]/50' : 'border-[#D9A441]'
              }`}
            />
          </Field>
          <Field label="Notes" hint="shown on the credit note">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the customer should see"
              className="w-full rounded-lg border border-[#D7DAD8] bg-white px-3 py-2 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none"
            />
          </Field>
        </div>

        {/* Credit total */}
        <div className="flex justify-end border-t border-[#F0F0EC] pt-4">
          <div className="w-full max-w-[280px] space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Subtotal</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">VAT ({invoice!.vat_rate}%)</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.vat)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E7E7E2] pt-2 text-[16px] font-bold">
              <span className="text-[#1A1C1E]">Credit total</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        <Link
          href="/app/orderflow/credit-notes"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC]"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => void issue()}
          disabled={!canIssue}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Issuing…' : 'Issue credit note'}
        </button>
      </div>
    </div>
  );
}
