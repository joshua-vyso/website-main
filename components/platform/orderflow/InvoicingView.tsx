'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { ORDER_STATUS_STYLE, invoiceNumber, zar, type OrderStatus } from '@/lib/platform/orderflow';

export interface InvoiceRow {
  id: string;
  customer_name: string;
  status: OrderStatus;
  invoice_number: string | null;
  total: number;
  created_at: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function InvoicingView({ rows, startSeq }: { rows: InvoiceRow[]; startSeq: number }) {
  const router = useRouter();
  const [seq, setSeq] = useState(startSeq);
  const [busy, setBusy] = useState<string | null>(null);

  async function generate(id: string) {
    const supabase = createClient();
    if (!supabase || busy) return;
    setBusy(id);
    const num = invoiceNumber(seq);
    await supabase.from('of_orders').update({ invoice_number: num, status: 'invoiced' }).eq('id', id);
    setSeq((n) => n + 1);
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Invoicing</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">Generate invoices from confirmed orders, and track what's paid</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="flex items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-2.5 text-[12px] text-[#5F6368]">
          <div className="w-[130px]">Invoice</div>
          <div className="flex-1">Customer</div>
          <div className="w-[110px]">Status</div>
          <div className="w-[120px] text-right">Total</div>
          <div className="w-[150px] text-right">Date</div>
          <div className="w-[150px] text-right">Action</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
            No orders to invoice yet. Confirm an order to generate its invoice.
          </div>
        ) : (
          rows.map((o) => {
            const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.draft;
            return (
              <div key={o.id} className="flex items-center border-t border-[#F0F0EC] px-5 py-3.5 text-[13px] text-[#1A1C1E]">
                <div className="w-[130px] font-medium">{o.invoice_number ?? '—'}</div>
                <div className="flex-1">{o.customer_name}</div>
                <div className="w-[110px]">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
                    {s.label}
                  </span>
                </div>
                <div className="w-[120px] text-right font-medium">{zar(o.total)}</div>
                <div className="w-[150px] text-right text-[#9A9DA1]">{fmtDate(o.created_at)}</div>
                <div className="w-[150px] text-right">
                  {o.status === 'confirmed' && !o.invoice_number ? (
                    <button
                      type="button"
                      onClick={() => void generate(o.id)}
                      disabled={busy === o.id}
                      className="rounded-lg bg-[#854F0B] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#6f4109] disabled:opacity-40"
                    >
                      {busy === o.id ? '…' : 'Generate invoice'}
                    </button>
                  ) : (
                    <Link
                      href={`/app/orderflow/orders/${o.id}`}
                      className="inline-flex rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30"
                    >
                      View invoice
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
