'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { zar2 } from '@/lib/platform/pricepilot';

export interface ProductPriceRow {
  id: string;
  name: string;
  category: string | null;
  cost: number | null;
  margin: number;
  sell: number;
  units: number;
}

type Filter = 'all' | 'below' | 'on' | 'nocost';
type Sort = 'margin-asc' | 'margin-desc' | 'name' | 'sell-desc' | 'units-desc';

function statusOf(r: ProductPriceRow, target: number): 'below' | 'on' | 'nocost' {
  if (r.cost == null) return 'nocost';
  return r.margin < target ? 'below' : 'on';
}

const STATUS_STYLE = {
  below: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Below target' },
  on: { bg: '#E1F5EE', fg: '#0F6E56', label: 'On target' },
  nocost: { bg: '#EEF1F5', fg: '#6B6F68', label: 'No cost' },
} as const;

/** Pricing catalogue — every product with its cost, margin, sell price and target gap. */
export function ProductsPricingView({
  rows,
  target,
  hasBaseList,
}: {
  rows: ProductPriceRow[];
  target: number;
  hasBaseList: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('margin-asc');

  const belowCount = useMemo(() => rows.filter((r) => statusOf(r, target) === 'below').length, [rows, target]);
  const onCount = useMemo(() => rows.filter((r) => statusOf(r, target) === 'on').length, [rows, target]);
  const noCostCount = useMemo(() => rows.filter((r) => statusOf(r, target) === 'nocost').length, [rows, target]);
  const costed = useMemo(() => rows.filter((r) => r.cost != null), [rows]);
  const avgMargin = costed.length ? Math.round(costed.reduce((s, r) => s + r.margin, 0) / costed.length) : 0;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.category ?? '').toLowerCase().includes(q)) return false;
      const st = statusOf(r, target);
      if (filter === 'below') return st === 'below';
      if (filter === 'on') return st === 'on';
      if (filter === 'nocost') return st === 'nocost';
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'margin-asc':
          return a.margin - b.margin;
        case 'margin-desc':
          return b.margin - a.margin;
        case 'sell-desc':
          return b.sell - a.sell;
        case 'units-desc':
          return b.units - a.units;
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [rows, search, filter, sort, target]);

  if (!hasBaseList) {
    return (
      <div>
        <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Products</h1>
        <div className="mt-6 rounded-2xl border border-[#EAEDF2] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">No pricing yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#6B6F68]">
            Create a price list to set margins on your catalogue. Your products and their costs are already here from
            ProcurePulse.
          </p>
          <Link
            href="/app/pricepilot/price-lists"
            className="mt-4 inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
          >
            Create a price list →
          </Link>
        </div>
      </div>
    );
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${rows.length}` },
    { key: 'below', label: `Below target ${belowCount}` },
    { key: 'on', label: `On target ${onCount}` },
    { key: 'nocost', label: `No cost ${noCostCount}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Products</h1>
          <p className="of-num mt-1 text-[14px] text-[#8A8E86]">
            {rows.length} products · avg {avgMargin}% margin · target {Math.round(target)}%
          </p>
        </div>
        <Link
          href="/app/pricepilot/recommendations"
          className="inline-flex h-[42px] items-center justify-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
        >
          {belowCount > 0 ? `Review ${belowCount} below target →` : 'Recommendations →'}
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-9 w-56 rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[13px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                filter === f.key
                  ? 'border-[#3E7BC4] bg-[#1F5FA8] text-white'
                  : 'border-[#E2E6EC] bg-white text-[#6B6F68] hover:border-[#3E7BC4]/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto h-9 rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[13px] text-[#6B6F68] outline-none focus:border-[#3E7BC4]"
        >
          <option value="margin-asc">Lowest margin first</option>
          <option value="margin-desc">Highest margin first</option>
          <option value="sell-desc">Highest price</option>
          <option value="units-desc">Most sold (30d)</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-5 py-2.5 text-left font-medium">Product</th>
                <th className="px-3 py-2.5 text-left font-medium">Category</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="px-3 py-2.5 text-right font-medium">Sell</th>
                <th className="px-3 py-2.5 text-right font-medium">Sold 30d</th>
                <th className="px-5 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-[#8A8E86]">
                    No products match.
                  </td>
                </tr>
              ) : (
                shown.map((r) => {
                  const st = statusOf(r, target);
                  const ss = STATUS_STYLE[st];
                  return (
                    <tr key={r.id} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                      <td className="px-5 py-3 font-semibold text-[#171A17]">
                        <Link href={`/app/pricepilot/products/${r.id}`} className="hover:text-[#174C87]">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[#6B6F68]">{r.category ?? '—'}</td>
                      <td className="of-num px-3 py-3 text-right text-[#6B6F68]">
                        {r.cost != null ? zar2(r.cost) : '—'}
                      </td>
                      <td className="of-num px-3 py-3 text-right font-semibold text-[#171A17]">{Math.round(r.margin)}%</td>
                      <td className="of-num px-3 py-3 text-right text-[#171A17]">
                        {r.cost != null ? zar2(r.sell) : '—'}
                      </td>
                      <td className="of-num px-3 py-3 text-right text-[#A0A49C]">{r.units > 0 ? Math.round(r.units) : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: ss.bg, color: ss.fg }}
                        >
                          {ss.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
