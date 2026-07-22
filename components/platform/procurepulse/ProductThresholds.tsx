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
    'h-10 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
  const COLS = 'grid grid-cols-[minmax(150px,1fr)_88px_88px_92px_120px_64px_minmax(120px,1fr)] gap-2 items-center';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-[#6B6F68]">
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
            className="h-11 w-60 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || dirty.size === 0}
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirty.size > 0 ? `Save changes (${dirty.size})` : 'Saved'}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className={`${COLS} border-b border-[#EEF1F5] bg-[#FBFCFE] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]`}>
          <span>Product</span>
          <span>Low</span>
          <span>Par</span>
          <span>Lead (d)</span>
          <span>Freshness</span>
          <span>Alerts</span>
          <span>Notes</span>
        </div>
        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-[#8A8E86]">
            {items.length === 0 ? 'No products yet.' : 'No products match your search.'}
          </div>
        ) : (
          pageRows.map((r) => (
            <div key={r.stock_item_id} className={`${COLS} border-b border-[#F4F5F7] px-4 py-2 last:border-b-0`}>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-[#171A17]">{r.name}</div>
                <div className="text-[11px] text-[#A0A49C]">{r.unit}</div>
              </div>
              <input className={`${cell} of-num text-right`} inputMode="numeric" value={r.low_threshold} onChange={(e) => edit(r.stock_item_id, 'low_threshold', e.target.value.replace(/[^0-9.]/g, ''))} />
              <input className={`${cell} of-num text-right`} inputMode="numeric" value={r.par_level} onChange={(e) => edit(r.stock_item_id, 'par_level', e.target.value.replace(/[^0-9.]/g, ''))} />
              <input className={`${cell} of-num text-right`} inputMode="numeric" value={r.lead_time_days} onChange={(e) => edit(r.stock_item_id, 'lead_time_days', e.target.value.replace(/[^0-9.]/g, ''))} />
              <div className="flex items-center gap-1">
                <input className={`${cell} of-num text-right`} inputMode="numeric" value={r.freshness_value} onChange={(e) => edit(r.stock_item_id, 'freshness_value', e.target.value.replace(/[^0-9.]/g, ''))} />
                <select
                  value={r.freshness_unit}
                  onChange={(e) => edit(r.stock_item_id, 'freshness_unit', e.target.value)}
                  className="h-10 rounded-[10px] border border-[#E4E9F0] bg-white px-1 text-[12px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
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
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px] text-[#6B6F68]">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-[10px] border border-[#E2E6EC] bg-white px-3 py-1.5 font-medium transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40">‹ Prev</button>
          <span className="of-num">Page {safePage + 1} of {pageCount}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-[10px] border border-[#E2E6EC] bg-white px-3 py-1.5 font-medium transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40">Next ›</button>
        </div>
      ) : null}

      {msg ? <p className="mt-3 text-[13px] text-[#174C87]">{msg}</p> : null}
    </div>
  );
}
