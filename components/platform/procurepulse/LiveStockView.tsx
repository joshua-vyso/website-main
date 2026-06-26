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
    `rounded-full px-3 py-1.5 text-[12px] transition-colors ${
      active
        ? 'bg-[#1A1C1E] text-white'
        : 'border border-[#E7E7E2] bg-white text-[#5F6368] hover:bg-black/[0.03]'
    }`;

  return (
    <>
      <div className="mt-4 mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products"
          className="h-[34px] w-[240px] rounded-lg border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
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
          className={`h-[31px] cursor-pointer rounded-full border px-3 text-[12px] focus:outline-none ${
            category === 'all'
              ? 'border-[#E7E7E2] bg-white text-[#5F6368]'
              : 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1E5E54] transition-colors hover:border-[#1E5E54]/40 disabled:opacity-50"
        >
          {categorising ? 'Categorising…' : uncategorised > 0 ? `✦ Categorise ${uncategorised}` : '✦ Re-categorise'}
        </button>
        <PpButton href="/app/procurepulse/reorder">Reorder low · {lowCount}</PpButton>
      </div>

      {msg ? <p className="mb-3 text-[12px] text-[#0F4C44]">{msg}</p> : null}

      <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
        <div className="flex items-center border-b border-[#E7E7E2] pb-2.5 text-[12px] font-medium text-[#9A9DA1]">
          <div className="flex-1">Product</div>
          <div className="w-[120px]">Pack</div>
          <div className="w-[150px]">Category</div>
          <div className="w-[110px] text-right">On hand</div>
          <div className="w-[90px]">Status</div>
          <div className="w-[150px] text-right">Recent activity</div>
          <div className="w-[100px] text-right">Updated</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#9A9DA1]">
            {items.length === 0 ? 'No stock items yet.' : 'No products match these filters.'}
          </div>
        ) : (
          filtered.map((item) => {
            const r = recent[item.id];
            return (
              <Link
                key={item.id}
                href={`/app/procurepulse/stock/${item.id}`}
                className="flex items-center border-t border-[#EFEFEC] py-3.5 text-[13px] text-[#1A1C1E] hover:bg-black/[0.02]"
              >
                <div className="flex-1 font-medium">{item.name}</div>
                <div className="w-[120px] text-[#5F6368]">{item.pack ?? '—'}</div>
                <div className="w-[150px] text-[#5F6368]">{item.category?.trim() || '—'}</div>
                <div className="w-[110px] text-right">
                  {item.on_hand} {item.unit}
                </div>
                <div className="w-[90px]">
                  <StockStatusPill status={stockStatus(item)} />
                </div>
                <div className="w-[150px] text-right">
                  {r ? (
                    <span className="text-[#3C3F43]">
                      {fmtQty(r.qty)} {r.unit ?? item.unit}
                    </span>
                  ) : (
                    <span className="text-[#C2C4C0]">No orders yet</span>
                  )}
                </div>
                <div className="w-[100px] text-right text-[#9A9DA1]">{timeAgo(item.updated_at)}</div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
