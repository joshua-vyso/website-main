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
  nocost: { bg: '#F0F0EC', fg: '#5F6368', label: 'No cost' },
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
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Products</h1>
        <div className="mt-6 rounded-2xl border border-[#E7E7E2] bg-white px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-[#1A1C1E]">No pricing yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#5F6368]">
            Create a price list to set margins on your catalogue. Your products and their costs are already here from
            ProcurePulse.
          </p>
          <Link
            href="/app/pricepilot/price-lists"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#1E5E54] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45]"
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
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Products</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">
            {rows.length} products · avg {avgMargin}% margin · target {Math.round(target)}%
          </p>
        </div>
        <Link
          href="/app/pricepilot/recommendations"
          className="inline-flex items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/40"
        >
          {belowCount > 0 ? `Review ${belowCount} below target →` : 'Recommendations →'}
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-9 w-56 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#1E5E54]"
        />
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                filter === f.key ? 'bg-[#1E5E54] text-white' : 'border border-[#E7E7E2] bg-white text-[#5F6368] hover:border-[#1E5E54]/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]"
        >
          <option value="margin-asc">Lowest margin first</option>
          <option value="margin-desc">Highest margin first</option>
          <option value="sell-desc">Highest price</option>
          <option value="units-desc">Most sold (30d)</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
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
                  <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-[#9A9DA1]">
                    No products match.
                  </td>
                </tr>
              ) : (
                shown.map((r) => {
                  const st = statusOf(r, target);
                  const ss = STATUS_STYLE[st];
                  return (
                    <tr key={r.id} className="border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                      <td className="px-5 py-3 font-medium text-[#1A1C1E]">
                        <Link href={`/app/pricepilot/products/${r.id}`} className="hover:text-[#1E5E54]">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[#5F6368]">{r.category ?? '—'}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#5F6368]">
                        {r.cost != null ? zar2(r.cost) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-[#1A1C1E]">{Math.round(r.margin)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#1A1C1E]">
                        {r.cost != null ? zar2(r.sell) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[#9A9DA1]">{r.units > 0 ? Math.round(r.units) : '—'}</td>
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
