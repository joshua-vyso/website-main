'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { rand, type DraftOrder } from '@/lib/platform/procurepulse';
import type { ReorderRequest, StockOrder } from '@/lib/platform/types';

interface ItemLite {
  id: string;
  name: string;
  unit: string;
  cheapest_supplier: string | null;
}

/** Keep digits + at most one decimal point (so "1.2.3" can't become NaN). */
function sanitizeDecimal(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
}

/** Monday-anchored ISO date key for the week a timestamp falls in. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return mon.toISOString().slice(0, 10);
}
function weekLabel(key: string): string {
  if (key === 'unknown') return 'Earlier';
  const d = new Date(`${key}T00:00:00`);
  const thisWeek = weekKey(new Date().toISOString());
  if (key === thisWeek) return 'This week';
  return `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ReorderView({
  order,
  manual,
  items,
  orders,
}: {
  order: DraftOrder;
  manual: ReorderRequest[];
  items: ItemLite[];
  orders: StockOrder[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ItemLite | null>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Group order history by week (newest week first); most recent week starts open.
  const weeks = useMemo(() => {
    const map = new Map<string, StockOrder[]>();
    for (const o of orders) {
      const k = weekKey(o.created_at);
      (map.get(k) ?? map.set(k, []).get(k)!).push(o);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set(weeks.slice(0, 1).map((w) => w[0])));

  async function sendToTeam() {
    if (sending) return;
    const lines = [
      ...order.groups.flatMap((g) =>
        g.lines.map((l) => ({
          stock_item_id: l.item.id,
          product_name: l.item.name,
          qty: l.qty,
          unit: l.item.unit,
          unit_price: l.unitPrice,
          line_total: l.lineTotal,
        })),
      ),
      ...manual.map((m) => ({
        stock_item_id: m.stock_item_id,
        product_name: m.product_name,
        qty: m.qty,
        unit: m.unit,
        unit_price: null,
        line_total: null,
      })),
    ];
    if (lines.length === 0) {
      setMsg('Nothing to send — add items first.');
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/stock-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supplier: 'Team', lines }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; items?: number; total?: number };
      if (!res.ok) setMsg(json?.error ?? 'Could not send the order.');
      else {
        // Also add the suggested low-stock lines to the team's open reorder
        // requests (the manual ones are already there). Deduped server-side.
        const suggested = order.groups.flatMap((g) =>
          g.lines.map((l) => ({
            stock_item_id: l.item.id,
            product_name: l.item.name,
            qty: l.qty,
            unit: l.item.unit,
            supplier: l.supplier,
          })),
        );
        if (suggested.length > 0) {
          await fetch('/api/procurepulse/reorder-request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lines: suggested }),
          }).catch(() => {});
        }
        setMsg(`Sent to team — ${json.items} item${json.items === 1 ? '' : 's'}, ${rand(json.total ?? 0)}.`);
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setSending(false);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || picked?.name === query.trim()) return [];
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query, picked]);

  function choose(it: ItemLite) {
    setPicked(it);
    setQuery(it.name);
    setUnit(it.unit || '');
    if (it.cheapest_supplier) setSupplier(it.cheapest_supplier);
  }

  function resetForm() {
    setOpen(false);
    setQuery('');
    setPicked(null);
    setQty('');
    setUnit('');
    setSupplier('');
    setNote('');
  }

  async function submit() {
    const name = query.trim();
    if (!name || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/reorder-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_name: name,
          stock_item_id: picked?.id ?? null,
          qty: Number(qty) || 0,
          unit: unit || null,
          supplier: supplier || null,
          note: note || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not add the request.');
      } else {
        resetForm();
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch('/api/procurepulse/reorder-request', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) router.refresh();
    } catch {
      /* ignore — surfaced on next load */
    }
  }

  const field =
    'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div className="mt-4 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Left column: suggested orders + manual requests */}
      <div className="space-y-4">
        {/* Suggested from low stock */}
        <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3">
            <div className="text-[14px] font-semibold text-[#1A1C1E]">Suggested from low stock</div>
            <div className="text-[12px] text-[#9A9DA1]">{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</div>
          </div>

          {order.groups.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-[#9A9DA1]">
              Nothing is low or out — you&apos;re well stocked.
            </div>
          ) : (
            <>
              <div className="flex items-center px-4 py-2 text-[12px] font-medium text-[#9A9DA1]">
                <div className="flex-1">Product</div>
                <div className="w-[110px] text-right">Qty</div>
                <div className="w-[110px] text-right">Unit price</div>
                <div className="w-[120px] text-right">Line total</div>
              </div>
              {order.groups.map((group) => (
                <div key={group.supplier}>
                  <div className="flex items-center justify-between bg-[#FAFAF8] px-4 py-2.5">
                    <div className="text-[13px] font-medium text-[#1A1C1E]">{group.supplier}</div>
                    <div className="text-[12px] text-[#5F6368]">Subtotal {rand(group.subtotal)}</div>
                  </div>
                  {group.lines.map((line) => (
                    <div
                      key={line.item.id}
                      className="flex items-center border-t border-[#EFEFEC] px-4 py-3 text-[13px] text-[#1A1C1E]"
                    >
                      <div className="flex-1 font-medium">{line.item.name}</div>
                      <div className="w-[110px] text-right text-[#5F6368]">
                        {line.qty} {line.item.unit}
                      </div>
                      <div className="w-[110px] text-right text-[#5F6368]">{rand(line.unitPrice)}</div>
                      <div className="w-[120px] text-right font-medium">{rand(line.lineTotal)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Manual reorder requests */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3">
            <div className="text-[14px] font-semibold text-[#1A1C1E]">Your reorder requests</div>
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1E5E54] transition-colors hover:border-[#1E5E54]/40"
              >
                + Add request
              </button>
            ) : null}
          </div>

          {open ? (
            <div className="border-b border-[#EFEFEC] bg-[#FBFBF9] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative sm:col-span-2">
                  <input
                    className={field}
                    placeholder="Product (search catalogue or type a new one)"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPicked(null);
                    }}
                  />
                  {matches.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[44px] z-20 max-h-[220px] overflow-auto rounded-lg border border-[#E7E7E2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]">
                      {matches.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => choose(it)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#1A1C1E] hover:bg-[#FAFAF8]"
                        >
                          <span className="truncate">{it.name}</span>
                          <span className="ml-2 shrink-0 text-[11px] text-[#9A9DA1]">{it.unit}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <input className={field} inputMode="decimal" placeholder="Quantity" value={qty} onChange={(e) => setQty(sanitizeDecimal(e.target.value))} />
                <input className={field} placeholder="Unit (boxes, kg, bags…)" value={unit} onChange={(e) => setUnit(e.target.value)} />
                <input className={field} placeholder="Supplier (optional)" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                <input className={field} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                {msg ? <span className="mr-auto text-[12px] text-[#A32D2D]">{msg}</span> : null}
                <button type="button" onClick={resetForm} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !query.trim()}
                  className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                >
                  {busy ? 'Adding…' : 'Add request'}
                </button>
              </div>
            </div>
          ) : null}

          {manual.length === 0 && !open ? (
            <div className="px-4 py-10 text-center text-[13px] text-[#9A9DA1]">
              No manual requests yet. Add anything you want to order that isn&apos;t flagged automatically.
            </div>
          ) : (
            manual.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-[#EFEFEC] px-4 py-3 text-[13px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[#1A1C1E]">{r.product_name}</div>
                  <div className="mt-0.5 text-[12px] text-[#9A9DA1]">
                    {r.qty ? `${r.qty}${r.unit ? ' ' + r.unit : ''}` : '—'}
                    {r.supplier ? ` · ${r.supplier}` : ''}
                    {r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void patch(r.id, { status: 'ordered' })}
                  className="shrink-0 rounded-lg border border-[#D7DAD8] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#1E5E54] transition-colors hover:border-[#1E5E54]/40"
                >
                  Mark ordered
                </button>
                <button
                  type="button"
                  onClick={() => void patch(r.id, { status: 'cancelled' })}
                  aria-label="Cancel request"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9A9DA1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right column: order summary */}
      <div className="h-fit rounded-2xl border border-[#E7E7E2] bg-white p-4">
        <div className="text-[14px] font-medium text-[#1A1C1E]">Order summary</div>

        <div className="mt-4 text-[13px] text-[#9A9DA1]">Suggested total (excl. VAT)</div>
        <div className="mt-1 text-[28px] font-bold text-[#1A1C1E]">{rand(order.total)}</div>

        <div className="my-4 border-t border-[#EFEFEC]" />

        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[#5F6368]">Suggested items</span>
            <span className="font-medium text-[#1A1C1E]">{order.itemCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6368]">Suppliers</span>
            <span className="font-medium text-[#1A1C1E]">{order.groups.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6368]">Your requests</span>
            <span className="font-medium text-[#1A1C1E]">{manual.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6368]">VAT (15%)</span>
            <span className="font-medium text-[#1A1C1E]">{rand(order.total * 0.15)}</span>
          </div>
        </div>

        <div className="my-4 border-t border-[#EFEFEC]" />

        <div className="flex items-center justify-between text-[14px]">
          <span className="font-medium text-[#1A1C1E]">Total incl. VAT</span>
          <span className="font-bold text-[#1A1C1E]">{rand(order.total * 1.15)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void sendToTeam()}
            disabled={sending}
            className="inline-flex items-center justify-center rounded-lg bg-[#1E5E54] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send to team'}
          </button>
          {msg ? <p className="text-center text-[12px] text-[#0F4C44]">{msg}</p> : null}
        </div>
      </div>
      </div>

      {/* Order history — grouped by week, collapsible */}
      <div className="rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="border-b border-[#E7E7E2] px-4 py-3 text-[14px] font-semibold text-[#1A1C1E]">
          Order history
        </div>
        {weeks.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[#9A9DA1]">
            No stock orders yet. Send one to your team above and it&apos;ll be tracked here by week.
          </div>
        ) : (
          weeks.map(([key, list]) => {
            const isOpen = openWeeks.has(key);
            const weekTotal = list.reduce((s, o) => s + (Number(o.total) || 0), 0);
            return (
              <div key={key} className="border-b border-[#F0F0EC] last:border-b-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenWeeks((prev) => {
                      const n = new Set(prev);
                      if (n.has(key)) n.delete(key);
                      else n.add(key);
                      return n;
                    })
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#FAFAF8]"
                >
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[#1A1C1E]">
                    <span aria-hidden className="text-[#9A9DA1]">{isOpen ? '▾' : '▸'}</span>
                    {weekLabel(key)}
                  </span>
                  <span className="text-[12px] text-[#9A9DA1]">
                    {list.length} order{list.length === 1 ? '' : 's'} · {rand(weekTotal)}
                  </span>
                </button>
                {isOpen ? (
                  <div className="px-4 pb-2">
                    {list.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between border-t border-[#F4F4F1] py-2.5 text-[13px] first:border-t-0"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[#1A1C1E]">{fmtDate(o.created_at)}</div>
                          <div className="text-[12px] text-[#9A9DA1]">
                            {o.item_count} item{o.item_count === 1 ? '' : 's'}
                            {o.supplier ? ` · ${o.supplier}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#E3F0ED] px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#1E5E54]">
                            {o.status}
                          </span>
                          <span className="font-medium text-[#1A1C1E]">{rand(o.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
