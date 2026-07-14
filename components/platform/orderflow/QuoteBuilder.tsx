'use client';

/**
 * New-quote builder — pick/create a customer, add priced line items (resolved
 * through the customer's Core Data price list), set notes + customer PO, and
 * save as a draft or straight to "sent". Inserts of_quotes + of_quote_items
 * with atomic numbering, logs activity, then routes to the new quote's detail.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  customerPriceList,
  formatAddress,
  resolvePrice,
  type CdDeliveryAddress,
  type CdPriceList,
  type CdPriceOverride,
  type CdProduct,
} from '@/lib/platform/coredata';
import {
  docTotals,
  isoDatePlusDays,
  quoteRequestWho,
  setupMessage,
  zar2,
  type OfCustomer,
  type OfQuoteRequest,
  type OfSettings,
} from '@/lib/platform/orderflow';
import { CustomerSelect, LineItemsEditor, nextDocNumber, type BuilderLine } from './builder';
import { useToast } from './ui';
import { Field, inputClass } from '@/components/platform/coredata/ui';

export function QuoteBuilder({
  customers,
  addresses,
  products,
  priceLists,
  overrides,
  settings,
  initialCustomerId,
  initialLines = null,
  quoteRequest = null,
}: {
  customers: OfCustomer[];
  addresses: CdDeliveryAddress[];
  products: CdProduct[];
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  settings: OfSettings;
  initialCustomerId: string | null;
  /** Unpriced lines seeded from a website enquiry. */
  initialLines?: BuilderLine[] | null;
  /**
   * The website enquiry this quote answers, if any. Shown READ-ONLY — its text is never
   * copied into the quote itself (notes are printed beside your banking details), and
   * saving closes the enquiry out.
   */
  quoteRequest?: OfQuoteRequest | null;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState<string | null>(
    initialCustomerId && customers.some((c) => c.id === initialCustomerId) ? initialCustomerId : null,
  );
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState(isoDatePlusDays(today, 14));
  const [vatRate, setVatRate] = useState<number>(settings.default_vat_rate ?? 15);
  const [customerPo, setCustomerPo] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<BuilderLine[]>(initialLines ?? []);
  const [busy, setBusy] = useState<null | 'draft' | 'sent'>(null);

  const customer = useMemo(() => customers.find((c) => c.id === customerId) ?? null, [customers, customerId]);
  const priceList = useMemo(() => customerPriceList(customer, priceLists), [customer, priceLists]);
  const totals = useMemo(() => docTotals(lines, vatRate), [lines, vatRate]);

  // Selecting a customer auto-fills the delivery address from their default Core
  // Data address (only when the field is still empty, so it never clobbers edits).
  function onCustomerChange(id: string | null) {
    setCustomerId(id);
    if (id) {
      const own = addresses.filter((a) => a.customer_id === id);
      const def = own.find((a) => a.is_default) ?? own[0] ?? null;
      if (def) {
        const text = [formatAddress(def), def.instructions].filter(Boolean).join('\n');
        setDeliveryAddress((prev) => (prev.trim() ? prev : text));
      }
    }
  }

  // A price edited away from the customer's resolved price-list price needs a
  // reason (same rule + detection as InvoiceBuilder — compare against the
  // resolved price, since the editor leaves override_note null until typed).
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
      const number = await nextDocNumber(supabase, 'quote');
      const nowIso = new Date().toISOString();

      const { data: quote, error: qErr } = await supabase
        .from('of_quotes')
        .insert({
          org_id: org.id,
          customer_id: customerId,
          quote_number: number,
          status: mode === 'sent' ? 'sent' : 'draft',
          issue_date: issueDate,
          valid_until: validUntil || null,
          vat_rate: vatRate,
          customer_po: customerPo.trim() || null,
          delivery_address: deliveryAddress.trim() || null,
          notes: notes.trim() || null,
          updated_at: nowIso,
        })
        .select('id')
        .single();
      if (qErr || !quote) throw new Error(qErr?.message ?? 'Could not create the quote.');

      if (lines.length > 0) {
        const { error: itemErr } = await supabase.from('of_quote_items').insert(
          lines.map((l, i) => ({
            org_id: org.id,
            quote_id: quote.id,
            stock_item_id: l.stock_item_id,
            name: l.name.trim(),
            qty: Number(l.qty) || 0,
            unit: l.unit,
            unit_price: Number(l.unit_price) || 0,
            override_note: l.override_note?.trim() || null,
            sort_order: i,
          })),
        );
        if (itemErr) {
          await supabase.from('of_quotes').delete().eq('id', quote.id);
          throw new Error(itemErr.message);
        }
      }

      // Close the website enquiry this quote answers. Best-effort: the quote itself is
      // already saved, and a stale 'new' request is a far better failure than losing it.
      if (quoteRequest) {
        await supabase
          .from('of_quote_requests')
          .update({
            status: 'quoted',
            quote_id: quote.id,
            // The human just chose this customer for the enquiry — this is the ONLY
            // place a request is ever linked to a real account. The extractor never
            // does it, because a name typed into a public form proves nothing.
            customer_id: customerId,
            updated_at: nowIso,
          })
          .eq('id', quoteRequest.id)
          .eq('org_id', org.id)
          // Only close a still-open enquiry. Without this, using the browser Back button
          // to the ?request= page and saving again would re-point the request at the
          // newer quote (orphaning the first), or resurrect a dismissed one.
          .eq('status', 'new');
      }

      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'quote',
        entityId: quote.id,
        customerId,
        event: 'quote_created',
        description: `${number} · ${zar2(totals.total)}${customer ? ` for ${customer.name}` : ''}`,
      });
      if (mode === 'sent') {
        logActivity(supabase, {
          orgId: org.id,
          actorEmail: email,
          entityType: 'quote',
          entityId: quote.id,
          customerId,
          event: 'quote_sent',
          description: 'Quote marked as sent',
        });
      }

      toast(mode === 'sent' ? `Quote ${number} sent` : `Quote ${number} saved`);
      router.refresh();
      router.push(`/app/orderflow/quotes/${quote.id}`);
    } catch (e) {
      setBusy(null);
      toast(setupMessage(e instanceof Error ? e.message : 'Could not save the quote.'));
    }
  }

  return (
    <div className="mx-auto max-w-[880px]">
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/app/orderflow/quotes" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
              ← Quotes
            </Link>
          </div>
          <h1 className="mt-1 text-[26px] font-bold text-[#1A1C1E]">New quote</h1>
        </div>
      </div>

      {/* The enquiry, READ-ONLY. Its text is never copied into the quote: notes are
          printed on the issued document beside your banking details, so a stranger's
          free text must never arrive there pre-filled. Copy across what you mean to. */}
      {quoteRequest ? (
        <div className="mt-4 rounded-2xl border border-[#FBEEDA] bg-[#FFFDF7] p-4">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[#854F0B]">Website enquiry</div>
          <div className="mt-1 text-[14px] font-medium text-[#1A1C1E]">
            {quoteRequestWho(quoteRequest)}
            {quoteRequest.business_name ? (
              <span className="font-normal text-[#5F6368]"> · {quoteRequest.business_name}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-[#5F6368]">
            {quoteRequest.contact_email ? <span>{quoteRequest.contact_email}</span> : null}
            {quoteRequest.contact_phone ? <span>{quoteRequest.contact_phone}</span> : null}
          </div>
          {quoteRequest.message ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-[#1A1C1E]">{quoteRequest.message}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-[#9A9DA1]">
            Typed into a public form — unverified, and not copied onto the quote. Saving marks this enquiry as quoted.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-5 rounded-2xl border border-[#E7E7E2] bg-white p-6">
        {/* Customer + dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">
            <CustomerSelect customers={customers} value={customerId} onChange={onCustomerChange} allowCreate />
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
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Valid until">
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
          </Field>
        </div>

        {/* Line items */}
        <div>
          <div className="mb-2 text-[13px] font-medium text-[#1A1C1E]">Line items</div>
          <LineItemsEditor
            products={products}
            priceList={priceList}
            overrides={overrides}
            lines={lines}
            onChange={setLines}
          />
        </div>

        {/* Delivery + notes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Delivery address" hint="optional">
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={3}
              placeholder="Where the goods go"
              className="w-full rounded-lg border border-[#D7DAD8] bg-white px-3 py-2 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none"
            />
          </Field>
          <Field label="Notes" hint="shown on the quote">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the customer should see"
              className="w-full rounded-lg border border-[#D7DAD8] bg-white px-3 py-2 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none"
            />
          </Field>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t border-[#F0F0EC] pt-4">
          <div className="w-full max-w-[280px] space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Subtotal</span>
              <span className="tabular-nums text-[#1A1C1E]">{zar2(totals.subtotal)}</span>
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
          href="/app/orderflow/quotes"
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
          {busy === 'draft' ? 'Saving…' : 'Save draft'}
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
