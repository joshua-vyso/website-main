'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchCandidate } from '@/lib/platform/procurepulse/matching';

/**
 * Product matching — sits under the Products table. Surfaces likely duplicate
 * products (a messy Doc-U-fed name next to its cleaner catalogue match) so the
 * user can confirm a canonical name (merging duplicates) or dismiss the pair.
 * Confirming records a durable alias so future feeds skip the duplicate.
 */
export function ProductMatching({ candidates }: { candidates: MatchCandidate[] }) {
  const router = useRouter();
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((c) => [c.itemId, c.suggestedName])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  // After a router.refresh() the candidate list changes — seed defaults for any
  // newly-arrived rows (and drop stale keys) without clobbering in-flight edits.
  useEffect(() => {
    setCustom((prev) => {
      const next: Record<string, string> = {};
      for (const c of candidates) next[c.itemId] = prev[c.itemId] ?? c.suggestedName;
      return next;
    });
  }, [candidates]);

  const visible = candidates.filter((c) => !hidden.has(c.itemId));

  async function send(method: 'POST' | 'DELETE', c: MatchCandidate, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(c.itemId);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/product-alias', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(json?.error ?? 'Something went wrong.');
      } else {
        setHidden((h) => new Set(h).add(c.itemId));
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  }

  const confirm = (c: MatchCandidate) => {
    const name = (custom[c.itemId] ?? c.suggestedName).trim();
    if (!name) return;
    void send('POST', c, { itemId: c.itemId, targetItemId: c.targetItemId, name });
  };
  const dismiss = (c: MatchCandidate) => void send('DELETE', c, { itemId: c.itemId, rawName: c.discoveredName });

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="flex items-center justify-between border-b border-[#E7E7E2] px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#1A1C1E]">Product matching</h2>
          <p className="mt-0.5 text-[13px] text-[#5F6368]">
            Reconcile products discovered from documents with your catalogue names. Confirm to merge
            duplicates; the link is remembered for future documents.
          </p>
        </div>
        {visible.length > 0 ? (
          <span className="shrink-0 rounded-full bg-[#FBEEDA] px-2.5 py-1 text-[12px] font-medium text-[#854F0B]">
            {visible.length} to review
          </span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-[#9A9DA1]">
          No duplicate products to review — your catalogue names line up.
        </div>
      ) : (
        <>
          <div className="flex items-center px-5 py-2.5 text-[12px] font-medium text-[#9A9DA1]">
            <div className="flex-1">Discovered product</div>
            <div className="w-[220px]">Suggested product name</div>
            <div className="w-[220px]">Custom product name</div>
            <div className="w-[150px] text-right">Action</div>
          </div>

          {visible.map((c) => (
            <div
              key={c.itemId}
              className="flex items-center gap-2 border-t border-[#EFEFEC] px-5 py-3 text-[13px]"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-[#1A1C1E]">{c.discoveredName}</span>
                <span className="ml-2 text-[11px] text-[#9A9DA1]">{Math.round(c.score * 100)}% match</span>
              </div>
              <div className="w-[220px] truncate text-[#5F6368]">{c.suggestedName}</div>
              <div className="w-[220px]">
                <input
                  value={custom[c.itemId] ?? ''}
                  onChange={(e) => setCustom((m) => ({ ...m, [c.itemId]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none"
                />
              </div>
              <div className="flex w-[150px] items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => confirm(c)}
                  disabled={busy === c.itemId || !(custom[c.itemId] ?? '').trim()}
                  className="rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                >
                  {busy === c.itemId ? '…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(c)}
                  disabled={busy === c.itemId}
                  aria-label="Dismiss match"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9A9DA1] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D] disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {msg ? <p className="px-5 pb-4 text-[12px] text-[#A32D2D]">{msg}</p> : null}
    </div>
  );
}
