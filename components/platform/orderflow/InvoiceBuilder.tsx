'use client';

/**
 * Invoice builder — new invoices (blank, from a customer, or converting an
 * order/quote/duplicate) and draft editing. Customer selection auto-fills
 * billing address, due date (payment terms) and the default delivery address;
 * line prices resolve through the customer's Core Data price list, and a price
 * changed away from the resolved one requires a reason. Saving inserts
 * of_invoices + of_invoice_items (edit mode updates + reinserts items), logs
 * activity, then routes to the invoice detail.
 */

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  customerPriceList,
  formatAddress,
  resolvePrice,
  type CdCompanyProfile,
  type CdDeliveryAddress,
  type CdPriceList,
  type CdPriceOverride,
  type CdProduct,
  type PriceSource,
} from '@/lib/platform/coredata';
import {
  docTotals,
  isoDatePlusDays,
  setupMessage,
  zar2,
  type OfCustomer,
  type OfInvoice,
  type OfSettings,
} from '@/lib/platform/orderflow';
import { CustomerSelect, LineItemsEditor, createInvoice, type BuilderLine } from './builder';
import { useToast } from './ui';
import { Field, inputClass } from '@/components/platform/coredata/ui';

export interface InvoiceInitialLine {
  stock_item_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  override_note: string | null;
}

/** Prefill passed by the server page (?customer / ?order / ?quote / ?duplicate / ?edit). */
export interface InvoiceBuilderInitial {
  mode: 'new' | 'edit';
  /** Set in edit mode — the draft being edited. */
  editInvoice?: OfInvoice | null;
  customerId?: string | null;
  lines?: InvoiceInitialLine[];
  vatRate?: number | null;
  discount?: number | null;
  issueDate?: string | null;
  dueDate?: string | null;
  customerPo?: string | null;
  billingAddress?: string | null;
  deliveryAddress?: string | null;
  deliveryInstructions?: string | null;
  notes?: string | null;
  terms?: string | null;
  /** Converting: link back to the source order/quote on save. */
  orderId?: string | null;
  quoteId?: string | null;
  /** e.g. "order ORD-0007" — shown in the header; also the carried-price reason. */
  sourceLabel?: string | null;
}

const textareaClass =
  'w-full rounded-lg border border-[#D7DAD8] bg-white px-3 py-2 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none';

let lineSeq = 0;

