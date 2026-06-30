'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, SectionCard, CountUp } from '@/components/platform/module-ui';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { CATEGORY_STATS, COST_TIMELINE, TIME_PERIODS, INSIGHTS, WASTE_EVENTS, type TimePeriod } from '@/lib/platform/wastewatch';
import { LogWasteDrawer, MobileWidgets } from './shared';

const M = MODULE_META.wastewatch;

export function WasteOverview() {
  const router = useRouter();
  const { node, show } = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('week');

  const totalCost = CATEGORY_STATS.reduce((s, c) => s + c.cost, 0);
  const top = CATEGORY_STATS[0];

  return (
    <div className="space-y-5">
      {node}
      <ModuleHeader icon={M.icon} title={M.name} description="What's being wasted, why, by whom — and how to lose less of it." actions={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>} />

      <KpiStrip>
        <Kpi label="Waste cost" value={zar(totalCost)} accent="#A32D2D" sub="this week" />
        <Kpi label="Preventable" value={zar(4760)} accent="#854F0B" sub="46% of waste" />
        <Kpi label="Waste %" value="3.4%" sub="of food cost" />
        <Kpi label="Top category" value={top.key} sub={`${top.pct}% of waste`} />
        <Kpi label="Waste events" value={String(WASTE_EVENTS.length)} sub="logged" />
      </KpiStrip>

      {/* Cost timeline */}
      <SectionCard
        title="Waste cost timeline"
        right={
          <div className="inline-flex rounded-lg bg-[#F2F2EF] p-0.5">
            {TIME_PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors ${period === p.key ? 'bg-white text-[#1A1C1E] shadow-sm' : 'text-[#9A9DA1] hover:text-[#5F6368]'}`}>{p.label}</button>
            ))}
          </div>
        }
      >
        <AreaChart data={COST_TIMELINE[period]} color="#A32D2D" fill="#FCEBEB" height={120} />
        <p className="mt-2 text-[12px] text-[#9A9DA1]">Cost of waste over the selected period — ▲ 12% vs the previous one.</p>
      </SectionCard>

      {/* Top waste sources */}
      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-[#1A1C1E]">Top waste sources</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_STATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => router.push(`/app/wastelog/log?category=${encodeURIComponent(c.key)}`)}
              className="rounded-2xl border border-[#E7E7E2] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[12px] font-medium text-[#1A1C1E]">{c.key}</span>
              </div>
              <CountUp value={c.cost} format={(n) => zar(n)} className="mt-2 block text-[18px] font-bold leading-none text-[#1A1C1E]" />
              <div className="mt-1 text-[12px] text-[#9A9DA1]">{c.pct}% of waste</div>
            </button>
          ))}
        </div>
      </div>

      {/* AI recommendations */}
      <SectionCard title="AI recommendations" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E5E54]">✦ auto-generated soon</span>}>
        <div className="flex flex-col gap-2.5">
          {INSIGHTS.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2.5 text-[14px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" />
              <span className="min-w-0 flex-1 text-[#1A1C1E]">{i.text}</span>
              {i.module ? (
                <Link href={MODULE_META[i.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[i.module].accent.bg, color: MODULE_META[i.module].accent.fg }}>{MODULE_META[i.module].name} →</Link>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <MobileWidgets onAction={() => setLogOpen(true)} />

      <LogWasteDrawer open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => show('Waste logged (demo)')} />
    </div>
  );
}
