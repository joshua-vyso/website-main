'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { diffSnapshots, snapshotsEqual, type PlVersion, type MarginSnapshot } from '@/lib/platform/pricepilot';

/**
 * Version history for a price list — publish a snapshot of the current margins,
 * roll back to an earlier version, or compare a version against the live state.
 * Live margins are stored in pl_price_lists + pl_overrides; versions snapshot them.
 */
export function VersionHistory({
  priceListId,
  orgId,
  live,
  versions,
  authors,
  productNames,
}: {
  priceListId: string;
  orgId: string;
  live: MarginSnapshot;
  versions: PlVersion[];
  authors: Record<string, string>;
  productNames: Record<string, string>;
}) {
  const router = useRouter();
  const { userId } = usePlatform();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const latest = versions[0] ?? null;
  const upToDate = latest ? snapshotsEqual(live, { defaultMargin: Number(latest.default_margin_pct), overrides: latest.overrides }) : false;

  function tableHint(msg: string): string {
    if (/duplicate key|unique constraint/i.test(msg)) return 'Another version was just published — please retry.';
    if (/pl_price_list_versions|pl_rollback_version|relation|column|function|does not exist/i.test(msg)) {
      return 'Run the pl-versions.sql migration first.';
    }
    return msg;
  }

  async function publish() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy('publish');
    setError(null);
    const nextNo = (versions[0]?.version_no ?? 0) + 1;
    const { error: e } = await supabase.from('pl_price_list_versions').insert({
      org_id: orgId,
      price_list_id: priceListId,
      version_no: nextNo,
      default_margin_pct: live.defaultMargin,
      overrides: live.overrides,
      note: note.trim() || null,
      created_by: userId || null,
    });
    if (e) {
      setError(tableHint(e.message));
      setBusy(null);
      return;
    }
    setNote('');
    setBusy(null);
    router.refresh();
  }

  async function rollback(v: PlVersion) {
    if (!window.confirm(`Restore version ${v.version_no}? This replaces the current margins on this price list.`)) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(v.id);
    setError(null);
    // Single transactional RPC — restores default margin + overrides atomically, so a
    // partial failure can never wipe the price list's overrides.
    const { error: e } = await supabase.rpc('pl_rollback_version', { p_list_id: priceListId, p_version_id: v.id });
    if (e) {
      setError(tableHint(e.message));
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0EC] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Version history</h2>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Publish snapshots, roll back, and compare changes</p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={
            !latest
              ? { backgroundColor: '#F0F0EC', color: '#5F6368' }
              : upToDate
                ? { backgroundColor: '#E1F5EE', color: '#0F6E56' }
                : { backgroundColor: '#FBEEDA', color: '#854F0B' }
          }
        >
          {!latest ? 'No versions yet' : upToDate ? 'Published — up to date' : 'Unpublished changes'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#F0F0EC] px-5 py-4">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. Q3 price increase)"
          className="h-9 flex-1 min-w-[200px] rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]"
        />
        <button
          type="button"
          onClick={publish}
          disabled={busy !== null || upToDate}
          className="inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          {busy === 'publish' ? 'Publishing…' : 'Publish version'}
        </button>
      </div>

      {error ? <p className="px-5 pt-3 text-[13px] text-[#A32D2D]">{error}</p> : null}

      <div className="px-5 py-2">
        {versions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#9A9DA1]">
            No versions yet. Publish the current margins to start a history you can roll back to.
          </p>
        ) : (
          versions.map((v, i) => {
            const open = compareId === v.id;
            const diff = diffSnapshots({ defaultMargin: Number(v.default_margin_pct), overrides: v.overrides }, live);
            const changeCount = (diff.defaultChanged ? 1 : 0) + diff.overrides.length;
            return (
              <div key={v.id} className={`py-3 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-semibold text-[#1A1C1E]">v{v.version_no}</span>
                    {i === 0 ? (
                      <span className="rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#0C447C]">Latest</span>
                    ) : null}
                    <span className="text-[#9A9DA1]">
                      {new Date(v.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {v.created_by && authors[v.created_by] ? ` · ${authors[v.created_by]}` : ''}
                    </span>
                    <span className="text-[#5F6368]">· {Math.round(Number(v.default_margin_pct))}% default · {v.overrides.length} overrides</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCompareId(open ? null : v.id)}
                      className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:border-[#3E7BC4]/40"
                    >
                      {open ? 'Hide' : `Compare (${changeCount})`}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => rollback(v)}
                      className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-40"
                    >
                      {busy === v.id ? '…' : 'Restore'}
                    </button>
                  </div>
                </div>
                {v.note ? <p className="mt-1 text-[12px] text-[#9A9DA1]">{v.note}</p> : null}

                {open ? (
                  <div className="mt-3 rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] p-3 text-[12px]">
                    <p className="mb-2 font-medium text-[#5F6368]">Changes from v{v.version_no} → current</p>
                    {changeCount === 0 ? (
                      <p className="text-[#9A9DA1]">Identical to the current margins.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {diff.defaultChanged ? (
                          <div className="flex justify-between">
                            <span className="text-[#5F6368]">Default margin</span>
                            <span className="tabular-nums text-[#1A1C1E]">
                              {Math.round(Number(v.default_margin_pct))}% → <span className="font-medium text-[#0F6E56]">{Math.round(live.defaultMargin)}%</span>
                            </span>
                          </div>
                        ) : null}
                        {diff.overrides.slice(0, 30).map((o) => (
                          <div key={o.stock_item_id} className="flex justify-between">
                            <span className="min-w-0 truncate text-[#5F6368]">
                              {productNames[o.stock_item_id] ?? 'Product'}{' '}
                              <span className="text-[#9A9DA1]">({o.kind})</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-[#1A1C1E]">
                              {o.from != null ? `${Math.round(o.from)}%` : '—'} →{' '}
                              <span className="font-medium text-[#0F6E56]">{o.to != null ? `${Math.round(o.to)}%` : '—'}</span>
                            </span>
                          </div>
                        ))}
                        {diff.overrides.length > 30 ? (
                          <p className="text-[#9A9DA1]">+{diff.overrides.length - 30} more…</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
