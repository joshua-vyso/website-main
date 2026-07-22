'use client';

/**
 * Order detail — the v2 operational view of one order: a clickable status
 * stepper (draft → confirmed → picking → packed → out for delivery →
 * delivered), real invoice generation via builder.createInvoice (keeping the
 * order-stock sync this module has always done), delivery-note creation,
 * an editable delivery block, attached customer POs and the activity feed.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  DELIVERY_NOTE_STATUS_STYLE,
  INVOICE_STATUS_STYLE,
  ORDER_STATUS_STYLE,
  docTotals,
  effectiveInvoiceStatus,
  isoDatePlusDays,
  lineTotal,
  paymentsTotal,
  zar2,
  type OfActivityEvent,
  type OfCustomer,
  type OfDeliveryNote,
  type OfInvoice,
  type OfInvoiceItem,
  type OfOrder,
  type OfOrderItem,
  type OfPayment,
  type OfSettings,
  type OrderStatus,
} from '@/lib/platform/orderflow';
import type { LinkedDocument } from '@/lib/platform/orderflow-data';
import { createDeliveryNote, createInvoice, type BuilderLine } from './builder';
import { ActivityFeed } from './ActivityFeed';
import { AttachDocuments } from './AttachDocuments';
import { useToast } from './ui';
import { ConfirmDialog, Pill, inputClass } from '@/components/platform/coredata/ui';

const PIPELINE: OrderStatus[] = ['draft', 'confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'];
const INVOICED_LIKE: OrderStatus[] = ['invoiced', 'partially_paid', 'paid'];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Reflect a sale in ProcurePulse stock — the same call this module has always made. */
async function syncOrderStock(orderId: string, action: 'apply' | 'reverse') {
  await fetch('/api/orderflow/order-stock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, action }),
  }).catch(() => {});
}