export function InvoiceBuilder({
  customers,
  addresses,
  products,
  priceLists,
  overrides,
  settings,
  companyProfile,
  initial,
}: {
  customers: OfCustomer[];
  addresses: CdDeliveryAddress[];
  products: CdProduct[];
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  settings: OfSettings;
  companyProfile: CdCompanyProfile | null;
  initial: InvoiceBuilderInitial;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const isEdit = initial.mode === 'edit' && !!initial.editInvoice;
  const initialCustomer = customers.find((c) => c.id === initial.customerId) ?? null;

  const termsDaysFor = (c: OfCustomer | null) => c?.payment_terms_days ?? settings.default_payment_terms_days ?? 30;

  // ---- Form state ----
  const [customerId, setCustomerId] = useState<string | null>(initialCustomer ? initialCustomer.id : null);
  const [issueDate, setIssueDate] = useState(initial.issueDate ?? today);
  const [dueDate, setDueDate] = useState(
    initial.dueDate ?? isoDatePlusDays(initial.issueDate ?? today, termsDaysFor(initialCustomer)),
  );
  /** Once the user hand-picks a due date we stop recomputing it from terms. */
  const [dueTouched, setDueTouched] = useState(!!initial.dueDate);
  const [vatRate, setVatRate] = useState<number>(initial.vatRate ?? settings.default_vat_rate ?? 15);
  const [discount, setDiscount] = useState<string>(initial.discount ? String(initial.discount) : '');
  const [customerPo, setCustomerPo] = useState(initial.customerPo ?? '');
  const [billingAddress, setBillingAddress] = useState(initial.billingAddress ?? initialCustomer?.billing_address ?? '');
  // Fresh flows (blank or ?customer=) prefill the default Core Data delivery
  // address; edit/conversion flows keep exactly what the source doc had.
  const freshFlow = initial.mode === 'new' && !initial.sourceLabel;
  const defaultAddress = (() => {
    if (!freshFlow || !initialCustomer) return null;
    const own = addresses.filter((a) => a.customer_id === initialCustomer.id);
    return own.find((a) => a.is_default) ?? own[0] ?? null;
  })();
  const [deliveryAddress, setDeliveryAddress] = useState(
    initial.deliveryAddress ?? (defaultAddress ? formatAddress(defaultAddress) : ''),
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    initial.deliveryInstructions ?? defaultAddress?.instructions ?? '',
  );
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [terms, setTerms] = useState(initial.terms ?? companyProfile?.terms ?? '');
  const [busy, setBusy] = useState<null | 'draft' | 'sent'>(null);

  const [lines, setLines] = useState<BuilderLine[]>(() => {
    const src = initial.lines ?? [];
    if (src.length === 0) return [];
    // Prefilled lines keep their source-document prices; when a price no longer
    // matches the customer's current price list, carry a reason so the
    // override rule stays satisfied without blocking the conversion.
    const list = customerPriceList(initialCustomer, priceLists);
    return src.map((l) => {
      let source: PriceSource = 'none';
      let note = l.override_note;
      if (l.stock_item_id) {
        const product = products.find((p) => p.id === l.stock_item_id);
        if (product) {
          const r = resolvePrice(product, list, overrides);
          source = r.source;
          if (Math.abs(r.price - (Number(l.unit_price) || 0)) > 0.005 && !(note ?? '').trim()) {
            note = initial.sourceLabel ? `Carried from ${initial.sourceLabel}` : 'Carried over';
          }
        }
      }
      return {
        key: `il${lineSeq++}_${Date.now().toString(36)}`,
        stock_item_id: l.stock_item_id,
        name: l.name,
        qty: Number(l.qty) || 0,
        unit: l.unit,
        unit_price: Number(l.unit_price) || 0,
        source,
        override_note: note,
      };
    });
  });

  const customer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);
  const priceList = useMemo(() => customerPriceList(customer, priceLists), [customer, priceLists]);
  const discountNum = Math.max(0, Number(discount) || 0);
  const totals = useMemo(() => docTotals(lines, vatRate, discountNum), [lines, vatRate, discountNum]);

  // Auto-fill on customer change — skipped for the customer the page prefilled,
  // so edit/duplicate/conversion values survive the first render.
  const autofilledFor = useRef<string | null>(
    isEdit || initial.sourceLabel ? (initialCustomer?.id ?? null) : null,
  );
  function handleCustomerChange(id: string | null) {
    setCustomerId(id);
    if (!id || id === autofilledFor.current) return;
    autofilledFor.current = id;
    const c = customers.find((x) => x.id === id) ?? null;
    setBillingAddress(c?.billing_address ?? '');
    if (!dueTouched) setDueDate(isoDatePlusDays(issueDate, termsDaysFor(c)));
    const own = addresses.filter((a) => a.customer_id === id);
    const def = own.find((a) => a.is_default) ?? own[0] ?? null;
    setDeliveryAddress(def ? formatAddress(def) : '');
    if (def?.instructions) setDeliveryInstructions(def.instructions);
  }

  function handleIssueDateChange(v: string) {
    setIssueDate(v);
    if (!dueTouched && v) setDueDate(isoDatePlusDays(v, termsDaysFor(customer)));
  }

  // ---- Validation ----
  const resolvedById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.id, resolvePrice(p, priceList, overrides).price);
    return m;
  }, [products, priceList, overrides]);

  const linesReady = lines.length > 0 && lines.every((l) => l.name.trim().length > 0);
  const missingReason = lines.some((l) => {
    if (!l.stock_item_id) return false;
    const rp = resolvedById.get(l.stock_item_id);
    if (rp == null) return false;
    return Math.abs(rp - (Number(l.unit_price) || 0)) > 0.005 && !(l.override_note ?? '').trim();
  });
  const canSave = linesReady && !missingReason;

  // ---- Save ----
  async function save(mode: 'draft' | 'sent') {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    if (!canSave) {
      toast(!linesReady ? 'Add at least one line item.' : 'Add a reason for each changed price.');
      return;
    }
    setBusy(mode);
    try {
      if (isEdit && initial.editInvoice) {
        const inv = initial.editInvoice;
        const nowIso = new Date().toISOString();
        const { error: upErr } = await supabase
          .from('of_invoices')
          .update({
            customer_id: customerId,
            status: mode === 'sent' ? 'sent' : inv.status,
            issue_date: issueDate,
            due_date: dueDate || null,
            vat_rate: vatRate,
            discount: discountNum,
            customer_po: customerPo.trim() || null,
            billing_address: billingAddress.trim() || null,
            delivery_address: deliveryAddress.trim() || null,
            delivery_instructions: deliveryInstructions.trim() || null,
            notes: notes.trim() || null,
            terms: terms.trim() || null,
            sent_at: mode === 'sent' ? (inv.sent_at ?? nowIso) : inv.sent_at,
            updated_at: nowIso,
          })
          .eq('id', inv.id);
        if (upErr) throw new Error(upErr.message);

        const { error: delErr } = await supabase.from('of_invoice_items').delete().eq('invoice_id', inv.id);
        if (delErr) throw new Error(delErr.message);
        const { error: insErr } = await supabase.from('of_invoice_items').insert(
          lines.map((l, i) => ({
            org_id: org.id,
            invoice_id: inv.id,
            stock_item_id: l.stock_item_id,
            name: l.name.trim(),
            qty: Number(l.qty) || 0,
            unit: l.unit,
            unit_price: Number(l.unit_price) || 0,
            override_note: l.override_note?.trim() || null,
            sort_order: i,
          })),
        );
        if (insErr) throw new Error(insErr.message);

        logActivity(supabase, {
          orgId: org.id,
          actorEmail: email,
          entityType: 'invoice',
          entityId: inv.id,
          customerId,
          event: 'invoice_updated',
          description: `${inv.invoice_number} updated · ${zar2(totals.total)}`,
        });
        if (mode === 'sent' && inv.status === 'draft') {
          logActivity(supabase, {
            orgId: org.id,
            actorEmail: email,
            entityType: 'invoice',
            entityId: inv.id,
            customerId,
            event: 'invoice_sent',
            description: `${inv.invoice_number} marked as sent`,
          });
        }

        toast(mode === 'sent' ? `Invoice ${inv.invoice_number} sent` : `Invoice ${inv.invoice_number} saved`);
        router.refresh();
        router.push(`/app/orderflow/invoices/${inv.id}`);
        return;
      }

      const res = await createInvoice(supabase, {
        orgId: org.id,
        actorEmail: email,
        customer,
        customerId,
        lines,
        vatRate,
        discount: discountNum,
        issueDate,
        dueDate: dueDate || null,
        customerPo: customerPo.trim() || null,
        billingAddress: billingAddress.trim() || null,
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryInstructions: deliveryInstructions.trim() || null,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        orderId: initial.orderId ?? null,
        quoteId: initial.quoteId ?? null,
        status: mode,
      });
      if (mode === 'sent') {
        logActivity(supabase, {
          orgId: org.id,
          actorEmail: email,
          entityType: 'invoice',
          entityId: res.id,
          customerId,
          event: 'invoice_sent',
          description: `${res.number} marked as sent`,
        });
      }

      toast(mode === 'sent' ? `Invoice ${res.number} sent` : `Invoice ${res.number} saved`);
      router.refresh();
      router.push(`/app/orderflow/invoices/${res.id}`);
    } catch (e) {
      setBusy(null);
      toast(setupMessage(e instanceof Error ? e.message : 'Could not save the invoice.'));
    }
  }

  const heading = isEdit ? `Edit ${initial.editInvoice?.invoice_number ?? 'invoice'}` : 'New invoice';

  return (
    <div className="mx-auto max-w-[880px]">
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/orderflow/invoices" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
            ← Invoices
          </Link>
          <h1 className="mt-1 text-[26px] font-bold text-[#1A1C1E]">{heading}</h1>
          {initial.sourceLabel ? (
            <p className="mt-0.5 text-[13px] text-[#5F6368]">Prefilled from {initial.sourceLabel}.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-5 rounded-2xl border border-[#E7E7E2] bg-white p-6">
        {/* Customer + PO */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">
            <CustomerSelect customers={customers} value={customerId} onChange={handleCustomerChange} allowCreate />
            {customer ? (
              <p className="mt-1.5 text-[12px] text-[#9A9DA1]">
                {customer.vat_number ? `VAT ${customer.vat_number}` : 'No VAT number on file'}
                {' · '}
                {termsDaysFor(customer)}-day terms
              </p>
            ) : null}
          </Field>
          <Field label="Customer PO" hint="optional">
            <input
              value={customerPo}
              onChange={(e) => setCustomerPo(e.target.value)}
              placeholder="Their reference"
              className={inputClass}
            />
          </Field>
          <Field label="Issue date">
            <input type="date" value={issueDate} onChange={(e) => handleIssueDateChange(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Due date" hint={dueTouched ? undefined : 'from payment terms'}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDueTouched(true);
              }}
              className={inputClass}
            />
          </Field>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Billing address" hint="prints on the invoice">
            <textarea
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              rows={3}
              placeholder="Customer billing address"
              className={textareaClass}
            />
          </Field>
          <Field label="Delivery address" hint="optional">
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={3}
              placeholder="Where the goods go"
              className={textareaClass}
            />
          </Field>
        </div>
        <Field label="Delivery instructions" hint="optional">
          <input
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="Gate codes, receiving hours…"
            className={inputClass}
          />
        </Field>

        {/* Line items */}
        <div>
          <div className="mb-2 text-[13px] font-medium text-[#1A1C1E]">Line items</div>
          <LineItemsEditor products={products} priceList={priceList} overrides={overrides} lines={lines} onChange={setLines} />
        </div>

        {/* Notes + terms */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Notes" hint="shown on the invoice">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the customer should see"
              className={textareaClass}
            />
          </Field>
          <Field label="Terms" hint="payment terms text">
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              placeholder="e.g. Payment due within 30 days"
              className={textareaClass}
            />
          </Field>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t border-[#F0F0EC] pt-4">
          <div className="w-full max-w-[300px] space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Subtotal</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center text-[#5F6368]">
                Discount R
                <input
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Discount in rands"
                  className="ml-1.5 h-6 w-20 rounded-md border border-[#E7E7E2] px-1 text-right text-[12px] tabular-nums text-[#1A1C1E] focus:border-[#1E5E54]/50 focus:outline-none"
                />
              </span>
              <span className="tabular-nums text-[#1A1C1E]">{totals.discount > 0 ? `−${zar2(totals.discount)}` : zar2(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">
                VAT
                <input
                  value={String(vatRate)}
                  onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                  inputMode="decimal"
                  aria-label="VAT rate"
                  className="mx-1.5 h-6 w-12 rounded-md border border-[#E7E7E2] px-1 text-right text-[12px] tabular-nums text-[#1A1C1E] focus:border-[#1E5E54]/50 focus:outline-none"
                />
                %
              </span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.vat)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E7E7E2] pt-2 text-[16px] font-bold">
              <span className="text-[#1A1C1E]">Total</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        <Link
          href={isEdit && initial.editInvoice ? `/app/orderflow/invoices/${initial.editInvoice.id}` : '/app/orderflow/invoices'}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC]"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={() => void save('draft')}
          disabled={!!busy || !canSave}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'draft' ? 'Saving…' : isEdit ? 'Save changes' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void save('sent')}
          disabled={!!busy || !canSave}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'sent' ? 'Saving…' : 'Save & mark sent'}
        </button>
      </div>
    </div>
  );
}
