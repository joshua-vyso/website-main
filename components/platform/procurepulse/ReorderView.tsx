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
  const [reordering, setReordering] = useState(false);
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

  // Reorder all suggested low-stock lines: file them as open reorder requests
  // (deduped server-side), so they land in "Your reorder requests" without the
  // full send-to-team flow.
  async function reorderAllSuggested() {
    if (reordering) return;
    const lines = order.groups.flatMap((g) =>
      g.lines.map((l) => ({
        stock_item_id: l.item.id,
        product_name: l.item.name,
        qty: l.qty,
        unit: l.item.unit,
        supplier: l.supplier,
      })),
    );
    if (lines.length === 0) return;
    setReordering(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/reorder-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; created?: number };
      if (!res.ok) setMsg(json?.error ?? 'Could not add the items.');
      else {
        setMsg(
          json.created
            ? `Added ${json.created} item${json.created === 1 ? '' : 's'} to your reorder requests.`
            : 'Those items are already in your reorder requests.',
        );
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setReordering(false);
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
    'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  return (
    <div className="mt-4 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Left column: suggested orders + manual requests */}
      <div className="space-y-4">
        {/* Suggested from low stock */}
        <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] px-5 py-4">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Suggested from low stock</div>
            <div className="flex items-center gap-3">
              <span className="of-num text-[12px] text-[#A0A49C]">{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</span>
              {order.itemCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void reorderAllSuggested()}
                  disabled={reordering}
                  className="inline-flex h-[38px] items-center rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
                >
                  {reordering ? 'Adding…' : `Reorder all · ${order.itemCount}`}
                </button>
              ) : null}
            </div>
          </div>

          {order.groups.length === 0 ? (
            <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
              Nothing is low or out — you&apos;re well stocked.
            </div>
          ) : (
            <>
              <div className="flex items-center px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                <div className="flex-1">Product</div>
                <div className="w-[110px] text-right">Qty</div>
                <div className="w-[110px] text-right">Unit price</div>
                <div className="w-[120px] text-right">Line total</div>
              </div>
              {order.groups.map((group) => (
                <div key={group.supplier}>
                  <div className="flex items-center justify-between bg-[#F5F9FE] px-5 py-2.5">
                    <div className="text-[13px] font-semibold text-[#171A17]">{group.supplier}</div>
                    <div className="text-[12px] text-[#6B6F68]">Subtotal <span className="of-num">{rand(group.subtotal)}</span></div>
                  </div>
                  {group.lines.map((line) => (
                    <div
                      key={line.item.id}
                      className="flex items-center border-t border-[#F4F5F7] px-5 py-3 text-[14px] text-[#171A17]"
                    >
                      <div className="flex-1 font-semibold">{line.item.name}</div>
                      <div className="of-num w-[110px] text-right text-[#6B6F68]">
                        {line.qty} {line.item.unit}
                      </div>
                      <div className="of-num w-[110px] text-right text-[#6B6F68]">{rand(line.unitPrice)}</div>
                      <div className="of-num w-[120px] text-right font-semibold">{rand(line.lineTotal)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Manual reorder requests */}
        <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="flex items-center justify-between border-b border-[#EEF1F5] px-5 py-4">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Your reorder requests</div>
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-[38px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#1F5FA8] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                + Add request
              </button>
            ) : null}
          </div>

          {open ? (
            <div className="border-b border-[#EEF1F5] bg-[#FBFCFE] p-5">
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
                    <div className="absolute left-0 right-0 top-[48px] z-20 max-h-[220px] overflow-auto rounded-[12px] border border-[#EAEDF2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]">
                      {matches.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => choose(it)}
                          className="flex w-full items-center justify-between px-4 py-2 text-left text-[14px] text-[#171A17] hover:bg-[#F5F9FE]"
                        >
                          <span className="truncate">{it.name}</span>
                          <span className="ml-2 shrink-0 text-[11px] text-[#A0A49C]">{it.unit}</span>
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
                {msg ? <span className="mr-auto text-[13px] text-[#A32D2D]">{msg}</span> : null}
                <button type="button" onClick={resetForm} className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-black/[0.03]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !query.trim()}
                  className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
                >
                  {busy ? 'Adding…' : 'Add request'}
                </button>
              </div>
            </div>
          ) : null}

          {manual.length === 0 && !open ? (
            <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
              No manual requests yet. Add anything you want to order that isn&apos;t flagged automatically.
            </div>
          ) : (
            manual.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-[#F4F5F7] px-5 py-3 text-[14px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#171A17]">{r.product_name}</div>
                  <div className="mt-0.5 text-[12px] text-[#A0A49C]">
                    {r.qty ? `${r.qty}${r.unit ? ' ' + r.unit : ''}` : '—'}
                    {r.supplier ? ` · ${r.supplier}` : ''}
                    {r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void patch(r.id, { status: 'ordered' })}
                  className="inline-flex h-[34px] shrink-0 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#1F5FA8] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
                >
                  Mark ordered
                </button>
                <button
                  type="button"
                  onClick={() => void patch(r.id, { status: 'cancelled' })}
                  aria-label="Cancel request"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8A8E86] hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right column: order summary */}
      <div className="h-fit rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display text-[16px] font-semibold text-[#171A17]">Order summary</div>

        <div className="mt-4 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Suggested total (excl. VAT)</div>
        <div className="of-num mt-2 text-[30px] font-semibold tracking-[-0.02em] text-[#171A17]">{rand(order.total)}</div>

        <div className="my-4 border-t border-[#EEF1F5]" />

        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[#6B6F68]">Suggested items</span>
            <span className="of-num font-semibold text-[#171A17]">{order.itemCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B6F68]">Suppliers</span>
            <span className="of-num font-semibold text-[#171A17]">{order.groups.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B6F68]">Your requests</span>
            <span className="of-num font-semibold text-[#171A17]">{manual.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B6F68]">VAT (15%)</span>
            <span className="of-num font-semibold text-[#171A17]">{rand(order.total * 0.15)}</span>
          </div>
        </div>

        <div className="my-4 border-t border-[#EEF1F5]" />

        <div className="flex items-center justify-between text-[14px]">
          <span className="font-medium text-[#171A17]">Total incl. VAT</span>
          <span className="of-num text-[16px] font-semibold text-[#171A17]">{rand(order.total * 1.15)}</span>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void sendToTeam()}
            disabled={sending}
            className="inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send to team'}
          </button>
          {msg ? <p className="text-center text-[13px] text-[#174C87]">{msg}</p> : null}
        </div>
      </div>
      </div>

      {/* Order history — grouped by week, collapsible */}
      <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display border-b border-[#EEF1F5] px-5 py-4 text-[16px] font-semibold text-[#171A17]">
          Order history
        </div>
        {weeks.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
            No stock orders yet. Send one to your team above and it&apos;ll be tracked here by week.
          </div>
        ) : (
          weeks.map(([key, list]) => {
            const isOpen = openWeeks.has(key);
            const weekTotal = list.reduce((s, o) => s + (Number(o.total) || 0), 0);
            return (
              <div key={key} className="border-b border-[#EEF1F5] last:border-b-0">
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
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[#F5F9FE]"
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-[#171A17]">
                    <span aria-hidden className="text-[#A0A49C]">{isOpen ? '▾' : '▸'}</span>
                    {weekLabel(key)}
                  </span>
                  <span className="of-num text-[12px] text-[#A0A49C]">
                    {list.length} order{list.length === 1 ? '' : 's'} · {rand(weekTotal)}
                  </span>
                </button>
                {isOpen ? (
                  <div className="px-5 pb-2">
                    {list.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between border-t border-[#F4F5F7] py-2.5 text-[14px] first:border-t-0"
                      >
                        <div className="min-w-0">
                          <div className="of-num font-semibold text-[#171A17]">{fmtDate(o.created_at)}</div>
                          <div className="text-[12px] text-[#A0A49C]">
                            {o.item_count} item{o.item_count === 1 ? '' : 's'}
                            {o.supplier ? ` · ${o.supplier}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#EAF2FC] px-2.5 py-1 text-[11px] font-medium capitalize text-[#1F5FA8]">
                            {o.status}
                          </span>
                          <span className="of-num font-semibold text-[#171A17]">{rand(o.total)}</span>
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
