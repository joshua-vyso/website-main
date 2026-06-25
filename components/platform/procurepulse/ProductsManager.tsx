'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { PageHead } from './ui';
import type { StockItem } from '@/lib/platform/types';

/** One editable product row (a subset of pp_stock_items + a client id). */
interface Row {
  id: string; // real uuid, or `new-N` for an unsaved product
  name: string;
  unit: string;
  low_threshold: number;
  avg_unit_price: number | null;
  on_hand: number;
  category: string | null;
}

const PAGE_SIZE = 50;

function toRow(s: StockItem): Row {
  return {
    id: s.id,
    name: s.name,
    unit: s.unit ?? '',
    low_threshold: Number(s.low_threshold ?? 0),
    avg_unit_price: s.avg_unit_price,
    on_hand: Number(s.on_hand ?? 0),
    category: s.category,
  };
}

const EDITABLE: (keyof Row)[] = ['name', 'unit', 'low_threshold', 'avg_unit_price'];

function rowChanged(a: Row, b: Row): boolean {
  return EDITABLE.some((k) => a[k] !== b[k]);
}

/**
 * The Products catalog editor — the single source of truth for ProcurePulse
 * stock, PricePilot pricing and OrderFlow invoicing. Edit names, units of
 * measurement, low-stock thresholds and base price inline; add or delete
 * products; full undo/redo of the working set; one "Save changes" diffs the
 * working set against the server and persists inserts / updates / deletes.
 */
