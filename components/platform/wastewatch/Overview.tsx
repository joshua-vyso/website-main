'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, SectionCard, CountUp } from '@/components/platform/module-ui';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { COST_TIMELINE, TIME_PERIODS, INSIGHTS, type TimePeriod } from '@/lib/platform/wastewatch';
import { LogWasteModal, MobileWidgets } from './shared';
import { useWasteWatch } from './categories';

const M = MODULE_META.wastewatch;

export function WasteOverview() {
  const router = useRouter();
  const { node, show } = useToast();
  const ww = useWasteWatch();
  const [logOpen, setLogOpen] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('week');

  const categories = ww.categories;
  // Categories with recorded waste, biggest first — the "top waste sources".
  const visible = useMemo(() => [...categories].filter((c) => c.cost > 0).sort((a, b) => b.cost - a.cost), [categories]);
  const totalCost = categories.reduce((s, c) => s + c.cost, 0);
  const top = visible[0] ?? null;
  const pctOf = (cost: number) => (totalCost ? Math.round((cost / totalCost) * 100) : 0);

  return (
    <div className="space-y-5">
      {node}
      <ModuleHeader icon={M.icon} title={M.name} description="What's being wasted, why, by whom — and how to lose less of it." actions={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>} />

      <KpiStrip>
        <Kpi label="Waste cost" value={zar(totalCost)} accent="#A32D2D" sub="this week" />
        <Kpi label="Preventable" value={zar(ww.preventable.preventable)} accent="#854F0B" sub="avoidable" />
        <Kpi label="Waste %" value="3.4%" sub="of food cost" />
        <Kpi label="Top category" value={top ? top.name : '—'} sub={top ? `${pctOf(top.cost)}% of waste` : 'no categories'} />
        <Kpi label="Waste events" value={String(ww.events.length)} sub="logged" />
      </KpiStrip>

      {/* Cost timeline */}
      <SectionCard
        title="Waste cost timeline"
        right={
          <div className="inline-flex rounded-[11px] border border-[#EEF1F5] bg-[#F7F8FA] p-1">
            {TIME_PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${period === p.key ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#6B6F68]'}`}>{p.label}</button>
            ))}
          </div>
        }
      >
        <AreaChart data={COST_TIMELINE[period]} color="#A32D2D" fill="#FCEBEB" height={120} />
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">Cost of waste over the selected period — ▲ 12% vs the previous one.</p>
      </SectionCard>

      {/* Top waste sources */}
      <div>
        <h2 className="of-display mb-2.5 text-[16px] font-semibold text-[#171A17]">Top waste sources</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visible.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => router.push(`/app/wastelog/log?category=${encodeURIComponent(cat.name)}`)}
              className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#C9DEF7] hover:shadow-[0_6px_18px_-10px_rgba(20,24,20,0.28)]"
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[12px] font-medium text-[#171A17]">{cat.name}</span>
              </div>
              <CountUp value={cat.cost} format={(n) => zar(n)} className="of-num mt-2.5 block text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]" />
              <div className="of-num mt-1.5 text-[12px] text-[#A0A49C]">{pctOf(cat.cost)}% of waste</div>
            </button>
          ))}
        </div>
      </div>

      {/* AI recommendations */}
      <SectionCard title="AI recommendations" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5FA8]">✦ auto-generated soon</span>}>
        <div className="flex flex-col gap-2.5">
          {INSIGHTS.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2.5 text-[14px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
              <span className="min-w-0 flex-1 text-[#171A17]">{i.text}</span>
              {i.module ? (
                <Link href={MODULE_META[i.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[i.module].accent.bg, color: MODULE_META[i.module].accent.fg }}>{MODULE_META[i.module].name} →</Link>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <MobileWidgets onAction={() => setLogOpen(true)} />

      <LogWasteModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => show('Waste logged')} />
    </div>
  );
}