export function OrderDetail({
  order,
  items,
  customer,
  invoice,
  invoiceItems,
  invoicePayments,
  deliveryNotes,
  documents,
  activity,
  settings,
}: {
  order: OfOrder;
  items: OfOrderItem[];
  customer: OfCustomer | null;
  invoice: OfInvoice | null;
  invoiceItems: OfInvoiceItem[];
  invoicePayments: OfPayment[];
  deliveryNotes: OfDeliveryNote[];
  documents: LinkedDocument[];
  activity: OfActivityEvent[];
  settings: OfSettings;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Delivery block editing
  const [editDelivery, setEditDelivery] = useState(false);
  const [dAddress, setDAddress] = useState(order.delivery_address ?? '');
  const [dInstructions, setDInstructions] = useState(order.delivery_instructions ?? '');
  const [dDate, setDDate] = useState(order.delivery_date ?? '');

  const vatRate = Number(settings.default_vat_rate) || 15;
  const ref = order.order_number ?? `#${order.id.slice(0, 6).toUpperCase()}`;
  const s = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.draft;
  const totals = docTotals(items, vatRate);

  const isPipeline = PIPELINE.includes(order.status);
  const invoicedLike = INVOICED_LIKE.includes(order.status);
  const stepIdx = isPipeline ? PIPELINE.indexOf(order.status) : invoicedLike ? PIPELINE.length - 1 : -1;

  /** Update of_orders, retrying without updated_at when the migration isn't applied. */
  async function writeOrder(patch: Record<string, unknown>): Promise<string | null> {
    const supabase = createClient();
    if (!supabase || !org) return 'Not connected.';
    const { error } = await supabase
      .from('of_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    if (!error) return null;
    const retry = await supabase.from('of_orders').update(patch).eq('id', order.id);
    return retry.error ? retry.error.message : null;
  }

  async function setStatus(next: OrderStatus) {
    if (busy || next === order.status) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy(true);
    const err = await writeOrder({ status: next });
    if (err) {
      setBusy(false);
      toast(err);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'order',
      entityId: order.id,
      customerId: order.customer_id,
      event: 'order_status_changed',
      description: `${ref}: ${s.label} → ${ORDER_STATUS_STYLE[next].label}`,
    });
    setBusy(false);
    toast(`Status: ${ORDER_STATUS_STYLE[next].label}`);
    router.refresh();
  }

  async function generateInvoice() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    if (!items.length) {
      toast('This order has no line items to invoice.');
      return;
    }
    setBusy(true);
    const lines: BuilderLine[] = items.map((it, i) => ({
      key: `oi${i}`,
      stock_item_id: it.stock_item_id,
      name: it.name,
      qty: Number(it.qty) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
      source: 'base',
      override_note: null,
    }));
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await createInvoice(supabase, {
        orgId: org.id,
        actorEmail: email,
        customer,
        customerId: order.customer_id,
        lines,
        vatRate,
        issueDate: today,
        dueDate: isoDatePlusDays(today, customer?.payment_terms_days ?? settings.default_payment_terms_days),
        customerPo: order.customer_po ?? null,
        deliveryAddress: order.delivery_address ?? null,
        deliveryInstructions: order.delivery_instructions ?? null,
        orderId: order.id,
      });
      // The order just became invoiced — reflect the sale in stock (idempotent).
      await syncOrderStock(order.id, 'apply');
      setBusy(false);
      toast(`Invoice ${res.number} created`);
      router.refresh();
    } catch (err) {
      setBusy(false);
      toast(err instanceof Error ? err.message : 'Could not create the invoice.');
    }
  }

  async function makeDeliveryNote() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    if (!items.length) {
      toast('This order has no line items.');
      return;
    }
    setBusy(true);
    try {
      const res = await createDeliveryNote(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId: order.customer_id,
        orderId: order.id,
        deliveryAddress: order.delivery_address ?? null,
        instructions: order.delivery_instructions ?? null,
        lines: items.map((i) => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit })),
      });
      toast(`Delivery note ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/delivery-notes/${res.id}`);
    } catch (err) {
      setBusy(false);
      toast(err instanceof Error ? err.message : 'Could not create the delivery note.');
    }
  }

  async function saveDelivery() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy(true);
    const err = await writeOrder({
      delivery_address: dAddress.trim() || null,
      delivery_instructions: dInstructions.trim() || null,
      delivery_date: dDate || null,
    });
    setBusy(false);
    if (err) {
      toast(/column|relation|schema/i.test(err) ? `${err} — run supabase/core-data.sql to enable delivery details.` : err);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'order',
      entityId: order.id,
      customerId: order.customer_id,
      event: 'order_updated',
      description: `${ref}: delivery details updated`,
    });
    setEditDelivery(false);
    toast('Delivery details saved');
    router.refresh();
  }

  async function remove() {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy(true);
    // Put the sold stock back before the order (and its lines) disappear.
    await syncOrderStock(order.id, 'reverse');
    const { error } = await supabase.from('of_orders').delete().eq('id', order.id);
    if (error) {
      setBusy(false);
      setConfirmDel(false);
      toast(error.message);
      return;
    }
    router.push('/app/orderflow/orders');
    router.refresh();
  }

  const invoiceStatus = invoice
    ? effectiveInvoiceStatus(
        invoice,
        paymentsTotal(invoicePayments),
        docTotals(invoiceItems, invoice.vat_rate, invoice.discount, invoice.rebate_pct ?? 0).total,
      )
    : null;
  const invoiceStyle = invoiceStatus ? INVOICE_STATUS_STYLE[invoiceStatus] : null;

  return (
    <div>
      {toastNode}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/app/orderflow/orders"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#5F6368] transition-colors hover:border-[#3E7BC4]/30 hover:text-[#1A1C1E]"
            >
              <span aria-hidden>‹</span> Orders
            </Link>
            <h1 className="text-[22px] font-bold text-[#1A1C1E]">{ref}</h1>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
              {s.label}
            </span>
            {order.source_document_id ? (
              <span className="rounded-full bg-[#F0F0EC] px-2.5 py-1 text-[11px] font-medium text-[#5F6368]">From uploaded order</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[13px] text-[#5F6368]">
            {customer ? (
              <Link href={`/app/orderflow/customers/${customer.id}`} className="font-medium text-[#1F5FA8] hover:text-[#174C87]">
                {customer.name}
              </Link>
            ) : (
              'No customer'
            )}
            <span className="text-[#9A9DA1]"> · Created {fmtDate(order.created_at)}</span>
            {order.customer_po ? <span className="text-[#9A9DA1]"> · PO {order.customer_po}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!invoice && order.status !== 'cancelled' ? (
            <button
              type="button"
              onClick={() => void generateInvoice()}
              disabled={busy || items.length === 0}
              className="inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
            >
              Generate invoice
            </button>
          ) : null}
          {order.status !== 'cancelled' ? (
            <button
              type="button"
              onClick={() => void makeDeliveryNote()}
              disabled={busy || items.length === 0}
              className="inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-40"
            >
              Create delivery note
            </button>
          ) : null}
          {order.status === 'draft' ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg border border-[#E7E7E2] px-3.5 text-[13px] text-[#9A9DA1] transition-colors hover:border-[#A32D2D]/40 hover:text-[#A32D2D] disabled:opacity-40"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {/* Status stepper */}
      {order.status === 'cancelled' ? (
        <div className="mt-6 rounded-2xl border border-[#F0D9D9] bg-[#FCEBEB]/40 px-5 py-4 text-[13px] text-[#8A4A4A]">
          This order was cancelled — its history and documents are kept for reference.
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-y-3">
            {PIPELINE.map((st, i) => {
              const done = i <= stepIdx;
              const current = isPipeline && st === order.status;
              const clickable = isPipeline && !busy && st !== order.status;
              return (
                <div key={st} className="flex items-center">
                  {i > 0 ? <span className={`mx-2 h-px w-6 sm:w-10 ${i <= stepIdx ? 'bg-[#1F5FA8]' : 'bg-[#E7E7E2]'}`} aria-hidden /> : null}
                  <button
                    type="button"
                    onClick={() => clickable && void setStatus(st)}
                    disabled={!clickable}
                    title={isPipeline ? `Set status to ${ORDER_STATUS_STYLE[st].label}` : undefined}
                    className={`group flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${clickable ? 'cursor-pointer hover:bg-[#F2F7F5]' : 'cursor-default'}`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        done ? 'border-[#3E7BC4] bg-[#1F5FA8] text-white' : 'border-[#D7DAD8] bg-white text-[#9A9DA1]'
                      } ${current ? 'ring-2 ring-[#3E7BC4]/25' : ''}`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={`text-[12px] font-medium ${current ? 'text-[#1F5FA8]' : done ? 'text-[#1A1C1E]' : 'text-[#9A9DA1]'}`}>
                      {ORDER_STATUS_STYLE[st].label}
                    </span>
                  </button>
                </div>
              );
            })}
            {invoicedLike ? (
              <span className="ml-3 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
                {s.label}
              </span>
            ) : null}
          </div>
          {isPipeline ? (
            <p className="mt-2 text-[12px] text-[#9A9DA1]">Click a step to move the order along its pipeline.</p>
          ) : null}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Items */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Items</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-[#F0F0EC]">
              <div className="grid grid-cols-[1fr_80px_100px_110px] gap-2 border-b border-[#F0F0EC] bg-[#FBFBF9] px-4 py-2 text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Amount</span>
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-[#9A9DA1]">No line items.</div>
              ) : (
                items.map((it) => (
                  <div key={it.id} className="grid grid-cols-[1fr_80px_100px_110px] gap-2 border-b border-[#F0F0EC] px-4 py-2.5 text-[13px] text-[#1A1C1E] last:border-b-0">
                    <span className="truncate">{it.name}</span>
                    <span className="text-right tabular-nums text-[#5F6368]">
                      {it.qty}
                      {it.unit ? ` ${it.unit}` : ''}
                    </span>
                    <span className="text-right tabular-nums text-[#5F6368]">{zar2(it.unit_price)}</span>
                    <span className="text-right font-medium tabular-nums">{zar2(lineTotal(it))}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 text-[13px]">
              <div className="flex justify-between text-[#5F6368]">
                <span>Subtotal</span>
                <span className="tabular-nums">{zar2(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#9A9DA1]">
                <span>VAT ({vatRate}%)</span>
                <span className="tabular-nums">{zar2(totals.vat)}</span>
              </div>
              <div className="flex justify-between border-t border-[#F0F0EC] pt-1.5 text-[15px] font-bold text-[#1A1C1E]">
                <span>Total</span>
                <span className="tabular-nums">{zar2(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Delivery</h2>
              {editDelivery ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDelivery(false);
                      setDAddress(order.delivery_address ?? '');
                      setDInstructions(order.delivery_instructions ?? '');
                      setDDate(order.delivery_date ?? '');
                    }}
                    className="text-[12px] text-[#9A9DA1] hover:text-[#5F6368]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDelivery()}
                    disabled={busy}
                    className="inline-flex h-8 items-center rounded-lg bg-[#1F5FA8] px-3 text-[12px] font-medium text-white hover:bg-[#174C87] disabled:opacity-40"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditDelivery(true)}
                  className="inline-flex h-8 items-center rounded-lg border border-[#D7DAD8] bg-white px-3 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40"
                >
                  Edit
                </button>
              )}
            </div>
            {editDelivery ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[12px] text-[#5F6368]">Delivery address</label>
                  <textarea
                    value={dAddress}
                    onChange={(e) => setDAddress(e.target.value)}
                    rows={2}
                    placeholder="Street, suburb, city…"
                    className="w-full rounded-lg border border-[#D7DAD8] bg-white px-3 py-2 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-[#5F6368]">Delivery date</label>
                  <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-[#5F6368]">Instructions</label>
                  <input
                    value={dInstructions}
                    onChange={(e) => setDInstructions(e.target.value)}
                    placeholder="Gate code, receiving hours…"
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Address</div>
                  <div className="mt-1 text-[#1A1C1E]">{order.delivery_address || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Date</div>
                  <div className="mt-1 text-[#1A1C1E]">{fmtDate(order.delivery_date)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Instructions</div>
                  <div className="mt-1 text-[#1A1C1E]">{order.delivery_instructions || '—'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes ? (
            <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
              <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-[13px] text-[#5F6368]">{order.notes}</p>
            </div>
          ) : null}
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {/* Invoice link */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Invoice</h2>
            {invoice ? (
              <Link
                href={`/app/orderflow/invoices/${invoice.id}`}
                className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#F0F0EC] bg-[#FBFBF9] px-3.5 py-3 transition-colors hover:border-[#3E7BC4]/30"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[#1F5FA8]">{invoice.invoice_number}</div>
                  <div className="mt-0.5 text-[11px] text-[#9A9DA1]">Issued {fmtDate(invoice.issue_date)}</div>
                </div>
                {invoiceStyle ? <Pill label={invoiceStyle.label} bg={invoiceStyle.bg} fg={invoiceStyle.fg} /> : null}
              </Link>
            ) : order.invoice_number ? (
              <p className="mt-3 text-[13px] text-[#5F6368]">
                Invoiced as <span className="font-medium text-[#1A1C1E]">{order.invoice_number}</span>
                <span className="text-[#9A9DA1]"> — no linked invoice record yet. Generate invoice to create one.</span>
              </p>
            ) : (
              <p className="mt-3 text-[13px] text-[#9A9DA1]">Not invoiced yet.</p>
            )}
          </div>

          {/* Delivery notes */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Delivery notes</h2>
            {deliveryNotes.length === 0 ? (
              <p className="mt-3 text-[13px] text-[#9A9DA1]">No delivery notes for this order yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#F0F0EC] overflow-hidden rounded-xl border border-[#E7E7E2]">
                {deliveryNotes.map((dn) => {
                  const ds = DELIVERY_NOTE_STATUS_STYLE[dn.status] ?? DELIVERY_NOTE_STATUS_STYLE.draft;
                  return (
                    <li key={dn.id}>
                      <Link href={`/app/orderflow/delivery-notes/${dn.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-[#FAFAF8]">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[#1F5FA8]">{dn.dn_number}</div>
                          <div className="mt-0.5 text-[11px] text-[#9A9DA1]">{fmtDate(dn.created_at)}</div>
                        </div>
                        <Pill label={ds.label} bg={ds.bg} fg={ds.fg} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Customer POs / attached documents */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <AttachDocuments
              entityType="order"
              entityId={order.id}
              customerId={order.customer_id}
              documents={documents}
              title="Customer PO / documents"
              documentType="order"
            />
          </div>

          {/* Activity */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h2 className="mb-3 text-[14px] font-semibold text-[#1A1C1E]">Activity</h2>
            <ActivityFeed events={activity} emptyLabel="No activity on this order yet." />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title={`Delete ${ref}?`}
        body="This permanently removes the draft order and its line items, and puts any sold stock back."
        confirmLabel="Delete order"
        danger
        onConfirm={() => void remove()}
        onClose={() => setConfirmDel(false)}
      />
    </div>
  );
}
