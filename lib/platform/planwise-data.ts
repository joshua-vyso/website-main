/**
 * PlanWise data access — fetches the org's plan from Supabase (pw_budget_lines,
 * pw_goals, pw_forecast, pw_scenarios) and derives the scenario baseline, the
 * financial-flow figures and the monthly-goal card from the budget so they stay
 * coherent with the org's numbers. Structural constants (sliders, drivers,
 * recommendations, AI scenario) stay in planwise.ts. Empty for unseeded orgs.
 */

import { createServerSupabase } from './supabase-server';
import type { PlanWiseData, BudgetRow, GoalSummary, ForecastLine, Scenario, FlowNode, ScenarioBase, MonthlyGoal, SliderValues } from './planwise';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function numArr(v: any): number[] {
  return Array.isArray(v) ? v.map((n) => num(n)) : [];
}

export async function getPlanWiseData(orgId: string): Promise<PlanWiseData> {
  const sb = await createServerSupabase();
  const [bud, goa, fc, sce] = await Promise.all([
    sb.from('pw_budget_lines').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('pw_goals').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('pw_forecast').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('pw_scenarios').select('*').eq('org_id', orgId).order('sort_order'),
  ]);

  const allBudget: BudgetRow[] = ((bud.data as any[]) ?? []).map((r) => ({
    cat: r.cat ?? '',
    budgeted: num(r.budgeted),
    actual: num(r.actual),
    profitImpact: num(r.profit_impact),
    suggestedAction: r.suggested_action ?? '',
    module: r.module ?? undefined,
    color: r.color ?? '#6B6F68',
  }));

  const goals: GoalSummary[] = ((goa.data as any[]) ?? []).map((r) => ({
    id: r.goal_key ?? r.id,
    label: r.label ?? '',
    target: num(r.target),
    current: num(r.current),
    unit: (r.unit as GoalSummary['unit']) ?? 'R',
    higherIsBetter: !!r.higher_is_better,
    module: r.module ?? undefined,
    trend: numArr(r.trend),
  }));

  const forecastRows = ((fc.data as any[]) ?? []);
  const forecast: ForecastLine[] = forecastRows.map((r) => ({
    id: r.forecast_key ?? r.id,
    label: r.label ?? '',
    value: num(r.value),
    target: num(r.target),
    rangeLow: num(r.range_low),
    rangeHigh: num(r.range_high),
    confidence: num(r.confidence),
    trend: (r.trend as ForecastLine['trend']) ?? 'flat',
    tone: (r.tone as ForecastLine['tone']) ?? 'neutral',
    data: numArr(r.data),
  }));
  const revRow = forecastRows.find((r) => (r.forecast_key ?? '') === 'rev') ?? forecastRows[0];
  // series may be an array of numbers or of { month, value, kind } points.
  const revenueSeries = Array.isArray(revRow?.series)
    ? revRow.series.map((s: any) => num(s != null && typeof s === 'object' ? s.value : s))
    : [];

  const scenarios: Scenario[] = ((sce.data as any[]) ?? []).map((r) => ({
    id: r.scenario_key ?? r.id,
    title: r.title ?? '',
    description: r.description ?? '',
    assumption: r.assumption ?? '',
    sliders: (r.sliders && typeof r.sliders === 'object' ? r.sliders : {}) as SliderValues,
    risk: (r.risk as Scenario['risk']) ?? 'Medium',
    probability: num(r.probability, 50),
  }));

  // --- derived ---
  // Revenue is a budget line but semantically distinct from spending, so it's
  // split out: `budget` (exposed to the UI's doughnut/table) holds expense
  // lines only, and the revenue figures feed the goal + financial-flow instead.
  const isRevenue = (c: string) => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales');
  const isCogs = (c: string) => c.toLowerCase().includes('cogs') || c.toLowerCase().includes('cost of goods') || c.toLowerCase().includes('produce');
  const revenueRow = allBudget.find((b) => isRevenue(b.cat));
  const revenue = revenueRow?.actual ?? 0;
  const revenueBudgeted = revenueRow?.budgeted ?? 0;

  const budget: BudgetRow[] = allBudget.filter((b) => !isRevenue(b.cat));
  const totalBudget = budget.reduce((s, b) => s + b.budgeted, 0);
  const totalActual = budget.reduce((s, b) => s + b.actual, 0);
  const cogs = budget.find((b) => isCogs(b.cat))?.actual ?? 0;
  const expenses = totalActual;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - expenses;

  // Cash reserve ≈ half a month's revenue; runway = reserve ÷ non-COGS overhead
  // (COGS scales with sales, so overhead is the burn a runway should measure).
  const cash = Math.round(revenue * 0.5);
  const overhead = Math.max(0, expenses - cogs);
  const scenarioBase: ScenarioBase = {
    revenue,
    expenses,
    cogs,
    cash,
    outstanding: Math.round(revenue * 0.06),
    runwayMonths: overhead > 0 ? Math.min(12, Math.max(0.5, Math.round((cash / overhead) * 10) / 10)) : 0,
  };

  const monthlyGoal: MonthlyGoal = {
    label: 'Monthly Revenue Goal',
    targetRevenue: revenueBudgeted || num(revRow?.target) || revenue,
    currentForecast: num(revRow?.value) || revenue,
  };

  const financialFlow: FlowNode[] = revenue
    ? [
        { key: 'revenue', label: 'Revenue', value: revenue, tone: 'neutral', module: 'orderflow' },
        { key: 'margins', label: 'Gross margin', value: revenue ? Math.round((grossProfit / revenue) * 100) : 0, tone: 'neutral', module: 'pricepilot' },
        { key: 'gross', label: 'Gross profit', value: grossProfit, tone: 'positive' },
        {
          key: 'expenses',
          label: 'Expenses',
          value: expenses,
          tone: 'critical',
          children: budget.map((b) => ({ label: b.cat, value: b.actual, module: b.module })),
        },
        { key: 'net', label: 'Net profit', value: netProfit, tone: netProfit >= 0 ? 'positive' : 'critical' },
        { key: 'cash', label: 'Cash position', value: scenarioBase.cash, tone: 'neutral' },
      ]
    : [];

  return { budget, goals, forecast, scenarios, revenueSeries, totalBudget, totalActual, scenarioBase, monthlyGoal, financialFlow };
}
