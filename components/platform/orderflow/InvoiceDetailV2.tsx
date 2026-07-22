'use client';

/**
 * Invoice detail — the printable DocSheet plus a toolbar (send, record
 * payment, duplicate, credit note, cancel, download PDF) and side panels for
 * payments (with balance summary), credit notes, attached documents and the
 * activity feed. Status is always the EFFECTIVE one derived from payments and
 * the due date, with credit-note totals subtracted from the balance.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useIsAdmin } from '@/components/platform/RoleGate';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  PAYMENT_METHODS,
  balanceDue,
  docTotals,
  effectiveInvoiceStatus,
  paymentsTotal,
  zar2,
  type OfCreditNote,
} from '@/lib/platform/orderflow';
import type { InvoiceDetailData } from '@/lib/platform/orderflow-data';
import { PrintButton, type DocSheetLine } from './DocSheet';
import { InvoiceSheetClassic } from './InvoiceSheetClassic';
import { RecordPaymentModal } from './PaymentModal';
import { ActivityFeed } from './ActivityFeed';
import { AttachDocuments } from './AttachDocuments';
import { useToast } from './ui';
import { ConfirmDialog } from '@/components/platform/coredata/ui';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function methodLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

const toolbarBtn =
  'inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/50 disabled:opacity-50';

export function InvoiceDetailV2({ data, orgName }: { data: InvoiceDetailData; orgName: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [busy, setBusy] = useState<null | 'send' | 'cancel'>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { invoice, items, payments, creditNotes, creditNoteItems, customer, order, companyProfile, documents, activity } = data;

  // Download-from-list deep link (?print=1) auto-opens the print dialog once.
  useEffect(() => {
    if (invoice && searchParams?.get('print') === '1') {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [invoice, searchParams]);

  const totals = useMemo(
    () => docTotals(items, invoice?.vat_rate ?? 0, invoice?.discount ?? 0, invoice?.rebate_pct ?? 0),
    [items, invoice?.vat_rate, invoice?.discount, invoice?.rebate_pct],
  );
  const paid = useMemo(() => paymentsTotal(payments), [payments]);
  const cnTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const cn of creditNotes) {
      m.set(cn.id, docTotals(creditNoteItems.filter((ci) => ci.credit_note_id === cn.id), cn.vat_rate).total);
    }
    return m;
  }, [creditNotes, creditNoteItems]);
  const credited = useMemo(() => [...cnTotals.values()].reduce((s, v) => s + v, 0), [cnTotals]);

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Invoice not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">It may have been deleted, or the link is stale.</p>
        <Link href="/app/orderflow/invoices" className="mt-3 inline-block text-[13px] font-medium text-[#1F5FA8] hover:underline">
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const inv = invoice;
  const eff = effectiveInvoiceStatus(inv, paid, totals.total);
  const balance = balanceDue(totals.total, paid, credited);

  const settled = eff === 'draft' || eff === 'cancelled' || eff === 'credited';
  // Editing/cancelling an invoice, recording a payment and issuing a credit note are
  // money actions the RLS layer now restricts to owner/admin — hide them for members so
  // they never click a control that would fail. Members keep view / duplicate / email.
  const isAdmin = useIsAdmin();
  const canPay = isAdmin && !settled && balance > 0;
  const canCredit = isAdmin && !settled;
  const canCancel = isAdmin && paid <= 0.005 && credited <= 0.005 && eff !== 'cancelled' && eff !== 'credited' && eff !== 'paid';

  const sheetLines: DocSheetLine[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    unit_price: Number(it.unit_price) || 0,
  }));

  async function markSent() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy('send');
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('of_invoices')
      .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
      .eq('id', inv.id);
    setBusy(null);
    if (error) {
      toast(`Couldn't update: ${error.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'invoice',
      entityId: inv.id,
      customerId: inv.customer_id,
      event: 'invoice_sent',
      description: `${inv.invoice_number} marked as sent`,
    });
    toast('Invoice marked as sent');
    router.refresh();
  }

  async function cancelInvoice() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setConfirmCancel(false);
    setBusy('cancel');
    const { error } = await supabase
      .from('of_invoices')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', inv.id);
    setBusy(null);
    if (error) {
      toast(`Couldn't update: ${error.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'invoice',
      entityId: inv.id,
      customerId: inv.customer_id,
      event: 'invoice_cancelled',
      description: `${inv.invoice_number} cancelled`,
    });

    // If this invoice was generated from an order, revert the order so it isn't
    // stranded pointing at a cancelled invoice with stock still applied: put the
    // order back to 'confirmed', clear the invoice link, and reverse the sale
    // in ProcurePulse stock (same call generateInvoice made with 'apply').
    if (inv.order_id) {
      const { error: orderErr } = await supabase
        .from('of_orders')
        .update({ status: 'confirmed', invoice_id: null, invoice_number: null, updated_at: new Date().toISOString() })
        .eq('id', inv.order_id);
      if (orderErr) {
        console.warn('order revert on invoice cancel failed:', orderErr.message);
      } else {
        await fetch('/api/orderflow/order-stock', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: inv.order_id, action: 'reverse' }),
        }).catch(() => {});
        logActivity(supabase, {
          orgId: org.id,
          actorEmail: email,
          entityType: 'order',
          entityId: inv.order_id,
          customerId: inv.customer_id,
          event: 'order_status_changed',
          description: `Reverted to confirmed — invoice ${inv.invoice_number} cancelled, stock returned`,
        });
      }
    }

    toast('Invoice cancelled');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {toastNode}

      {/* Toolbar (hidden in print via DocSheet's PRINT_CSS scoping) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/orderflow/invoices" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
            ← Invoices
          </Link>
          <span className="text-[13px] tabular-nums text-[#9A9DA1]">{zar2(totals.total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eff === 'draft' && isAdmin ? (
            <>
              <Link href={`/app/orderflow/invoices/new?edit=${inv.id}`} className={toolbarBtn}>
                Edit draft
              </Link>
              <button type="button" onClick={() => void markSent()} disabled={!!busy} className={toolbarBtn}>
                {busy === 'send' ? 'Sending…' : 'Mark sent'}
              </button>
            </>
          ) : null}
          {canPay ? (
            <button type="button" onClick={() => setPayOpen(true)} disabled={!!busy} className={toolbarBtn}>
              Record payment
            </button>
          ) : null}
          <Link href={`/app/orderflow/invoices/new?duplicate=${inv.id}`} className={toolbarBtn}>
            Duplicate
          </Link>
          {canCredit ? (
            <Link href={`/app/orderflow/credit-notes/new?invoice=${inv.id}`} className={toolbarBtn}>
              Credit note
            </Link>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={!!busy}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7] disabled:opacity-50"
            >
              Cancel invoice
            </button>
          ) : null}
          <button type="button" onClick={() => toast('Send via email · soon')} className={toolbarBtn}>
            Email
          </button>
          <PrintButton />
        </div>
      </div>

      {/* Linked-order banner */}
      {order ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6E7DF] bg-[#F1F7F4] px-4 py-3 text-[13px]">
          <span className="text-[#1A1C1E]">
            Created from order {order.order_number ?? `#${order.id.slice(0, 6).toUpperCase()}`}.
          </span>
          <Link href={`/app/orderflow/orders/${order.id}`} className="font-medium text-[#1F5FA8] hover:underline">
            View order →
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Printable invoice sheet — the classic SA tax-invoice template. */}
        <InvoiceSheetClassic
          companyProfile={companyProfile}
          orgName={orgName}
          customer={customer}
          invoice={{
            number: inv.invoice_number,
            issueDate: inv.issue_date,
            dueDate: inv.due_date,
            customerPo: inv.customer_po,
            termsText: inv.terms ?? customer?.invoice_terms_text ?? null,
            note: inv.notes ?? customer?.invoice_note ?? null,
          }}
          lines={sheetLines}
          vatTreatment={customer?.vat_treatment ?? 'zero_rated'}
          vatRate={inv.vat_rate}
          discount={inv.discount}
          rebatePct={inv.rebate_pct ?? 0}
        />

        {/* Side panels */}
        <div className="space-y-5">
          {/* Payments + balance summary */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#1A1C1E]">Payments</h3>
              {canPay ? (
                <button
                  type="button"
                  onClick={() => setPayOpen(true)}
                  className="inline-flex h-8 items-center rounded-lg border border-[#D7DAD8] bg-white px-3 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40"
                >
                  + Record
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl border border-[#E7E7E2] bg-[#FBFBF9] p-3 text-[13px]">
              {totals.rebate > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">Rebate ({inv.rebate_pct ?? 0}%)</span>
                  <span className="tabular-nums text-[#1A1C1E]">−{zar2(totals.rebate)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[#5F6368]">Total</span>
                <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6368]">Paid</span>
                <span className="tabular-nums text-[#0F6E56]">{zar2(paid)}</span>
              </div>
              {credited > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">Credited</span>
                  <span className="tabular-nums text-[#5B3FA8]">−{zar2(credited)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#E7E7E2] pt-1.5 font-semibold">
                <span className="text-[#1A1C1E]">Balance due</span>
                <span className={`tabular-nums ${balance > 0 ? 'text-[#854F0B]' : 'text-[#0F6E56]'}`}>{zar2(balance)}</span>
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="mt-3 text-[13px] text-[#9A9DA1]">No payments recorded yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#F0F0EC]">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#1A1C1E]">{methodLabel(p.method)}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#9A9DA1]">
                        {fmtDate(p.paid_on)}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] tabular-nums font-medium text-[#0F6E56]">{zar2(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Credit notes */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#1A1C1E]">Credit notes</h3>
              {canCredit ? (
                <Link
                  href={`/app/orderflow/credit-notes/new?invoice=${inv.id}`}
                  className="inline-flex h-8 items-center rounded-lg border border-[#D7DAD8] bg-white px-3 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40"
                >
                  + Create
                </Link>
              ) : null}
            </div>
            {creditNotes.length === 0 ? (
              <p className="mt-3 text-[13px] text-[#9A9DA1]">No credit notes against this invoice.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#F0F0EC]">
                {creditNotes.map((cn: OfCreditNote) => (
                  <li key={cn.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/app/orderflow/credit-notes/${cn.id}`}
                        className="block truncate text-[13px] font-medium text-[#1F5FA8] hover:underline"
                      >
                        {cn.credit_number}
                      </Link>
                      <div className="mt-0.5 truncate text-[11px] text-[#9A9DA1]">
                        {fmtDate(cn.issue_date)}
                        {cn.reason ? ` · ${cn.reason}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] tabular-nums font-medium text-[#5B3FA8]">−{zar2(cnTotals.get(cn.id) ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Documents */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <AttachDocuments entityType="invoice" entityId={inv.id} customerId={inv.customer_id} documents={documents} documentType="invoice" />
          </div>

          {/* Activity */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h3 className="text-[13px] font-semibold text-[#1A1C1E]">Activity</h3>
            <div className="mt-3">
              <ActivityFeed events={activity} emptyLabel="No activity on this invoice yet." />
            </div>
          </div>
        </div>
      </div>

      {/* Record payment — total is net of credit notes so the default amount
          and the status recompute both land on the true balance. */}
      <RecordPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        invoice={inv}
        paidSoFar={paid}
        total={Math.max(0, totals.total - credited)}
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${inv.invoice_number}?`}
        body={
          inv.order_id
            ? "The invoice stays on record as cancelled and won't count towards your numbers. Its order will be reverted to confirmed and the sold stock returned, so you can re-invoice it."
            : "The invoice stays on record as cancelled — it won't count towards your numbers."
        }
        confirmLabel="Cancel invoice"
        danger
        onConfirm={() => void cancelInvoice()}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