export function ProductsManager({ items }: { items: StockItem[] }) {
  const router = useRouter();
  const { org } = usePlatform();

  const [working, setWorking] = useState<Row[]>(() => items.map(toRow));
  const [baseline, setBaseline] = useState<Map<string, Row>>(
    () => new Map(items.map((s) => [s.id, toRow(s)])),
  );
  const [past, setPast] = useState<Row[][]>([]);
  const [future, setFuture] = useState<Row[][]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const tempRef = useRef(0);
  const lastEdit = useRef<string | null>(null);

  /** Push the given snapshot onto the undo stack and clear redo. */
  function pushHistory(snapshot: Row[]) {
    setPast((p) => [...p.slice(-49), snapshot]);
    setFuture([]);
  }

  function editField(id: string, key: keyof Row, value: string | number | null) {
    const editKey = `${id}:${key}`;
    setWorking((prev) => {
      // Coalesce consecutive edits to the SAME cell into one history entry, so
      // undo reverts a whole field edit rather than character-by-character.
      if (lastEdit.current !== editKey) {
        pushHistory(prev);
        lastEdit.current = editKey;
      }
      return prev.map((r) => (r.id === id ? { ...r, [key]: value } : r));
    });
  }

  function addProduct() {
    lastEdit.current = null;
    const id = `new-${tempRef.current++}`;
    setWorking((prev) => {
      pushHistory(prev);
      return [{ id, name: '', unit: '', low_threshold: 0, avg_unit_price: null, on_hand: 0, category: null }, ...prev];
    });
    setSearch('');
    setPage(0);
  }

  function deleteRow(id: string) {
    lastEdit.current = null;
    setWorking((prev) => {
      pushHistory(prev);
      return prev.filter((r) => r.id !== id);
    });
  }

  function undo() {
    lastEdit.current = null;
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [working, ...f].slice(0, 50));
      setWorking(prev);
      return p.slice(0, -1);
    });
  }

  function redo() {
    lastEdit.current = null;
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p.slice(-49), working]);
      setWorking(next);
      return f.slice(1);
    });
  }

  // What changed vs the server baseline.
  const diff = useMemo(() => {
    const inserts: Row[] = [];
    const updates: Row[] = [];
    const workingIds = new Set(working.map((r) => r.id));
    for (const r of working) {
      if (r.id.startsWith('new-')) {
        if (r.name.trim()) inserts.push(r); // skip blank draft rows
      } else {
        const base = baseline.get(r.id);
        if (base && rowChanged(base, r)) updates.push(r);
      }
    }
    const deletes = [...baseline.keys()].filter((id) => !workingIds.has(id));
    return { inserts, updates, deletes };
  }, [working, baseline]);

  const dirtyCount = diff.inserts.length + diff.updates.length + diff.deletes.length;

  async function save() {
    if (busy || dirtyCount === 0) return;
    setBusy(true);
    const supabase = createClient();
    if (supabase && org?.id) {
      // Deletes — clear dependents first so FKs never block the delete.
      for (const id of diff.deletes) {
        await supabase.from('pp_item_suppliers').delete().eq('stock_item_id', id);
        await supabase.from('pp_movements').delete().eq('stock_item_id', id);
        await supabase.from('pp_stock_items').delete().eq('id', id);
      }
      // Updates.
      await Promise.all(
        diff.updates.map((r) =>
          supabase
            .from('pp_stock_items')
            .update({
              name: r.name.trim(),
              unit: r.unit.trim(),
              low_threshold: r.low_threshold,
              avg_unit_price: r.avg_unit_price,
            })
            .eq('id', r.id),
        ),
      );
      // Inserts — capture the real ids so the working set reconciles.
      const idMap = new Map<string, string>();
      for (const r of diff.inserts) {
        const { data } = await supabase
          .from('pp_stock_items')
          .insert({
            org_id: org.id,
            name: r.name.trim(),
            unit: r.unit.trim() || 'units',
            low_threshold: r.low_threshold,
            avg_unit_price: r.avg_unit_price,
            on_hand: 0,
            currency: 'ZAR',
            category: r.category,
          })
          .select('id')
          .single();
        if (data?.id) idMap.set(r.id, data.id as string);
      }
      // Reconcile: temp ids → real ids, drop blank drafts, reset baseline + history.
      const reconciled = working
        .filter((r) => !r.id.startsWith('new-') || r.name.trim())
        .map((r) => (idMap.has(r.id) ? { ...r, id: idMap.get(r.id)! } : r));
      setWorking(reconciled);
      setBaseline(new Map(reconciled.map((r) => [r.id, r])));
      setPast([]);
      setFuture([]);
      lastEdit.current = null;
    }
    setBusy(false);
    router.refresh();
  }

  // Filter + paginate (working is the source of truth; filter by name).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? working.filter((r) => r.name.toLowerCase().includes(q)) : working;
  }, [working, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const cell =
    'h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';
  const COLS = 'grid grid-cols-[minmax(180px,1fr)_120px_110px_120px_84px_40px] gap-2 items-center';

  return (
    <div>
      <PageHead
        title="Products"
        subtitle="Your master catalogue — feeds ProcurePulse stock, PricePilot pricing and OrderFlow invoices"
        right={
          <Link
            href="/app/orderflow/orders"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2.5 text-[14px] font-medium text-[#5F6368] transition-colors hover:border-[#1E5E54]/30"
          >
            Create order in OrderFlow
            <span aria-hidden>→</span>
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
            onClick={undo}
            disabled={past.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E7E7E2] bg-white px-3.5 text-[14px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E7E7E2] bg-white px-3.5 text-[14px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↷ Redo
          </button>
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
            disabled={busy || dirtyCount === 0}
            className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirtyCount > 0 ? `Save changes (${dirtyCount})` : 'Saved'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className={`${COLS} border-b border-[#F0F0EC] bg-[#FBFBF9] px-4 py-2.5 text-[12px] text-[#5F6368]`}>
          <span>Product name</span>
          <span>Unit</span>
          <span>Low threshold</span>
          <span>Base price (R)</span>
          <span className="text-right">On hand</span>
          <span />
        </div>
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#9A9DA1]">
            {working.length === 0 ? 'No products yet — add your first.' : 'No products match your search.'}
          </div>
        ) : (
          pageRows.map((r) => (
            <div key={r.id} className={`${COLS} border-b border-[#F0F0EC] px-4 py-2 last:border-b-0`}>
              <input
                className={cell}
                value={r.name}
                placeholder="Product name"
                onChange={(e) => editField(r.id, 'name', e.target.value)}
              />
              <input
                className={cell}
                value={r.unit}
                placeholder="kg, box, ea…"
                onChange={(e) => editField(r.id, 'unit', e.target.value)}
              />
              <input
                className={`${cell} text-right`}
                inputMode="numeric"
                value={String(r.low_threshold)}
                onChange={(e) => editField(r.id, 'low_threshold', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
              />
              <input
                className={`${cell} text-right`}
                inputMode="decimal"
                value={r.avg_unit_price == null ? '' : String(r.avg_unit_price)}
                placeholder="—"
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  editField(r.id, 'avg_unit_price', v === '' ? null : Number(v));
                }}
              />
              <span className="text-right text-[13px] text-[#9A9DA1]">{r.on_hand}</span>
              <button
                type="button"
                onClick={() => deleteRow(r.id)}
                aria-label={`Delete ${r.name || 'product'}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9A9DA1] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#5F6368]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 transition-colors hover:border-[#1E5E54]/30 disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-lg border border-[#E7E7E2] bg-white px-3 py-1.5 transition-colors hover:border-[#1E5E54]/30 disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      ) : null}

      {dirtyCount > 0 ? (
        <p className="mt-3 text-center text-[12px] text-[#854F0B]">
          {diff.inserts.length} added · {diff.updates.length} edited · {diff.deletes.length} removed — unsaved
        </p>
      ) : null}
    </div>
  );
}
