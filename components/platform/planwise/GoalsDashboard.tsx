'use client';

import Link from 'next/link';
import { Sparkline } from '@/components/platform/procurepulse/ui';
import { SectionCard, ProgressRing } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { GOAL_TIMELINE, GOAL_CHAIN, goalProgress, goalTone, goalToneColor } from '@/lib/platform/planwise';
import { usePlanWise } from './context';
import { fmtGoal } from './ui';

export function GoalsDashboard() {
  const { goals } = usePlanWise();
  if (goals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
        <p className="of-display text-[18px] font-semibold text-[#171A17]">No goals set yet</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">Set strategic targets — revenue, margin, waste — to track progress and see how they connect here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {/* Goal ring cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const pct = goalProgress(g);
          const color = goalToneColor(goalTone(pct));
          const variance = g.higherIsBetter ? g.current - g.target : g.target - g.current;
          return (
            <div key={g.id} className="flex items-center gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-shadow hover:shadow-sm">
              <ProgressRing pct={pct} color={color} size={72} thickness={7}>
                <span className="of-num text-[15px] font-semibold" style={{ color }}>{pct}%</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#171A17]">{g.label}</div>
                <div className="mt-1 text-[12px] text-[#A0A49C]"><span className="of-num">{fmtGoal(g, g.current)}</span> of <span className="of-num">{fmtGoal(g, g.target)}</span></div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="of-num text-[12px] font-semibold" style={{ color: variance >= 0 ? '#0F6E56' : '#A32D2D' }}>{variance >= 0 ? '+' : '−'}{fmtGoal(g, Math.abs(variance))}</span>
                  <Sparkline data={g.trend} color={color} width={70} height={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal timeline */}
      <SectionCard title="Goal timeline" right={<span className="of-num text-[12px] font-medium" style={{ color: GOAL_TIMELINE.forecastFinish >= 100 ? '#0F6E56' : '#854F0B' }}>{GOAL_TIMELINE.forecastFinish >= 100 ? 'On track' : `Tracking to ${GOAL_TIMELINE.forecastFinish}% — behind by ${100 - GOAL_TIMELINE.forecastFinish}%`}</span>}>
        <div className="relative pb-6 pt-8">
          <div className="h-2 w-full rounded-full bg-[#EEF1F5]">
            <div className="h-full rounded-full bg-[#1F5FA8]" style={{ width: `${GOAL_TIMELINE.monthProgress}%`, transition: 'width 0.7s ease' }} />
          </div>
          <Marker pos={0} label="Month start" />
          <Marker pos={GOAL_TIMELINE.monthProgress} label="Today" color="#3E7BC4" big />
          <Marker pos={GOAL_TIMELINE.forecastFinish} label="Forecast finish" color="#854F0B" big />
          <Marker pos={100} label="Goal" color="#0F6E56" />
        </div>
      </SectionCard>

      {/* Goal relationships */}
      <SectionCard title="How your goals connect" right={<span className="text-[12px] text-[#8A8E86]">Informational</span>}>
        <div className="flex flex-wrap items-center gap-2">
          {GOAL_CHAIN.map((c, i) => {
            const chip = (
              <span className="rounded-[12px] border border-[#EEF1F5] bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#171A17] transition-colors hover:border-[#3E7BC4]/40">
                {c.label}
                {c.module ? <span className="ml-1.5 text-[10px] font-medium" style={{ color: MODULE_META[c.module].accent.fg }}>{MODULE_META[c.module].name} →</span> : null}
              </span>
            );
            return (
              <div key={c.label} className="flex items-center gap-2">
                {c.module ? <Link href={MODULE_META[c.module].route}>{chip}</Link> : chip}
                {i < GOAL_CHAIN.length - 1 ? <span className="text-[16px] text-[#C7C9C5]" aria-hidden>→</span> : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-[#A0A49C]">Revenue drives margins, margins drive profit, profit builds cash, and cash funds growth.</p>
      </SectionCard>
    </div>
  );
}

function Marker({ pos, label, color = '#8A8E86', big }: { pos: number; label: string; color?: string; big?: boolean }) {
  return (
    <div className="absolute -translate-x-1/2" style={{ left: `${Math.max(2, Math.min(98, pos))}%`, top: 0 }}>
      <div className="mb-1 whitespace-nowrap text-center text-[11px] font-medium" style={{ color }}>{label}</div>
      <div className="mx-auto rounded-full" style={{ width: big ? 12 : 8, height: big ? 12 : 8, backgroundColor: color, marginTop: 20 - (big ? 6 : 4), boxShadow: '0 0 0 3px white' }} />
    </div>
  );
}
