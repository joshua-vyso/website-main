'use client';

import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, SecondaryAction, KpiStrip, Kpi } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { usePlanWise } from './context';
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
  const pw = usePlanWise();
  const { totalBudget, totalActual, monthlyGoal, scenarioBase, forecast } = pw;
  const used = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const variance = totalActual - totalBudget;
  const profitLine = forecast.find((f) => f.id === 'profit');
  const forecastProfit = profitLine ? profitLine.value : scenarioBase.revenue - scenarioBase.expenses;

  const header = <ModuleHeader icon={M.icon} title={M.name} description="Where are we trying to get to — and what needs to happen to get there?" actions={<PrimaryAction onClick={() => show('Create budget (demo)')}>+ Create budget</PrimaryAction>} />;

  if (pw.isEmpty) {
    return (
      <div className="space-y-5">
        {node}
        {header}
        <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">No plan set up yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Set a budget, goals and a forecast to see your revenue target, budget health and the decisions that close the gap here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {node}
      {header}

      <KpiStrip>
        <Kpi label="Monthly revenue target" value={zar(monthlyGoal.targetRevenue)} />
        <Kpi label="Budget used" value={`${used}%`} accent={used > 95 ? '#A32D2D' : '#854F0B'} sub={`${zar(totalActual)} of ${zar(totalBudget)}`} />
        <Kpi label="Forecast profit" value={zar(forecastProfit)} accent={forecastProfit >= 0 ? '#0F6E56' : '#A32D2D'} />
        <Kpi label="Expense variance" value={`${variance >= 0 ? '+' : '−'}${zar(Math.abs(variance))}`} accent={variance > 0 ? '#A32D2D' : '#0F6E56'} />
        <Kpi label="Cash runway" value={`${scenarioBase.runwayMonths.toFixed(1)} mo`} />
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
  const { forecast } = usePlanWise();
  if (forecast.length === 0) {
    return (
      <div className="space-y-5">
        <PageTitle title="Forecast" subtitle="Where the business is expected to finish — and why" />
        <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">No forecast yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Once there&rsquo;s revenue, expense and cash history, PlanWise will project where the month is likely to land.</p>
        </div>
      </div>
    );
  }
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
  const { scenarioBase } = usePlanWise();
  if (scenarioBase.revenue === 0) {
    return (
      <div className="space-y-5">
        <PageTitle title="Scenarios" subtitle="Adjust the assumptions and watch the outcome recalculate live" />
        <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">Nothing to model yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Scenarios build on your revenue and expense baseline. Add a budget to start exploring what-ifs here.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageTitle title="Scenarios" subtitle="Adjust the assumptions and watch the outcome recalculate live" />
      <ScenariosWorkspace />
    </div>
  );
}
