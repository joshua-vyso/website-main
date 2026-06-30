'use client';

import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { SectionCard, Badge } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { RECOMMENDATIONS, REC_STATUS_LABEL, PRIORITY_STYLE, type Priority, type RecStatus } from '@/lib/platform/planwise';

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_TONE: Record<RecStatus, 'warning' | 'info' | 'positive'> = { open: 'warning', in_progress: 'info', done: 'positive' };

export function DecisionsPanel() {
  const sorted = [...RECOMMENDATIONS].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.impactValue - a.impactValue);
  const totalImpact = RECOMMENDATIONS.reduce((s, r) => s + Math.max(0, r.impactValue), 0);
  return (
    <SectionCard title="Recommended decisions" right={<span className="text-[12px] text-[#9A9DA1]">up to <span className="font-semibold text-[#0F6E56]">+{zar(totalImpact)}</span> / mo</span>}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sorted.map((r) => {
          const m = MODULE_META[r.module];
          const ps = PRIORITY_STYLE[r.priority];
          return (
            <div key={r.id} className="flex items-center gap-4 rounded-xl border border-[#F0F0EC] bg-white p-4 transition-shadow hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: m.accent.bg, color: m.accent.fg }}>{m.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: ps.bg, color: ps.fg }}>{ps.label} priority</span>
                  <Badge label={REC_STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </div>
                <div className="mt-1.5 text-[14px] font-medium text-[#1A1C1E]">{r.action}</div>
                <div className="mt-0.5 text-[13px] font-semibold" style={{ color: r.impactValue > 0 ? '#0F6E56' : '#5F6368' }}>{r.impact} impact</div>
              </div>
              <Link href={m.route} className="shrink-0 rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45]">Review →</Link>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
