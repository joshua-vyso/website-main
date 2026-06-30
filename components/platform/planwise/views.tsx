'use client';

import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, SecondaryAction, KpiStrip, Kpi } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { BUDGET } from '@/lib/platform/planwise';
import { MonthlyGoalCard, GoalSummaryCards, MobileSnapshotCards } from './ui';
import { DecisionsPanel } from './DecisionsPanel';
import { FinancialFlow } from './FinancialFlow';
import { BudgetWorkspace } from './BudgetWorkspace';
import { ForecastCardsRich, ForecastDrivers, ForecastInsight } from './Forecast';
import { ScenariosWorkspace } from './Scenarios';

const M = MODULE_META.planwise;

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-[14px] text-[#5F6368]">{subtitle}</p> : null}
    </div>
  );
}

export function OverviewView() {
  const { node, show } = useToast();
  const totalBudget = BUDGET.reduce((s, b) => s + b.budgeted, 0);
  const totalActual = BUDGET.reduce((s, b) => s + b.actual, 0);
  const used = Math.round((totalActual / totalBudget) * 100);
  const variance = totalActual - totalBudget;

  return (
    <div className="space-y-5">
      {node}
      <ModuleHeader icon={M.icon} title={M.name} description="Where are we trying to get to — and what needs to happen to get there?" actions={<PrimaryAction onClick={() => show('Create budget (demo)')}>+ Create budget</PrimaryAction>} />

      <KpiStrip>
        <Kpi label="Monthly revenue target" value={zar(500000)} />
        <Kpi label="Budget used" value={`${used}%`} accent={used > 95 ? '#A32D2D' : '#854F0B'} sub={`${zar(totalActual)} of ${zar(totalBudget)}`} />
        <Kpi label="Forecast profit" value={zar(96000)} accent="#0F6E56" />
        <Kpi label="Expense variance" value={`${variance >= 0 ? '+' : '−'}${zar(Math.abs(variance))}`} accent={variance > 0 ? '#A32D2D' : '#0F6E56'} />
        <Kpi label="Cash runway" value="4.2 mo" />
      </KpiStrip>

      <MonthlyGoalCard />
      <GoalSummaryCards />
      <DecisionsPanel />
      <FinancialFlow />
      <MobileSnapshotCards />
    </div>
  );
}

export function BudgetView() {
  const { node, show } = useToast();
  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle title="Budget" subtitle="Explore where your budget goes — hover and click to dig in" />
        <SecondaryAction onClick={() => show('Adjust budget (demo)')}>Adjust budget</SecondaryAction>
      </div>
      <BudgetWorkspace />
    </div>
  );
}

export function ForecastView() {
  return (
    <div className="space-y-5">
      <PageTitle title="Forecast" subtitle="Where the business is expected to finish — and why" />
      <ForecastCardsRich />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ForecastDrivers />
        <ForecastInsight />
      </div>
    </div>
  );
}

export function ScenariosView() {
  return (
    <div className="space-y-5">
      <PageTitle title="Scenarios" subtitle="Adjust the assumptions and watch the outcome recalculate live" />
      <ScenariosWorkspace />
    </div>
  );
}
