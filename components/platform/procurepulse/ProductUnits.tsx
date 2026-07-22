'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UnitCombobox } from './UnitCombobox';
import type { ProductUnit, StockItem } from '@/lib/platform/types';

interface Row {
  stock_item_id: string;
  name: string;
  purchase_unit: string;
  stock_unit: string;
  recipe_unit: string;
  conversion_factor: string;
}

const PAGE = 50;

function exampleOf(r: Row): string {
  const f = Number(r.conversion_factor);
  if (!r.purchase_unit || !r.stock_unit || !Number.isFinite(f) || f <= 0) return '—';
  return `1 ${r.purchase_unit} = ${f} ${r.stock_unit}`;
}

export function ProductUnits({
  items,
  units,
  productUnits,
}: {
  items: StockItem[];
  units: string[];
  productUnits: ProductUnit[];
}) {
  const router = useRouter();
  const byItem = useMemo(() => new Map(productUnits.map((u) => [u.stock_item_id, u])), [productUnits]);

  const initial = useMemo<Row[]>(
    () =>
      items.map((it) => {
        const u = byItem.get(it.id);
        return {
          stock_item_id: it.id,
          name: it.name,
          purchase_unit: u?.purchase_unit ?? '',
          // Default the stock unit to the catalogue unit until configured.
          stock_unit: u?.stock_unit ?? it.unit ?? '',
          recipe_unit: u?.recipe_unit ?? '',
          conversion_factor: u?.conversion_factor == null ? '' : String(u.conversion_factor),
        };
      }),
    [items, byItem],
  );

  const [rows, setRows] = useState<Row[]>(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function edit(id: string, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.stock_item_id === id ? { ...r, [key]: value } : r)));
    setDirty((d) => new Set(d).add(id));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  // Surface an invalid (non-positive / non-numeric) conversion factor before save.
  const badFactor = (v: string) => v.trim() !== '' && !(Number(v) > 0);

  async function save() {
    if (busy || dirty.size === 0) return;
    setBusy(true);
    setMsg(null);
    const payload = rows
      .filter((r) => dirty.has(r.stock_item_id))
      .map((r) => ({
        stock_item_id: r.stock_item_id,
        purchase_unit: r.purchase_unit,
        stock_unit: r.stock_unit,
        recipe_unit: r.recipe_unit,
        conversion_factor: r.conversion_factor,
      }));
    try {
      const res = await fetch('/api/procurepulse/product-units', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
      if (!res.ok) setMsg(json?.error ?? 'Could not save.');
      else {
        setDirty(new Set());
        setMsg(`Saved ${json.saved ?? payload.length} product${(json.saved ?? 0) === 1 ? '' : 's'}.`);
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const cell =
    'h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#3E7BC4]/40 focus:outline-none';
  const COLS = 'grid grid-cols-[minmax(150px,1fr)_120px_120px_120px_96px_minmax(120px,1fr)] gap-2 items-center';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-[#5F6368]">
          How each product is purchased, stocked and used in recipes, with the conversion factor.
          E.g. apples bought in boxes, stocked in kg, recipe unit kg. Conversion must be a positive
          number.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search products…"
            className="h-10 w-60 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || dirty.size === 0}
            className="inline-flex h-10 items-center rounded-xl bg-[#1F5FA8] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirty.size > 0 ? `Save changes (${dirty.size})` : 'Saved'}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className={`${COLS} border-b border-[#F0F0EC] bg-[#FBFBF9] px-4 py-2.5 text-[12px] text-[#5F6368]`}>
          <span>Product</span>
          <span>Purchase unit</span>
          <span>Stock unit</span>
          <span>Recipe unit</span>
          <span className="text-right">Factor</span>
          <span>Example</span>
        </div>
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#9A9DA1]">
            {items.length === 0 ? 'No products yet.' : 'No products match your search.'}
          </div>
        ) : (
          pageRows.map((r) => (
            <div key={r.stock_item_id} className={`${COLS} border-b border-[#F0F0EC] px-4 py-2 last:border-b-0`}>
              <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{r.name}</div>
              <UnitCombobox value={r.purchase_unit} units={units} className={cell} onChange={(v) => edit(r.stock_item_id, 'purchase_unit', v)} />
              <UnitCombobox value={r.stock_unit} units={units} className={cell} onChange={(v) => edit(r.stock_item_id, 'stock_unit', v)} />
              <UnitCombobox value={r.recipe_unit} units={units} className={cell} onChange={(v) => edit(r.stock_item_id, 'recipe_unit', v)} />
              <input
                className={`${cell} text-right ${badFactor(r.conversion_factor) ? 'border-[#A32D2D]/60' : ''}`}
                inputMode="decimal"
                value={r.conversion_factor}
                placeholder="—"
                onChange={(e) => edit(r.stock_item_id, 'conversion_factor', e.target.value.replace(/[^0-9.]/g, ''))}
              />
              <div className="truncate text-[12px] text-[#5F6368]">{exampleOf(r)}</div>
            </div>
          ))
        )}
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#5F6368]">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 disabled:opacity-40">‹ Prev</button>
          <span>Page {safePage + 1} of {pageCount}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 disabled:opacity-40">Next ›</button>
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-[12px] text-[#174C87]">{msg}</p> : null}
    </div>
  );
}
