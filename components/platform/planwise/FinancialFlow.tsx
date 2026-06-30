'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { MODULE_META } from '@/lib/platform/module-meta';
import { FINANCIAL_FLOW, type FlowNode } from '@/lib/platform/planwise';

function nodeColor(tone: FlowNode['tone']) {
  return tone === 'positive' ? '#0F6E56' : tone === 'critical' ? '#A32D2D' : '#1A1C1E';
}
function nodeValue(n: FlowNode) {
  return n.key === 'margins' ? `${n.value}%` : zar(n.value);
}

export function FinancialFlow() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>('expenses');

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#FAFAF8]">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[#1A1C1E]">Financial flow</span>
          <span className="text-[12px] text-[#9A9DA1]">How money moves through the business</span>
        </span>
        <span className={`text-[#9A9DA1] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open ? (
        <div className="border-t border-[#F0F0EC] p-5">
          <div className="flex flex-wrap items-stretch gap-2">
            {FINANCIAL_FLOW.map((n, i) => {
              const hasChildren = !!n.children?.length;
              const isExpanded = expanded === n.key;
              const inner = (
                <div className={`flex h-full min-w-[120px] flex-col rounded-xl border bg-white px-3.5 py-2.5 transition-all ${isExpanded ? 'border-[#1E5E54] ring-1 ring-[#1E5E54]/15' : 'border-[#E7E7E2] hover:border-[#1E5E54]/40'}`}>
                  <span className="text-[11px] text-[#9A9DA1]">{n.label}</span>
                  <span className="mt-0.5 text-[16px] font-bold leading-none" style={{ color: nodeColor(n.tone) }}>{nodeValue(n)}</span>
                  {n.module ? <span className="mt-1 text-[10px] font-medium" style={{ color: MODULE_META[n.module].accent.fg }}>{MODULE_META[n.module].name} →</span> : hasChildren ? <span className="mt-1 text-[10px] font-medium text-[#1E5E54]">{isExpanded ? 'Hide' : 'Expand'} →</span> : null}
                </div>
              );
              return (
                <div key={n.key} className="flex items-stretch gap-2">
                  {n.module ? (
                    <Link href={MODULE_META[n.module].route} className="block">{inner}</Link>
                  ) : hasChildren ? (
                    <button type="button" onClick={() => setExpanded((e) => (e === n.key ? null : n.key))} className="block text-left">{inner}</button>
                  ) : (
                    inner
                  )}
                  {i < FINANCIAL_FLOW.length - 1 ? <span className="flex items-center text-[18px] text-[#C7C9C5]" aria-hidden>→</span> : null}
                </div>
              );
            })}
          </div>

          {/* Expanded breakdown */}
          {expanded ? (
            (() => {
              const node = FINANCIAL_FLOW.find((n) => n.key === expanded);
              if (!node?.children?.length) return null;
              return (
                <div className="mt-4 rounded-xl bg-[#FCFCFB] p-4">
                  <div className="mb-2 text-[12px] font-medium text-[#5F6368]">{node.label} breakdown</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {node.children.map((c) => {
                      const body = (
                        <div className="rounded-lg border border-[#F0F0EC] bg-white px-3 py-2.5 transition-colors hover:border-[#1E5E54]/30">
                          <div className="truncate text-[12px] text-[#5F6368]">{c.label}</div>
                          <div className="mt-0.5 text-[14px] font-semibold text-[#1A1C1E]">{zar(c.value)}</div>
                          {c.module ? <div className="mt-0.5 text-[10px] font-medium" style={{ color: MODULE_META[c.module].accent.fg }}>{MODULE_META[c.module].name} →</div> : null}
                        </div>
                      );
                      return c.module ? <Link key={c.label} href={MODULE_META[c.module].route}>{body}</Link> : <div key={c.label}>{body}</div>;
                    })}
                  </div>
                </div>
              );
            })()
          ) : null}

          <p className="mt-4 text-[12px] text-[#9A9DA1]">PlanWise sits above the operational modules — each node links to where the work happens.</p>
        </div>
      ) : null}
    </div>
  );
}
