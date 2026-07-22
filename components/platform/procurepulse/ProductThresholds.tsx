'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toggle } from './ui';
import type { StockItem, StockThreshold } from '@/lib/platform/types';

interface Row {
  stock_item_id: string;
  name: string;
  unit: string;
  low_threshold: string;
  par_level: string;
  lead_time_days: string;
  freshness_value: string;
  freshness_unit: string;
  alerts_enabled: boolean;
  notes: string;
}

const PAGE = 50;
const numStr = (n: number | null | undefined) => (n == null ? '' : String(n));

export function ProductThresholds({
  items,
  thresholds,
}: {
  items: StockItem[];
  thresholds: StockThreshold[];
}) {
  const router = useRouter();
  const byItem = useMemo(
    () => new Map(thresholds.map((t) => [t.stock_item_id, t])),
    [thresholds],
  );

  const initial = useMemo<Row[]>(
    () =>
      items.map((it) => {
        const t = byItem.get(it.id);
        return {
          stock_item_id: it.id,
          name: it.name,
          unit: it.unit,
          // Fall back to the catalogue low_threshold until a threshold row exists.
          low_threshold: numStr(t?.low_threshold ?? it.low_threshold),
          par_level: numStr(t?.par_level),
          lead_time_days: numStr(t?.lead_time_days),
          freshness_value: numStr(t?.freshness_value),
          freshness_unit: t?.freshness_unit ?? 'days',
          alerts_enabled: t?.alerts_enabled ?? true,
          notes: t?.notes ?? '',
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

  function edit(id: string, key: keyof Row, value: string | boolean) {
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

  async function save() {
    if (busy || dirty.size === 0) return;
    setBusy(true);
    setMsg(null);
    const payload = rows
      .filter((r) => dirty.has(r.stock_item_id))
      .map((r) => ({
        stock_item_id: r.stock_item_id,
        low_threshold: r.low_threshold,
        par_level: r.par_level,
        lead_time_days: r.lead_time_days,
        freshness_value: r.freshness_value,
        freshness_unit: r.freshness_unit,
        alerts_enabled: r.alerts_enabled,
        notes: r.notes,
      }));
    try {
      const res = await fetch('/api/procurepulse/thresholds', {
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
  const COLS = 'grid grid-cols-[minmax(150px,1fr)_88px_88px_92px_120px_64px_minmax(120px,1fr)] gap-2 items-center';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-[#5F6368]">
          Low stock, target (par), reorder lead time and freshness thresholds. These feed Alerts and
          Intelligence. Freshness is per product — e.g. lettuce 2 days, broccoli 3 days.
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
          <span>Low</span>
          <span>Par</span>
          <span>Lead (d)</span>
          <span>Freshness</span>
          <span>Alerts</span>
          <span>Notes</span>
        </div>
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#9A9DA1]">
            {items.length === 0 ? 'No products yet.' : 'No products match your search.'}
          </div>
        ) : (
          pageRows.map((r) => (
            <div key={r.stock_item_id} className={`${COLS} border-b border-[#F0F0EC] px-4 py-2 last:border-b-0`}>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{r.name}</div>
                <div className="text-[11px] text-[#9A9DA1]">{r.unit}</div>
              </div>
              <input className={`${cell} text-right`} inputMode="numeric" value={r.low_threshold} onChange={(e) => edit(r.stock_item_id, 'low_threshold', e.target.value.replace(/[^0-9.]/g, ''))} />
              <input className={`${cell} text-right`} inputMode="numeric" value={r.par_level} onChange={(e) => edit(r.stock_item_id, 'par_level', e.target.value.replace(/[^0-9.]/g, ''))} />
              <input className={`${cell} text-right`} inputMode="numeric" value={r.lead_time_days} onChange={(e) => edit(r.stock_item_id, 'lead_time_days', e.target.value.replace(/[^0-9.]/g, ''))} />
              <div className="flex items-center gap-1">
                <input className={`${cell} text-right`} inputMode="numeric" value={r.freshness_value} onChange={(e) => edit(r.stock_item_id, 'freshness_value', e.target.value.replace(/[^0-9.]/g, ''))} />
                <select
                  value={r.freshness_unit}
                  onChange={(e) => edit(r.stock_item_id, 'freshness_unit', e.target.value)}
                  className="h-9 rounded-lg border border-[#E7E7E2] bg-white px-1 text-[12px] text-[#1A1C1E] focus:outline-none"
                >
                  <option value="days">d</option>
                  <option value="hours">h</option>
                </select>
              </div>
              <button type="button" onClick={() => edit(r.stock_item_id, 'alerts_enabled', !r.alerts_enabled)} aria-label="Toggle alerts">
                <Toggle on={r.alerts_enabled} />
              </button>
              <input className={cell} value={r.notes} placeholder="—" onChange={(e) => edit(r.stock_item_id, 'notes', e.target.value)} />
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
