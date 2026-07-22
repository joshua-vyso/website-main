'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { MODULE_META } from '@/lib/platform/module-meta';
import { type FlowNode } from '@/lib/platform/planwise';
import { usePlanWise } from './context';

function nodeColor(tone: FlowNode['tone']) {
  return tone === 'positive' ? '#0F6E56' : tone === 'critical' ? '#A32D2D' : '#171A17';
}
function nodeValue(n: FlowNode) {
  return n.key === 'margins' ? `${n.value}%` : zar(n.value);
}

export function FinancialFlow() {
  const { financialFlow } = usePlanWise();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>('expenses');

  if (financialFlow.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#F5F9FE]">
        <span className="flex items-center gap-2">
          <span className="of-display text-[16px] font-semibold text-[#171A17]">Financial flow</span>
          <span className="text-[13px] text-[#8A8E86]">How money moves through the business</span>
        </span>
        <span className={`text-[#8A8E86] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>

      {open ? (
        <div className="border-t border-[#EEF1F5] p-5">
          <div className="flex flex-wrap items-stretch gap-2">
            {financialFlow.map((n, i) => {
              const hasChildren = !!n.children?.length;
              const isExpanded = expanded === n.key;
              const inner = (
                <div className={`flex h-full min-w-[120px] flex-col rounded-[14px] border bg-white px-3.5 py-3 transition-all ${isExpanded ? 'border-[#3E7BC4] ring-1 ring-[#3E7BC4]/15' : 'border-[#EEF1F5] hover:border-[#3E7BC4]/40'}`}>
                  <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{n.label}</span>
                  <span className="of-num mt-1.5 text-[17px] font-semibold leading-none tracking-[-0.02em]" style={{ color: nodeColor(n.tone) }}>{nodeValue(n)}</span>
                  {n.module ? <span className="mt-1 text-[10px] font-medium" style={{ color: MODULE_META[n.module].accent.fg }}>{MODULE_META[n.module].name} →</span> : hasChildren ? <span className="mt-1 text-[10px] font-medium text-[#1F5FA8]">{isExpanded ? 'Hide' : 'Expand'} →</span> : null}
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
                  {i < financialFlow.length - 1 ? <span className="flex items-center text-[18px] text-[#C7C9C5]" aria-hidden>→</span> : null}
                </div>
              );
            })}
          </div>

          {/* Expanded breakdown */}
          {expanded ? (
            (() => {
              const node = financialFlow.find((n) => n.key === expanded);
              if (!node?.children?.length) return null;
              return (
                <div className="mt-4 rounded-[14px] bg-[#FBFCFE] p-4">
                  <div className="mb-2.5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{node.label} breakdown</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {node.children.map((c) => {
                      const body = (
                        <div className="rounded-[12px] border border-[#EEF1F5] bg-white px-3 py-2.5 transition-colors hover:border-[#3E7BC4]/30">
                          <div className="truncate text-[12px] text-[#8A8E86]">{c.label}</div>
                          <div className="of-num mt-1 text-[15px] font-semibold text-[#171A17]">{zar(c.value)}</div>
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

          <p className="mt-4 text-[12px] text-[#A0A49C]">PlanWise sits above the operational modules — each node links to where the work happens.</p>
        </div>
      ) : null}
    </div>
  );
}
