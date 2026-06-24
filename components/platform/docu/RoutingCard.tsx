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
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Route to modules</h3>
      <p className="mt-0.5 text-[12px] text-[#9A9DA1]">
        Doc-U feeds extracted data into your live modules automatically.
      </p>

      {routes.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#9A9DA1]">No module routing for this type yet.</p>
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
                className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F0EC] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-[#1A1C1E]">{route.label}</span>
                    {route.recommended ? (
                      <span className="rounded-full bg-[#E3F0ED] px-2 py-0.5 text-[10px] font-medium text-[#1E5E54]">
                        Recommended
                      </span>
                    ) : null}
                    {!isLive ? (
                      <span className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[10px] font-medium text-[#5F6368]">
                        Soon
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#9A9DA1]">{route.reason}</p>
                </div>

                {/* Right control */}
                {isProcure ? (
                  synced ? (
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Link
                        href={mod.screens.desktop}
                        className="text-[13px] font-medium text-[#0F6E56] transition-opacity hover:opacity-80"
                      >
                        Synced ✓ · {fedItemCount} item{fedItemCount === 1 ? '' : 's'}
                      </Link>
                      <button
                        type="button"
                        onClick={resync}
                        disabled={busy}
                        className="text-[12px] text-[#9A9DA1] transition-colors hover:text-[#1A1C1E] disabled:opacity-50"
                      >
                        {busy ? 'Syncing…' : 'Re-sync'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={resync}
                      disabled={busy}
                      className="shrink-0 rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? 'Syncing…' : 'Push'}
                    </button>
                  )
                ) : (
                  <span className="shrink-0 text-[12px] text-[#C9CCC8]">Not yet available</span>
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
