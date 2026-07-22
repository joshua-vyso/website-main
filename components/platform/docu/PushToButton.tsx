'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRoutes } from '@/lib/platform/docu/routing';
import { MODULE_BY_KEY } from '@/lib/platform/modules';
import type { DocumentType, FeatureKey } from '@/lib/platform/types';

/**
 * "Push to…" action (top-right of the document detail). Expands to the modules
 * THIS org actually has (routing targets for the doc type ∩ enabled features),
 * so a module the org hasn't bought never appears. ProcurePulse pushes via the
 * feed; enabled-but-not-yet-live modules show as "Coming soon".
 */
export function PushToButton({
  documentId,
  docType,
  features,
}: {
  documentId: string;
  docType: DocumentType | null;
  features: Record<FeatureKey, boolean>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<FeatureKey | null>(null);
  const [doneKey, setDoneKey] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Routing targets for this document type that the org actually has enabled.
  const options = getRoutes(docType).filter((r) => features[r.key]);

  async function push(key: FeatureKey) {
    if (busyKey) return;
    setError(null);
    // Only ProcurePulse has a live feed endpoint today; others are "soon".
    if (key !== 'procurepulse') return;
    setBusyKey(key);
    try {
      const res = await fetch('/api/procurepulse/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Push failed (${res.status})`);
      }
      setDoneKey(key);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
        aria-expanded={open}
      >
        Push to…
        <span className="text-white/70">▾</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close push menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[260px] rounded-2xl border border-[#EAEDF2] bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
            {options.length === 0 ? (
              <p className="px-2.5 py-2 text-[12px] text-[#8A8E86]">
                No connected modules for this document type.
              </p>
            ) : (
              options.map((o) => {
                const mod = MODULE_BY_KEY[o.key];
                const live = mod?.status === 'active';
                const isBusy = busyKey === o.key;
                const isDone = doneKey === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={!live || isBusy}
                    onClick={() => push(o.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors ${
                      live ? 'text-[#171A17] hover:bg-[#F5F9FE]' : 'cursor-not-allowed text-[#8A8E86]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{o.label}</span>
                      <span className="block truncate text-[11px] text-[#A0A49C]">{o.reason}</span>
                    </span>
                    <span className="shrink-0 text-[12px]">
                      {!live ? (
                        <span className="text-[#A0A49C]">Soon</span>
                      ) : isBusy ? (
                        <span className="text-[#6B6F68]">Pushing…</span>
                      ) : isDone ? (
                        <span className="font-semibold text-[#0F6E56]">Pushed ✓</span>
                      ) : (
                        <span className="font-semibold text-[#1F5FA8]">Push</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
            {error ? <p className="px-2.5 py-1 text-[12px] text-[#A32D2D]">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
