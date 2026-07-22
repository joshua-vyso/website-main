'use client';

import Link from 'next/link';
import { SectionCard } from '@/components/platform/module-ui';
import { AreaChart, Sparkline } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { zar } from '@/lib/platform/orderflow';
import { LABOUR_COST_TREND, OVERTIME_TREND, ATTENDANCE_TREND, LABOUR_INSIGHTS, DAYS, departmentSnapshots } from '@/lib/platform/shiftboard';
import { useShiftBoard } from './context';

export function LabourInsights() {
  const sb = useShiftBoard();
  const totalOvertime = OVERTIME_TREND.reduce((s, n) => s + n, 0);
  const coverage = departmentSnapshots(sb.employees, sb.departments);

  const header = (
    <div>
      <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Insights</h1>
      <p className="mt-1.5 text-[14px] text-[#8A8E86]">Labour cost, overtime, coverage and cross-module signals</p>
    </div>
  );

  if (sb.isEmpty) {
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">No insights yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#6B6F68]">Labour-cost, overtime and coverage trends appear here once your people data builds up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Labour cost trend" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{zar(LABOUR_COST_TREND[LABOUR_COST_TREND.length - 1])}</span>/day</span>}>
          <AreaChart data={LABOUR_COST_TREND} color="#3E7BC4" fill="#EAF2FC" height={120} />
          <p className="mt-2.5 text-[12px] text-[#A0A49C]">Daily labour cost this week — tracking ~7% above plan.</p>
        </SectionCard>

        <SectionCard title="Overtime trend" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{totalOvertime}h</span> this week</span>}>
          <AreaChart data={OVERTIME_TREND} color="#5B53C0" fill="#EAE7FB" height={120} />
          <p className="mt-2.5 text-[12px] text-[#A0A49C]">Overtime hours per day — concentrated later in the week.</p>
        </SectionCard>
      </div>

      <SectionCard title="Department coverage" right={<span className="text-[12px] text-[#A0A49C]">staffed vs required right now</span>}>
        <div className="flex flex-col gap-3">
          {coverage.map((d) => {
            const pct = d.required ? Math.min(100, (d.working / d.required) * 100) : 100;
            const short = d.working < d.required;
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex w-32 shrink-0 items-center gap-2 text-[13px] text-[#171A17]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />{d.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: short ? '#A32D2D' : '#0F6E56', transition: 'width 0.6s ease' }} />
                </div>
                <span className="of-num w-20 text-right text-[12px] text-[#6B6F68]">{d.working} / {d.required}</span>
                <span className="w-20 text-right text-[12px]" style={{ color: short ? '#A32D2D' : '#A0A49C' }}>{short ? `short ${d.required - d.working}` : 'covered'}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Attendance trends" right={<span className="text-[12px] text-[#A0A49C]">last 7 days</span>}>
          <div className="space-y-3">
            <TrendRow label="Late arrivals" data={ATTENDANCE_TREND.lateArrivals} color="#854F0B" />
            <TrendRow label="Absences" data={ATTENDANCE_TREND.absences} color="#A32D2D" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.06em] text-[#A0A49C]">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
        </SectionCard>

        <SectionCard title="Cross-module insights" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5FA8]">✦ auto-generated soon</span>}>
          <div className="flex flex-col gap-2.5">
            {LABOUR_INSIGHTS.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2.5 text-[13px]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
                <span className="min-w-0 flex-1 text-[#171A17]">{i.text}</span>
                {i.module ? (
                  <Link href={MODULE_META[i.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[i.module].accent.bg, color: MODULE_META[i.module].accent.fg }}>{MODULE_META[i.module].name} →</Link>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function TrendRow({ label, data, color }: { label: string; data: number[]; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[13px] text-[#6B6F68]">{label}</span>
      <Sparkline data={data} color={color} width={180} height={28} />
      <span className="of-num ml-auto text-[13px] font-semibold text-[#171A17]">{data.reduce((s, n) => s + n, 0)}</span>
    </div>
  );
}
