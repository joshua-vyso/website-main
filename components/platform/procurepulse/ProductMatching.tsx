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
export function ProductMatching({
  candidates,
  aiEnabled = false,
}: {
  candidates: MatchCandidate[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((c) => [c.itemId, c.suggestedName])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
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

  async function runAiScan() {
    if (scanning) return;
    setScanning(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/suggest-matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        suggested?: number;
        capped?: boolean;
      };
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not run AI matching.');
      } else if (json.suggested) {
        setMsg(
          `Found ${json.suggested} suggestion${json.suggested === 1 ? '' : 's'}.${json.capped ? ' Scan again for more.' : ''}`,
        );
        router.refresh();
      } else {
        setMsg('No new matches found.');
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setScanning(false);
    }
  }

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
        <div className="flex shrink-0 items-center gap-2">
          {visible.length > 0 ? (
            <span className="rounded-full bg-[#FBEEDA] px-2.5 py-1 text-[12px] font-medium text-[#854F0B]">
              {visible.length} to review
            </span>
          ) : null}
          {aiEnabled ? (
            <button
              type="button"
              onClick={() => void runAiScan()}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1F5FA8] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : '✦ Find matches with AI'}
            </button>
          ) : null}
        </div>
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
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-[#1A1C1E]">{c.discoveredName}</span>
                  {c.method === 'ai' ? (
                    <span className="shrink-0 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-medium text-[#0C447C]">
                      AI · {Math.round(c.score * 100)}%
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-medium text-[#0F6E56]">
                      Exact match
                    </span>
                  )}
                </div>
                {c.method === 'ai' && c.rationale ? (
                  <p className="mt-0.5 truncate text-[11px] text-[#9A9DA1]">{c.rationale}</p>
                ) : null}
              </div>
              <div className="w-[220px] truncate text-[#5F6368]">{c.suggestedName}</div>
              <div className="w-[220px]">
                <input
                  value={custom[c.itemId] ?? ''}
                  onChange={(e) => setCustom((m) => ({ ...m, [c.itemId]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#3E7BC4]/40 focus:outline-none"
                />
              </div>
              <div className="flex w-[150px] items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => confirm(c)}
                  disabled={busy === c.itemId || !(custom[c.itemId] ?? '').trim()}
                  className="rounded-lg bg-[#1F5FA8] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
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
