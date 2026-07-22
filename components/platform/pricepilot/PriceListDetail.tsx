'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { CADENCE_LABEL, sellPrice, zar2, type PlPriceList } from '@/lib/platform/pricepilot';

interface ProductLite {
  id: string;
  name: string;
  unit: string | null;
  avg_unit_price: number | null;
}

const PAGE = 40;

export function PriceListDetail({
  list,
  customerName,
  products,
  overrides: initialOverrides,
}: {
  list: PlPriceList;
  customerName: string;
  products: ProductLite[];
  overrides: Record<string, number>;
}) {
  const router = useRouter();
  const [defaultMargin, setDefaultMargin] = useState(String(list.default_margin_pct));
  const [overrides, setOverrides] = useState<Record<string, number>>(initialOverrides);
  // What's persisted — updated on save (router.refresh doesn't reset client state).
  const [baseDefault, setBaseDefault] = useState(Number(list.default_margin_pct) || 0);
  const [baseOverrides, setBaseOverrides] = useState<Record<string, number>>(initialOverrides);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const def = Number(defaultMargin) || 0;
  const effective = (id: string) => (id in overrides ? overrides[id] : def);

  // Only overrides that actually differ from the current default get persisted.
  const canonical = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, m] of Object.entries(overrides)) if (m !== def) out[id] = m;
    return out;
  }, [overrides, def]);

  const sameMap = (a: Record<string, number>, b: Record<string, number>) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => b[k] === a[k]);
  };
  const dirty = def !== baseDefault || !sameMap(canonical, baseOverrides);

  function setMargin(id: string, v: string) {
    const n = v === '' ? def : Number(v.replace(/[^0-9.]/g, ''));
    setOverrides((prev) => ({ ...prev, [id]: Number.isFinite(n) ? n : def }));
  }
  function resetRow(id: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function save() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const errors: unknown[] = [];

    const { error: e1 } = await supabase.from('pl_price_lists').update({ default_margin_pct: def }).eq('id', list.id);
    if (e1) errors.push(e1);

    // Persist exactly the canonical set: upsert the overrides, delete any that
    // were persisted before but no longer differ from default.
    const toUpsert = Object.entries(canonical).map(([stock_item_id, margin_pct]) => ({
      org_id: list.org_id,
      price_list_id: list.id,
      stock_item_id,
      margin_pct,
    }));
    const toDelete = Object.keys(baseOverrides).filter((id) => !(id in canonical));
    if (toUpsert.length) {
      const { error } = await supabase.from('pl_overrides').upsert(toUpsert, { onConflict: 'price_list_id,stock_item_id' });
      if (error) errors.push(error);
    }
    if (toDelete.length) {
      const { error } = await supabase.from('pl_overrides').delete().eq('price_list_id', list.id).in('stock_item_id', toDelete);
      if (error) errors.push(error);
    }

    setBusy(false);
    if (errors.length) {
      setMsg('Could not save — please try again.');
      return;
    }
    // Reconcile local state to what's now persisted (client state isn't remounted).
    setBaseDefault(def);
    setBaseOverrides(canonical);
    setOverrides(canonical);
    setMsg('Saved.');
    router.refresh();
  }

  function exportCsv() {
    const header = ['Product', 'Unit', 'Base price', 'Margin %', 'Sell price'];
    const lines = [header.join(',')];
    for (const p of products) {
      const m = effective(p.id);
      const sell = sellPrice(p.avg_unit_price, m);
      lines.push([`"${p.name.replace(/"/g, '""')}"`, p.unit ?? '', p.avg_unit_price ?? 0, m, sell.toFixed(2)].join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricelist-${list.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  const COLS = 'grid grid-cols-[minmax(180px,1fr)_110px_96px_120px_40px] gap-2 items-center';
  const cell = 'of-num h-9 rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[13px] text-[#171A17] outline-none focus:border-[#3E7BC4]';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/pricepilot/price-lists" className="inline-flex h-9 items-center gap-1 rounded-full border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">
            <span aria-hidden>‹</span> Price lists
          </Link>
          <div>
            <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">{list.name}</h1>
            <p className="mt-1 text-[14px] text-[#8A8E86]">
              {customerName} · {CADENCE_LABEL[list.cadence]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">
            Export CSV
          </button>
          <button type="button" onClick={() => setMsg('Price list queued to send (email delivery is a later step).')} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">
            Send
          </button>
          <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
            {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Default margin</span>
          <input className={`${cell} w-20 text-right`} inputMode="decimal" value={defaultMargin} onChange={(e) => setDefaultMargin(e.target.value.replace(/[^0-9.]/g, ''))} />
          <span className="text-[13px] text-[#6B6F68]">%</span>
        </div>
        <div className="flex-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search products…"
          className="h-11 w-64 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className={`${COLS} border-b border-[#EEF1F5] bg-[#FBFCFE] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]`}>
          <span>Product</span>
          <span className="text-right">Base price</span>
          <span className="text-right">Margin %</span>
          <span className="text-right">Sell price</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#8A8E86]">
            {products.length === 0 ? 'No products in your catalogue yet.' : 'No products match your search.'}
          </div>
        ) : (
          rows.map((p) => {
            const m = effective(p.id);
            const overridden = p.id in overrides && overrides[p.id] !== def;
            return (
              <div key={p.id} className={`${COLS} border-b border-[#F4F5F7] px-4 py-2 transition-colors last:border-b-0 hover:bg-[#F5F9FE]`}>
                <span className="truncate text-[14px] font-semibold text-[#171A17]">{p.name}</span>
                <span className="of-num text-right text-[14px] text-[#6B6F68]">{zar2(p.avg_unit_price)}</span>
                <input className={`${cell} text-right`} inputMode="decimal" value={String(m)} onChange={(e) => setMargin(p.id, e.target.value)} />
                <span className="of-num text-right text-[14px] font-semibold text-[#171A17]">{zar2(sellPrice(p.avg_unit_price, m))}</span>
                {overridden ? (
                  <button type="button" onClick={() => resetRow(p.id)} title="Reset to default margin" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]">
                    ↺
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#6B6F68]">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40">‹ Prev</button>
          <span className="of-num">Page {safePage + 1} of {pageCount}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40">Next ›</button>
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-center text-[12px] text-[#174C87]">{msg}</p> : null}
    </div>
  );
}
