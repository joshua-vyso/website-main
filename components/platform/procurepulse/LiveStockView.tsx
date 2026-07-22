'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stockStatus } from '@/lib/platform/procurepulse';
import { PpButton, StockStatusPill } from './ui';
import type { StockItem } from '@/lib/platform/types';

type StatusFilter = 'all' | 'low' | 'out';

/** Most-recent OrderFlow movement per stock item: { qty, unit }. */
export type RecentActivity = Record<string, { qty: number; unit: string | null }>;

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function LiveStockView({
  items,
  recent,
  lowCount,
}: {
  items: StockItem[];
  recent: RecentActivity;
  lowCount: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [categorising, setCategorising] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.category && it.category.trim()) set.add(it.category.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const uncategorised = useMemo(
    () => items.filter((it) => !it.category || !it.category.trim()).length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (status !== 'all' && stockStatus(it) !== status) return false;
      if (category !== 'all' && (it.category ?? '').trim() !== category) return false;
      if (q && !it.name.toLowerCase().includes(q) && !(it.pack ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, status, category]);

  async function autoCategorise() {
    if (categorising) return;
    setCategorising(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/categorise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // When nothing is uncategorised, "Re-categorise" re-runs across everything.
        body: JSON.stringify({ all: uncategorised === 0 }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; updated?: number };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not categorise products.');
      } else if (json.updated) {
        setMsg(`Categorised ${json.updated} product${json.updated === 1 ? '' : 's'}.`);
        router.refresh();
      } else {
        setMsg('Everything is already categorised.');
      }
    } catch {
      setMsg('Could not reach the categoriser.');
    } finally {
      setCategorising(false);
    }
  }

  const pill = (active: boolean) =>
    `h-11 rounded-[12px] px-4 text-[13px] font-medium transition-colors ${
      active
        ? 'bg-[#1F5FA8] text-white'
        : 'border border-[#E4E9F0] bg-white text-[#6B6F68] hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
    }`;

  return (
    <>
      <div className="mt-4 mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          className="h-11 w-[240px] rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <button type="button" onClick={() => setStatus('all')} className={pill(status === 'all')}>
          All
        </button>
        <button type="button" onClick={() => setStatus('low')} className={pill(status === 'low')}>
          Low
        </button>
        <button type="button" onClick={() => setStatus('out')} className={pill(status === 'out')}>
          Out
        </button>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className={`h-11 cursor-pointer rounded-[12px] border px-4 text-[13px] font-medium outline-none focus:border-[#3E7BC4] ${
            category === 'all'
              ? 'border-[#E4E9F0] bg-white text-[#6B6F68]'
              : 'border-[#1F5FA8] bg-[#1F5FA8] text-white'
          }`}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => void autoCategorise()}
          disabled={categorising}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#1F5FA8] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
        >
          {categorising ? 'Categorising…' : uncategorised > 0 ? `✦ Categorise ${uncategorised}` : '✦ Re-categorise'}
        </button>
        <PpButton href="/app/procurepulse/reorder">Reorder low · {lowCount}</PpButton>
      </div>

      {msg ? <p className="mb-3 text-[13px] text-[#174C87]">{msg}</p> : null}

      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="flex items-center border-b border-[#EEF1F5] pb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <div className="flex-1">Product</div>
          <div className="w-[140px] text-right">Stock on hand (kg)</div>
          <div className="w-[120px] text-right">Units on hand</div>
          <div className="w-[110px] pl-5">Stock status</div>
          <div className="w-[140px] text-right">Recent activity</div>
          <div className="w-[90px] text-right">Updated</div>
          <div className="w-[140px] pl-4">Category</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#8A8E86]">
            {items.length === 0 ? 'No stock items yet.' : 'No products match these filters.'}
          </div>
        ) : (
          filtered.map((item) => {
            const r = recent[item.id];
            return (
              <Link
                key={item.id}
                href={`/app/procurepulse/stock/${item.id}`}
                className="flex items-center border-t border-[#F4F5F7] py-3.5 text-[14px] text-[#171A17] hover:bg-[#F5F9FE]"
              >
                <div className="flex-1 font-semibold">{item.name}</div>
                <div className="of-num w-[140px] text-right">
                  {item.kg_per_unit != null && item.kg_per_unit > 0 ? (
                    <span className="font-semibold text-[#171A17]">
                      {fmtQty(item.on_hand * item.kg_per_unit)} kg
                    </span>
                  ) : (
                    <span className="text-[#C2C4C0]">—</span>
                  )}
                </div>
                <div className="of-num w-[120px] text-right text-[#6B6F68]">
                  {fmtQty(item.on_hand)} {item.unit}
                </div>
                <div className="w-[110px] pl-5">
                  <StockStatusPill status={stockStatus(item)} />
                </div>
                <div className="w-[140px] text-right">
                  {r ? (
                    <span className="of-num text-[#3C3F43]">
                      {fmtQty(r.qty)} {r.unit ?? item.unit}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[#C2C4C0]">No orders yet</span>
                  )}
                </div>
                <div className="of-num w-[90px] text-right text-[13px] text-[#A0A49C]">{timeAgo(item.updated_at)}</div>
                <div className="w-[140px] pl-4 text-[#6B6F68]">{item.category?.trim() || '—'}</div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
