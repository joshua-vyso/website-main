'use client';

import Link from 'next/link';
import { zar } from '@/lib/platform/orderflow';
import { SectionCard, Badge, DataTable } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import {
  budgetStatus,
  goalProgress,
  goalTone,
  goalToneColor,
  type GoalSummary,
} from '@/lib/platform/planwise';
import { usePlanWise } from './context';

// ---------------------------------------------------------------------------
// Monthly business goal — headline target vs forecast + progress bar
// ---------------------------------------------------------------------------

export function MonthlyGoalCard() {
  const { monthlyGoal: g } = usePlanWise();
  const gap = g.currentForecast - g.targetRevenue;
  const pct = g.targetRevenue > 0 ? Math.round((g.currentForecast / g.targetRevenue) * 100) : 0;
  const color = goalToneColor(goalTone(pct));
  return (
    <SectionCard title="Monthly business goal" right={<Badge label={g.label} tone="info" />}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Target revenue" value={zar(g.targetRevenue)} />
        <Metric label="Current forecast" value={zar(g.currentForecast)} />
        <Metric label="Gap" value={`${gap >= 0 ? '+' : '−'}${zar(Math.abs(gap))}`} color={gap >= 0 ? '#0F6E56' : '#A32D2D'} />
        <Metric label="Goal progress" value={`${pct}%`} color={color} />
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </SectionCard>
  );
}

export function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]" style={color ? { color } : { color: '#171A17' }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal summary cards (Overview) — target / current / variance
// ---------------------------------------------------------------------------

export function fmtGoal(g: GoalSummary, n: number) {
  return g.unit === '%' ? `${Math.round(n)}%` : zar(n);
}

export function GoalSummaryCards() {
  const { goals } = usePlanWise();
  if (goals.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {goals.map((g) => {
        const variance = g.higherIsBetter ? g.current - g.target : g.target - g.current;
        const pct = goalProgress(g);
        const color = goalToneColor(goalTone(pct));
        return (
          <div key={g.id} className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{g.label}</span>
              <span className="of-num rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}1A`, color }}>{pct}%</span>
            </div>
            <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{fmtGoal(g, g.target)}</div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-[#A0A49C]">now <span className="of-num">{fmtGoal(g, g.current)}</span></span>
              <span className="of-num font-medium" style={{ color: variance >= 0 ? '#0F6E56' : '#A32D2D' }}>{variance >= 0 ? '+' : '−'}{fmtGoal(g, Math.abs(variance))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Budget table — categories + profit impact + suggested action + module action
// ---------------------------------------------------------------------------

export function BudgetTable({ filter }: { filter?: string | null }) {
  const { budget } = usePlanWise();
  const rows = filter ? budget.filter((b) => b.cat === filter) : budget;
  return (
    <DataTable
      columns={[
        { label: 'Category' },
        { label: 'Budget', align: 'right' },
        { label: 'Actual', align: 'right' },
        { label: 'Variance', align: 'right' },
        { label: 'Profit impact', align: 'right' },
        { label: 'Suggested action' },
        { label: 'Status' },
        { label: '', align: 'right' },
      ]}
      rows={rows.map((b) => {
        const v = b.budgeted - b.actual;
        const st = budgetStatus(b);
        return [
          <span key="c" className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />{b.cat}</span>,
          zar(b.budgeted),
          zar(b.actual),
          <span key="v" style={{ color: v < 0 ? '#A32D2D' : '#0F6E56' }}>{v >= 0 ? '+' : '−'}{zar(Math.abs(v))}</span>,
          <span key="p" style={{ color: b.profitImpact < 0 ? '#A32D2D' : '#0F6E56' }}>{b.profitImpact >= 0 ? '+' : '−'}{zar(Math.abs(b.profitImpact))}</span>,
          b.suggestedAction,
          <Badge key="s" label={st.label} tone={st.tone} />,
          b.module ? <Link key="a" href={MODULE_META[b.module].route} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">Review →</Link> : <span key="a" className="text-[#C7C9C5]">—</span>,
        ];
      })}
      empty="No budget set yet."
    />
  );
}

// ---------------------------------------------------------------------------
// Mobile snapshot cards (future configurable widgets)
// ---------------------------------------------------------------------------

export function MobileSnapshotCards() {
  const { monthlyGoal, totalBudget, totalActual, scenarioBase } = usePlanWise();
  const color = (s: string) => (s === 'positive' ? '#0F6E56' : s === 'warning' ? '#854F0B' : s === 'critical' ? '#A32D2D' : '#171A17');

  const revProgress = monthlyGoal.targetRevenue > 0 ? Math.round((monthlyGoal.currentForecast / monthlyGoal.targetRevenue) * 100) : 0;
  const budgetUsed = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const gap = monthlyGoal.currentForecast - monthlyGoal.targetRevenue;

  const widgets = [
    { id: 'rev', label: 'Revenue progress', value: `${revProgress}%`, severity: goalTone(revProgress) },
    { id: 'budget', label: 'Budget used', value: `${budgetUsed}%`, severity: budgetUsed > 95 ? 'critical' : budgetUsed > 85 ? 'warning' : 'neutral' },
    { id: 'gap', label: 'Forecast gap', value: `${gap >= 0 ? '+' : '−'}${zar(Math.abs(gap))}`, severity: gap >= 0 ? 'positive' : 'warning' },
    { id: 'runway', label: 'Cash runway', value: `${scenarioBase.runwayMonths.toFixed(1)} months`, severity: 'neutral' },
  ];

  return (
    <div>
      <h2 className="of-display mb-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {widgets.map((w) => (
          <div key={w.id} className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{w.label}</div>
            <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: color(w.severity) }}>{w.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
