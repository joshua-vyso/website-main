'use client';

/**
 * Quote detail — the printable DocSheet plus a toolbar: mark sent, convert to
 * order, convert to invoice, reject, and download PDF. Converted quotes show a
 * banner linking to the order/invoice they produced. All writes hit Supabase
 * directly (of_quotes + the shared create helpers) and log activity; converting
 * to an order also applies ProcurePulse stock via the order-stock endpoint.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { isoDatePlusDays, effectiveQuoteStatus, QUOTE_STATUS_STYLE, docTotals, zar2, type OfCustomer, type OfQuote, type OfQuoteItem, type OfSettings } from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';
import { DocSheet, PrintButton, type DocSheetLine } from './DocSheet';
import { createOrder, createInvoice, type BuilderLine } from './builder';
import { useToast } from './ui';
import { ConfirmDialog } from '@/components/platform/coredata/ui';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function linesFromItems(items: OfQuoteItem[]): BuilderLine[] {
  return items.map((it, i) => ({
    key: `q${it.id}_${i}`,
    stock_item_id: it.stock_item_id,
    name: it.name,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    unit_price: Number(it.unit_price) || 0,
    source: 'none',
    override_note: it.override_note ?? null,
  }));
}

export function QuoteDetail({
  quote,
  items,
  customer,
  companyProfile,
  settings,
  orgName,
}: {
  quote: OfQuote | null;
  items: OfQuoteItem[];
  customer: OfCustomer | null;
  companyProfile: CdCompanyProfile | null;
  settings: OfSettings;
  orgName: string | null;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [busy, setBusy] = useState<null | 'sent' | 'order' | 'invoice' | 'reject'>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  // Download-from-list deep link (?print=1) auto-opens the print dialog once.
  // Read from window rather than useSearchParams to avoid a prerender CSR bailout.
  useEffect(() => {
    if (quote && new URLSearchParams(window.location.search).get('print') === '1') {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [quote]);

  const eff = quote ? effectiveQuoteStatus(quote) : 'draft';
  const total = useMemo(() => (quote ? docTotals(items, quote.vat_rate).total : 0), [quote, items]);

  if (!quote) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Quote not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">It may have been deleted.</p>
        <Link href="/app/orderflow/quotes" className="mt-3 inline-block text-[13px] font-medium text-[#1E5E54] hover:underline">
          ← Back to quotes
        </Link>
      </div>
    );
  }

  const q = quote;
  const converted = !!(q.converted_order_id || q.converted_invoice_id);
  const decided = eff === 'accepted' || eff === 'rejected' || eff === 'expired';

  const sheetLines: DocSheetLine[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    unit_price: Number(it.unit_price) || 0,
  }));

  const meta = [
    { label: 'Issued', value: fmtDate(q.issue_date) },
    { label: 'Valid until', value: fmtDate(q.valid_until) },
    ...(q.customer_po ? [{ label: 'Customer PO', value: q.customer_po }] : []),
  ];

  const statusStyle = QUOTE_STATUS_STYLE[eff];

  async function markSent() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy('sent');
    const { error } = await supabase
      .from('of_quotes')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', q.id);
    setBusy(null);
    if (error) {
      toast(`Couldn't update: ${error.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'quote',
      entityId: q.id,
      customerId: q.customer_id,
      event: 'quote_sent',
      description: 'Quote marked as sent',
    });
    toast('Quote marked as sent');
    router.refresh();
  }

  async function convertToOrder() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy('order');
    try {
      const res = await createOrder(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId: q.customer_id,
        lines: linesFromItems(items),
        notes: q.notes ?? null,
        deliveryAddress: q.delivery_address ?? null,
        customerPo: q.customer_po ?? null,
        quoteId: q.id,
      });
      // Reflect the sale in ProcurePulse stock — the same fire-and-forget call
      // every other order-creation path makes.
      await fetch('/api/orderflow/order-stock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: res.id, action: 'apply' }),
      }).catch(() => {});
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'quote',
        entityId: q.id,
        customerId: q.customer_id,
        event: 'quote_converted',
        description: `Converted to order ${res.number}`,
      });
      toast(`Order ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/orders/${res.id}`);
    } catch (e) {
      setBusy(null);
      toast(e instanceof Error ? e.message : 'Could not convert the quote.');
    }
  }

  async function convertToInvoice() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy('invoice');
    const todayIso = new Date().toISOString().slice(0, 10);
    const termDays = customer?.payment_terms_days ?? settings.default_payment_terms_days;
    try {
      const res = await createInvoice(supabase, {
        orgId: org.id,
        actorEmail: email,
        customer,
        customerId: q.customer_id,
        lines: linesFromItems(items),
        vatRate: q.vat_rate,
        issueDate: todayIso,
        dueDate: termDays != null ? isoDatePlusDays(todayIso, termDays) : null,
        customerPo: q.customer_po ?? null,
        deliveryAddress: q.delivery_address ?? null,
        notes: q.notes ?? null,
        quoteId: q.id,
      });
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'quote',
        entityId: q.id,
        customerId: q.customer_id,
        event: 'quote_converted',
        description: `Converted to invoice ${res.number}`,
      });
      toast(`Invoice ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/invoices/${res.id}`);
    } catch (e) {
      setBusy(null);
      toast(e instanceof Error ? e.message : 'Could not convert the quote.');
    }
  }

  async function reject() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setConfirmReject(false);
    setBusy('reject');
    const { error } = await supabase
      .from('of_quotes')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', q.id);
    setBusy(null);
    if (error) {
      toast(`Couldn't update: ${error.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'quote',
      entityId: q.id,
      customerId: q.customer_id,
      event: 'quote_rejected',
      description: 'Quote rejected',
    });
    toast('Quote rejected');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {toastNode}

      {/* Toolbar (hidden in print via DocSheet's PRINT_CSS scoping) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/orderflow/quotes" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
            ← Quotes
          </Link>
          <span className="text-[13px] tabular-nums text-[#9A9DA1]">{zar2(total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {eff === 'draft' ? (
            <button
              type="button"
              onClick={() => void markSent()}
              disabled={!!busy}
              className="inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/50 disabled:opacity-50"
            >
              {busy === 'sent' ? 'Sending…' : 'Mark sent'}
            </button>
          ) : null}
          {!converted ? (
            <>
              <button
                type="button"
                onClick={() => void convertToOrder()}
                disabled={!!busy}
                className="inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/50 disabled:opacity-50"
              >
                {busy === 'order' ? 'Converting…' : 'Convert to order'}
              </button>
              <button
                type="button"
                onClick={() => void convertToInvoice()}
                disabled={!!busy}
                className="inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/50 disabled:opacity-50"
              >
                {busy === 'invoice' ? 'Converting…' : 'Convert to invoice'}
              </button>
            </>
          ) : null}
          {!decided && !converted ? (
            <button
              type="button"
              onClick={() => setConfirmReject(true)}
              disabled={!!busy}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7] disabled:opacity-50"
            >
              Reject
            </button>
          ) : null}
          <PrintButton />
        </div>
      </div>

      {/* Converted banners */}
      {q.converted_order_id ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6E7DF] bg-[#F1F7F4] px-4 py-3 text-[13px]">
          <span className="text-[#1A1C1E]">This quote was converted to an order.</span>
          <Link href={`/app/orderflow/orders/${q.converted_order_id}`} className="font-medium text-[#1E5E54] hover:underline">
            View order →
          </Link>
        </div>
      ) : null}
      {q.converted_invoice_id ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6E7DF] bg-[#F1F7F4] px-4 py-3 text-[13px]">
          <span className="text-[#1A1C1E]">This quote was converted to an invoice.</span>
          <Link href={`/app/orderflow/invoices/${q.converted_invoice_id}`} className="font-medium text-[#1E5E54] hover:underline">
            View invoice →
          </Link>
        </div>
      ) : null}

      {/* Printable quote sheet */}
      <DocSheet
        title="Quote"
        number={q.quote_number}
        statusPill={{ label: statusStyle.label, bg: statusStyle.bg, fg: statusStyle.fg }}
        companyProfile={companyProfile}
        orgName={orgName}
        customer={customer}
        deliverTo={q.delivery_address}
        meta={meta}
        lines={sheetLines}
        vatRate={q.vat_rate}
        notes={q.notes}
        terms={companyProfile?.terms ?? null}
      />

      <ConfirmDialog
        open={confirmReject}
        title="Reject this quote?"
        body="It will be marked rejected. You can still convert it later if the customer changes their mind."
        confirmLabel="Reject quote"
        danger
        onConfirm={() => void reject()}
        onClose={() => setConfirmReject(false)}
      />
    </div>
  );
}
