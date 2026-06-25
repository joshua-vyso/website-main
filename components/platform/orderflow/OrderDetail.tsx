'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import {
  ORDER_STATUS_STYLE,
  invoiceNumber,
  lineTotal,
  orderTotal,
  withVat,
  zar,
  type OfOrder,
  type OfOrderItem,
} from '@/lib/platform/orderflow';

export function OrderDetail({
  order,
  customerName,
  items,
  nextSeq,
}: {
  order: OfOrder;
  customerName: string;
  items: OfOrderItem[];
  nextSeq: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const subtotal = orderTotal(items);
  const { vat, total } = withVat(subtotal);
  const s = ORDER_STATUS_STYLE[order.status] ?? ORDER_STATUS_STYLE.draft;

  async function update(patch: Partial<OfOrder>) {
    if (busy) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.from('of_orders').update(patch).eq('id', order.id);
    setBusy(false);
    router.refresh();
  }
  async function generateInvoice() {
    await update({ invoice_number: order.invoice_number ?? invoiceNumber(nextSeq), status: 'invoiced' });
  }
  async function remove() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.from('of_orders').delete().eq('id', order.id);
    router.push('/app/orderflow/orders');
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/app/orderflow/orders"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/30 hover:text-[#1A1C1E]"
          >
            <span aria-hidden>‹</span> Orders
          </Link>
          <h1 className="text-[22px] font-bold text-[#1A1C1E]">
            {order.invoice_number ? order.invoice_number : 'Order'}
          </h1>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
            {s.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'draft' ? (
            <button type="button" onClick={() => void update({ status: 'confirmed' })} disabled={busy} className="rounded-lg bg-[#0C447C] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#0a3a69] disabled:opacity-40">
              Confirm order
            </button>
          ) : null}
          {order.status === 'confirmed' ? (
            <button type="button" onClick={() => void generateInvoice()} disabled={busy} className="rounded-lg bg-[#854F0B] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#6f4109] disabled:opacity-40">
              Generate invoice
            </button>
          ) : null}
          {order.status === 'invoiced' ? (
            <button type="button" onClick={() => void update({ status: 'paid' })} disabled={busy} className="rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#184D45] disabled:opacity-40">
              Mark paid
            </button>
          ) : null}
          {confirmDel ? (
            <span className="flex items-center gap-2 text-[13px]">
              <span className="text-[#5F6368]">Delete order?</span>
              <button type="button" onClick={() => setConfirmDel(false)} className="rounded-lg px-2.5 py-1.5 text-[#5F6368] hover:bg-black/[0.03]">No</button>
              <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-lg bg-[#A32D2D] px-3 py-1.5 font-medium text-white hover:bg-[#8f2727] disabled:opacity-40">Yes</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="rounded-lg border border-[#E7E7E2] px-3 py-2 text-[13px] text-[#9A9DA1] transition-colors hover:border-[#A32D2D]/40 hover:text-[#A32D2D]">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Invoice-style card */}
      <div className="mt-6 max-w-[760px] rounded-2xl border border-[#E7E7E2] bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-[#9A9DA1]">Bill to</div>
            <div className="mt-0.5 text-[16px] font-semibold text-[#1A1C1E]">{customerName}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] uppercase tracking-wide text-[#9A9DA1]">
              {order.invoice_number ? 'Invoice' : 'Order'}
            </div>
            <div className="mt-0.5 text-[14px] font-medium text-[#1A1C1E]">{order.invoice_number ?? '—'}</div>
            <div className="text-[12px] text-[#9A9DA1]">{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#F0F0EC]">
          <div className="grid grid-cols-[1fr_70px_90px_110px] gap-2 border-b border-[#F0F0EC] bg-[#FBFBF9] px-4 py-2 text-[12px] text-[#5F6368]">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Line total</span>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#9A9DA1]">No line items.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="grid grid-cols-[1fr_70px_90px_110px] gap-2 border-b border-[#F0F0EC] px-4 py-2.5 text-[13px] text-[#1A1C1E] last:border-b-0">
                <span className="truncate">{it.name}</span>
                <span className="text-right text-[#5F6368]">
                  {it.qty}
                  {it.unit ? ` ${it.unit}` : ''}
                </span>
                <span className="text-right text-[#5F6368]">{zar(it.unit_price)}</span>
                <span className="text-right font-medium">{zar(lineTotal(it))}</span>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 ml-auto w-full max-w-[260px] space-y-1.5 text-[13px]">
          <div className="flex justify-between text-[#5F6368]">
            <span>Subtotal</span>
            <span>{zar(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#5F6368]">
            <span>VAT (15%)</span>
            <span>{zar(vat)}</span>
          </div>
          <div className="flex justify-between border-t border-[#F0F0EC] pt-1.5 text-[15px] font-bold text-[#1A1C1E]">
            <span>Total</span>
            <span>{zar(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
