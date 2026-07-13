'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import type { StockItem, StockThreshold } from '@/lib/platform/types';

interface Row {
  id: string; // real uuid, or `new-N`
  name: string;
}

const PAGE = 50;

/** Freshness threshold in a days-and-hours label, e.g. "3d 4h", "2d", "6h". */
function fmtFreshness(value: number | null, unit: string | null): string {
  if (value == null) return '—';
  const hours = unit === 'hours' ? value : value * 24;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (d && h) return `${d}d ${h}h`;
  if (d) return `${d}d`;
  return `${h}h`;
}

/**
 * Products overview — the editable catalogue (names, add/delete). Unit, low-stock
 * threshold and freshness are READ-ONLY here; they're set on the Units and
 * Thresholds tabs and shown here so this is the one place that lists every product
 * with the parameters that drive the rest of the module.
 */
export function ProductsOverview({
  items,
  thresholds,
}: {
  items: StockItem[];
  thresholds: StockThreshold[];
}) {
  const router = useRouter();
  const { org } = usePlatform();

  const meta = useMemo(() => {
    const t = new Map(thresholds.map((x) => [x.stock_item_id, x]));
    return new Map(
      items.map((it) => {
        const th = t.get(it.id);
        return [
          it.id,
          {
            unit: it.unit || '—',
            low: th?.low_threshold ?? it.low_threshold ?? null,
            freshness: fmtFreshness(th?.freshness_value ?? null, th?.freshness_unit ?? 'days'),
          },
        ];
      }),
    );
  }, [items, thresholds]);

  const [rows, setRows] = useState<Row[]>(() => items.map((i) => ({ id: i.id, name: i.name })));
  const [baseline] = useState<Map<string, string>>(() => new Map(items.map((i) => [i.id, i.name])));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const tempRef = useState(() => ({ n: 0 }))[0];

  function setName(id: string, name: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }
  function addProduct() {
    tempRef.n += 1;
    setRows((prev) => [{ id: `new-${tempRef.n}`, name: '' }, ...prev]);
    setPage(0);
  }
  function removeProduct(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const dirty =
    rows.some((r) => r.id.startsWith('new-') ? r.name.trim() !== '' : baseline.get(r.id) !== r.name) ||
    [...baseline.keys()].some((id) => !rows.find((r) => r.id === id));

  async function save() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    setMsg(null);
    const errors: unknown[] = [];

    const inserts = rows.filter((r) => r.id.startsWith('new-') && r.name.trim());
    const updates = rows.filter((r) => !r.id.startsWith('new-') && baseline.get(r.id) !== r.name && r.name.trim());
    const deletes = [...baseline.keys()].filter((id) => !rows.find((r) => r.id === id));

    if (inserts.length) {
      const { error } = await supabase.from('pp_stock_items').insert(
        inserts.map((r) => ({
          org_id: org.id,
          name: r.name.trim(),
          unit: 'boxes',
          on_hand: 0,
          low_threshold: 0,
          currency: 'ZAR',
        })),
      );
      if (error) errors.push(error);
    }
    for (const r of updates) {
      const { error } = await supabase.from('pp_stock_items').update({ name: r.name.trim() }).eq('id', r.id);
      if (error) errors.push(error);
    }
    if (deletes.length) {
      // Clear dependent rows first so FKs don't block the delete.
      await supabase.from('pp_item_suppliers').delete().in('stock_item_id', deletes);
      await supabase.from('pp_movements').delete().in('stock_item_id', deletes);
      const { error } = await supabase.from('pp_stock_items').delete().in('id', deletes);
      if (error) errors.push(error);
    }

    setBusy(false);
    if (errors.length) {
      setMsg(
        errors.some((e) => isUniqueViolation(e as { code?: string; message?: string }))
          ? 'A product with that name already exists — rename the duplicate and save again.'
          : 'Some changes could not be saved — please try again.',
      );
      return;
    }
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  const COLS = 'grid grid-cols-[minmax(180px,1fr)_120px_120px_120px_40px] gap-2 items-center';
  const cell =
    'h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search products…"
            className="h-10 w-72 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
          />
          <span className="text-[13px] text-[#9A9DA1]">{filtered.length} products</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addProduct}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#1E5E54]/40 bg-white px-3.5 text-[14px] font-medium text-[#1E5E54] transition-colors hover:bg-[#E9EFEC]"
          >
            + Add product
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !dirty}
            className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[13px] text-[#5F6368]">
        The master list. Unit, low threshold and freshness are set on the Units and Thresholds tabs
        and shown here read-only — they apply everywhere in the module.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className={`${COLS} border-b border-[#F0F0EC] bg-[#FBFBF9] px-4 py-2.5 text-[12px] text-[#5F6368]`}>
          <span>Product name</span>
          <span>Unit</span>
          <span>Low threshold</span>
          <span>Freshness</span>
          <span />
        </div>
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#9A9DA1]">
            {rows.length === 0 ? 'No products yet — add your first.' : 'No products match your search.'}
          </div>
        ) : (
          pageRows.map((r) => {
            const m = meta.get(r.id);
            return (
              <div key={r.id} className={`${COLS} border-b border-[#F0F0EC] px-4 py-2 last:border-b-0`}>
                <input
                  className={cell}
                  value={r.name}
                  placeholder="Product name"
                  onChange={(e) => setName(r.id, e.target.value)}
                />
                <span className="text-[13px] text-[#5F6368]">{m?.unit ?? '—'}</span>
                <span className="text-[13px] text-[#5F6368]">{m?.low ?? '—'}</span>
                <span className="text-[13px] text-[#5F6368]">{m?.freshness ?? '—'}</span>
                <button
                  type="button"
                  onClick={() => removeProduct(r.id)}
                  aria-label="Remove product"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9A9DA1] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#5F6368]">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 disabled:opacity-40">‹ Prev</button>
          <span>Page {safePage + 1} of {pageCount}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 disabled:opacity-40">Next ›</button>
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-[12px] text-[#A32D2D]">{msg}</p> : null}
    </div>
  );
}
