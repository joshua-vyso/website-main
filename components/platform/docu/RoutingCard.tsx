'use client';

import { useState } from 'react';
import { getRoutes } from '@/lib/platform/docu/routing';
import type { DocumentType } from '@/lib/platform/types';

/**
 * Push-to-module routing (feature 10). Recommends which Vyso modules a document
 * should feed, by document type, with local "Pushed" feedback. Presentational —
 * pushing is visual-only until a backend lands.
 */
export function RoutingCard({ docType }: { docType: DocumentType | null }) {
  const routes = getRoutes(docType);
  const [pushed, setPushed] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white px-5 py-4">
      <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Route to modules</h3>
      <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Recommended by document type</p>

      {routes.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#9A9DA1]">No module routing for this type yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {routes.map((route) => {
            const isPushed = pushed[route.key];
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
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#9A9DA1]">{route.reason}</p>
                </div>

                {isPushed ? (
                  <span className="shrink-0 text-[13px] font-medium text-[#0F6E56]">Pushed ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPushed((p) => ({ ...p, [route.key]: true }))}
                    className={
                      route.recommended
                        ? 'shrink-0 rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90'
                        : 'shrink-0 rounded-lg border border-[#D7DAD8] px-3 py-1.5 text-[13px] font-medium text-[#5F6368] transition-colors hover:border-[#1E5E54]/40'
                    }
                  >
                    Push
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
