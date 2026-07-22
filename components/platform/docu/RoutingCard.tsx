'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getRoutes } from '@/lib/platform/docu/routing';
import { MODULE_BY_KEY } from '@/lib/platform/modules';
import type { DocumentType } from '@/lib/platform/types';

/**
 * Push-to-module routing (feature 10). Documents auto-feed into ProcurePulse on
 * extraction; this card shows that sync status and offers a manual re-sync.
 * Recommended-but-not-yet-live modules show a "Soon" tag rather than a dead
 * button. `fedItemCount` = stock movements this document has produced.
 */
export function RoutingCard({
  docType,
  documentId,
  fedItemCount,
}: {
  docType: DocumentType | null;
  documentId: string;
  fedItemCount: number;
}) {
  const router = useRouter();
  const routes = getRoutes(docType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resync() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/procurepulse/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Sync failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Route to modules</h3>
      <p className="mt-0.5 text-[12px] text-[#A0A49C]">
        Doc-U feeds extracted data into your live modules automatically.
      </p>

      {routes.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#8A8E86]">No module routing for this type yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {routes.map((route) => {
            const mod = MODULE_BY_KEY[route.key];
            const isLive = mod?.status === 'active';
            const isProcure = route.key === 'procurepulse';
            const synced = isProcure && fedItemCount > 0;

            return (
              <div
                key={route.key}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-[#EEF1F5] bg-white px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#171A17]">{route.label}</span>
                    {route.recommended ? (
                      <span className="rounded-full bg-[#EAF2FC] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#1F5FA8]">
                        Recommended
                      </span>
                    ) : null}
                    {!isLive ? (
                      <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#6B6F68]">
                        Soon
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#A0A49C]">{route.reason}</p>
                </div>

                {/* Right control */}
                {isProcure ? (
                  synced ? (
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Link
                        href={mod.screens.desktop}
                        className="text-[13px] font-semibold text-[#0F6E56] transition-opacity hover:opacity-80"
                      >
                        Synced ✓ · <span className="of-num">{fedItemCount}</span> item{fedItemCount === 1 ? '' : 's'}
                      </Link>
                      <button
                        type="button"
                        onClick={resync}
                        disabled={busy}
                        className="text-[12px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87] disabled:opacity-50"
                      >
                        {busy ? 'Syncing…' : 'Re-sync'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={resync}
                      disabled={busy}
                      className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-[#1F5FA8] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
                    >
                      {busy ? 'Syncing…' : 'Push'}
                    </button>
                  )
                ) : (
                  <span className="shrink-0 text-[12px] text-[#A0A49C]">Not yet available</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
    </div>
  );
}
