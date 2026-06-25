'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { ORDER_STATUS_STYLE, zar, type OrderStatus } from '@/lib/platform/orderflow';

export interface OrderRow {
  id: string;
  customer_name: string;
  status: OrderStatus;
  invoice_number: string | null;
  total: number;
  item_count: number;
  created_at: string;
}
interface CustomerLite {
  id: string;
  name: string;
}
interface ProductLite {
  id: string;
  name: string;
  unit: string | null;
  avg_unit_price: number | null;
}
interface Line {
  key: string;
  stock_item_id: string | null;
  name: string;
  qty: string;
  unit: string;
  unit_price: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function OrdersView({
  orders,
  customers,
  products,
}: {
  orders: OrderRow[];
  customers: CustomerLite[];
  products: ProductLite[];
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const tempRef = useState(() => ({ n: 0 }))[0];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  function addLine(p?: ProductLite) {
    const key = `l-${tempRef.n++}`;
    setLines((prev) => [
      ...prev,
      {
        key,
        stock_item_id: p?.id ?? null,
        name: p?.name ?? query.trim(),
        qty: '1',
        unit: p?.unit ?? '',
        unit_price: p?.avg_unit_price != null ? String(p.avg_unit_price) : '',
      },
    ]);
    setQuery('');
  }
  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const canSave = customerId && lines.some((l) => l.name.trim() && Number(l.qty) > 0);

  function resetBuilder() {
    setOpen(false);
    setCustomerId('');
    setLines([]);
    setQuery('');
  }

  async function saveOrder() {
    if (!canSave || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    const { data: order, error } = await supabase
      .from('of_orders')
      .insert({ org_id: org.id, customer_id: customerId, status: 'draft' })
      .select('id')
      .single();
    if (error || !order?.id) {
      setBusy(false);
      return;
    }
    const rows = lines
      .filter((l) => l.name.trim() && Number(l.qty) > 0)
      .map((l) => ({
        org_id: org.id,
        order_id: order.id as string,
        stock_item_id: l.stock_item_id,
        name: l.name.trim(),
        qty: Number(l.qty) || 0,
        unit: l.unit.trim() || null,
        unit_price: Number(l.unit_price) || 0,
      }));
    if (rows.length) await supabase.from('of_order_items').insert(rows);
    setBusy(false);
    resetBuilder();
    router.refresh();
  }

  const cell = 'h-9 rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Orders</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Build orders from your products, then invoice them</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]"
        >
          + New order
        </button>
      </div>

      {/* Orders list */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="flex items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-2.5 text-[12px] text-[#5F6368]">
          <div className="flex-1">Customer</div>
          <div className="w-[120px]">Status</div>
          <div className="w-[90px] text-right">Items</div>
          <div className="w-[120px] text-right">Total</div>
          <div className="w-[140px] text-right">Created</div>
        </div>
        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">No orders yet — create your first.</div>
        ) : (
          orders.map((o) => {
            const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.draft;
            return (
              <Link
                key={o.id}
                href={`/app/orderflow/orders/${o.id}`}
                className="flex items-center border-t border-[#F0F0EC] px-5 py-3.5 text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]"
              >
                <div className="flex-1 font-medium">
                  {o.customer_name}
                  {o.invoice_number ? <span className="ml-2 text-[12px] text-[#9A9DA1]">{o.invoice_number}</span> : null}
                </div>
                <div className="w-[120px]">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
                    {s.label}
                  </span>
                </div>
                <div className="w-[90px] text-right text-[#5F6368]">{o.item_count}</div>
                <div className="w-[120px] text-right font-medium">{zar(o.total)}</div>
                <div className="w-[140px] text-right text-[#9A9DA1]">{fmtDate(o.created_at)}</div>
              </Link>
            );
          })
        )}
      </div>

      {/* New order builder */}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[8vh]">
          <button type="button" aria-label="Close" onClick={resetBuilder} className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 w-full max-w-[620px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#1A1C1E]">New order</h3>
              <button type="button" onClick={resetBuilder} aria-label="Close" className="text-[#9A9DA1] hover:text-[#1A1C1E]">
                ✕
              </button>
            </div>

            <label className="mb-1 block text-[12px] text-[#5F6368]">Customer</label>
            <select className={`${cell} mb-4 h-10 w-full`} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-[12px] text-[#5F6368]">Line items</label>
            <div className="relative mb-2">
              <input
                className={`${cell} h-10 w-full`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) addLine(matches[0]);
                }}
                placeholder="Search a product to add (or type a new name + Enter)…"
              />
              {matches.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-xl border border-[#E7E7E2] bg-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[12px] text-[#9A9DA1]">{p.avg_unit_price != null ? zar(p.avg_unit_price) : ''}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {lines.length > 0 ? (
              <div className="mb-3 space-y-2">
                {lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-[1fr_64px_64px_84px_28px] items-center gap-2">
                    <input className={cell} value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} />
                    <input className={`${cell} text-right`} value={l.qty} inputMode="decimal" onChange={(e) => updateLine(l.key, { qty: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="qty" />
                    <input className={cell} value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} placeholder="unit" />
                    <input className={`${cell} text-right`} value={l.unit_price} inputMode="decimal" onChange={(e) => updateLine(l.key, { unit_price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="price" />
                    <button type="button" onClick={() => removeLine(l.key)} aria-label="Remove line" className="flex h-9 w-7 items-center justify-center rounded-lg text-[#9A9DA1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[12px] text-[#9A9DA1]">No items yet — search above to add products.</p>
            )}

            <div className="flex items-center justify-between border-t border-[#F0F0EC] pt-3">
              <span className="text-[14px] font-semibold text-[#1A1C1E]">Total {zar(total)}</span>
              <div className="flex gap-2">
                <button type="button" onClick={resetBuilder} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveOrder()}
                  disabled={!canSave || busy}
                  className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                >
                  {busy ? 'Creating…' : 'Create order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
