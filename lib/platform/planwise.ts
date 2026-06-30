/**
 * PlanWise — the strategic planning layer ("business GPS"). Types + mock data
 * for goals, budget, forecast, scenarios, financial flow and cross-module
 * decisions. Recommendations reference the module RESPONSIBLE for closing each
 * gap, so the UI is ready to later consume live data from PricePilot / OrderFlow
 * / WasteWatch / ProcurePulse / Doc-U. Real persisted targets live in
 * `pl_targets` (edited via the Goals tab); everything else here is illustrative.
 */

import type { VysoModuleKey } from './module-meta';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface BudgetRow {
  cat: string;
  budgeted: number;
  actual: number;
  profitImpact: number;
  suggestedAction: string;
  /** Module that can act on this category (for "Review →"). */
  module?: VysoModuleKey;
  color: string;
}

export const BUDGET: BudgetRow[] = [
  { cat: 'Staff', budgeted: 180000, actual: 172400, profitImpact: 7600, suggestedAction: 'On plan — hold', color: '#1E5E54' },
  { cat: 'Produce', budgeted: 120000, actual: 131200, profitImpact: -11200, suggestedAction: 'Review ProcurePulse buying strategy', module: 'procurepulse', color: '#D9730D' },
  { cat: 'Transport', budgeted: 38000, actual: 35600, profitImpact: 2400, suggestedAction: 'On plan — hold', color: '#0C447C' },
  { cat: 'Utilities', budgeted: 22000, actual: 24100, profitImpact: -2100, suggestedAction: 'Check tariffs & usage', color: '#854F0B' },
  { cat: 'Marketing', budgeted: 30000, actual: 18900, profitImpact: 6800, suggestedAction: 'Increase spend', color: '#5B53C0' },
  { cat: 'Other', budgeted: 20000, actual: 22700, profitImpact: -2700, suggestedAction: 'Reconcile in Doc-U', module: 'docu', color: '#9A9DA1' },
];

export const TOTAL_BUDGET = BUDGET.reduce((s, b) => s + b.budgeted, 0);

export function budgetStatus(b: { budgeted: number; actual: number }): { label: string; tone: 'positive' | 'warning' | 'critical' | 'neutral' } {
  if (b.actual > b.budgeted * 1.02) return { label: 'Over budget', tone: 'critical' };
  if (b.actual < b.budgeted * 0.9) return { label: 'Under budget', tone: 'neutral' };
  return { label: 'On track', tone: 'positive' };
}

// ---------------------------------------------------------------------------
// Monthly goal + goal summaries
// ---------------------------------------------------------------------------

export interface MonthlyGoal {
  label: string;
  targetRevenue: number;
  currentForecast: number;
}
export const MONTHLY_GOAL: MonthlyGoal = { label: 'Monthly Revenue Goal', targetRevenue: 500000, currentForecast: 476000 };

export interface GoalSummary {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: 'R' | '%';
  higherIsBetter: boolean;
  module?: VysoModuleKey;
  /** Recent trend for a sparkline. */
  trend: number[];
}
export const GOAL_SUMMARY: GoalSummary[] = [
  { id: 'rev', label: 'Revenue goal', target: 500000, current: 476000, unit: 'R', higherIsBetter: true, module: 'orderflow', trend: [410, 432, 448, 460, 470, 476] },
  { id: 'profit', label: 'Profit goal', target: 120000, current: 96000, unit: 'R', higherIsBetter: true, module: 'pricepilot', trend: [70, 78, 84, 90, 93, 96] },
  { id: 'expense', label: 'Expense ceiling', target: 410000, current: 419000, unit: 'R', higherIsBetter: false, module: 'procurepulse', trend: [392, 400, 408, 414, 417, 419] },
  { id: 'cash', label: 'Cash reserve', target: 300000, current: 265000, unit: 'R', higherIsBetter: true, trend: [230, 242, 250, 257, 261, 265] },
  { id: 'growth', label: 'Growth target', target: 8, current: 5, unit: '%', higherIsBetter: true, trend: [2, 3, 3, 4, 5, 5] },
  { id: 'outstanding', label: 'Outstanding invoices', target: 10000, current: 18000, unit: 'R', higherIsBetter: false, module: 'orderflow', trend: [9, 12, 14, 16, 17, 18] },
];

/** Position markers (0–100) for the goal timeline: where we are vs forecast-finish vs the month. */
export const GOAL_TIMELINE = { monthProgress: 70, forecastFinish: 95, goal: 100 };

/** Informational relationship chain (Revenue → Margins → Profit → Cash → Growth). */
export const GOAL_CHAIN: { label: string; module?: VysoModuleKey }[] = [
  { label: 'Revenue', module: 'orderflow' },
  { label: 'Margins', module: 'pricepilot' },
  { label: 'Profit' },
  { label: 'Cash' },
  { label: 'Growth' },
];

// ---------------------------------------------------------------------------
// Decisions (cross-module recommendations as actionable tasks)
// ---------------------------------------------------------------------------

export type RecStatus = 'open' | 'in_progress' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export interface PlanRecommendation {
  id: string;
  module: VysoModuleKey;
  action: string;
  impact: string;
  /** Signed rand impact for sorting/summary. */
  impactValue: number;
  priority: Priority;
  status: RecStatus;
}
export const RECOMMENDATIONS: PlanRecommendation[] = [
  { id: 'r1', module: 'procurepulse', action: 'Reduce Produce overspend', impact: '+R 11 200', impactValue: 11200, priority: 'high', status: 'open' },
  { id: 'r2', module: 'orderflow', action: 'Recover outstanding invoices', impact: '+R 18 000', impactValue: 18000, priority: 'high', status: 'in_progress' },
  { id: 'r3', module: 'orderflow', action: 'Increase average order value', impact: '+R 320 / order', impactValue: 6400, priority: 'medium', status: 'open' },
  { id: 'r4', module: 'wastewatch', action: 'Reduce preventable waste', impact: '+R 2 400', impactValue: 2400, priority: 'medium', status: 'open' },
  { id: 'r5', module: 'pricepilot', action: 'Review 6 low-margin products', impact: '+R 6 400', impactValue: 6400, priority: 'high', status: 'open' },
  { id: 'r6', module: 'docu', action: 'Add 3 missing expense documents', impact: 'Cleaner forecast', impactValue: 0, priority: 'low', status: 'open' },
];
export const REC_STATUS_LABEL: Record<RecStatus, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' };
export const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; label: string }> = {
  high: { bg: '#FCEBEB', fg: '#A32D2D', label: 'High' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium' },
  low: { bg: '#F0F0EC', fg: '#5F6368', label: 'Low' },
};

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export interface ForecastLine {
  id: string;
  label: string;
  value: number;
  target: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  trend: 'up' | 'down' | 'flat';
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
  data: number[];
}
export const FORECASTS: ForecastLine[] = [
  { id: 'rev', label: 'Revenue forecast', value: 476000, target: 500000, rangeLow: 470000, rangeHigh: 488000, confidence: 82, trend: 'up', tone: 'warning', data: [410, 430, 425, 460, 470, 476] },
  { id: 'exp', label: 'Expense forecast', value: 419000, target: 410000, rangeLow: 412000, rangeHigh: 428000, confidence: 88, trend: 'up', tone: 'critical', data: [300, 320, 332, 340, 351, 419] },
  { id: 'profit', label: 'Profit forecast', value: 96000, target: 120000, rangeLow: 88000, rangeHigh: 108000, confidence: 74, trend: 'up', tone: 'warning', data: [70, 82, 78, 90, 92, 96] },
  { id: 'cash', label: 'Cash position', value: 265000, target: 300000, rangeLow: 258000, rangeHigh: 274000, confidence: 80, trend: 'up', tone: 'neutral', data: [230, 240, 248, 255, 260, 265] },
];

export interface ForecastDriver {
  label: string;
  pct: number;
  module?: VysoModuleKey;
  color: string;
}
export const FORECAST_DRIVERS: ForecastDriver[] = [
  { label: 'Orders', pct: 68, module: 'orderflow', color: '#1E5E54' },
  { label: 'Margins', pct: 16, module: 'pricepilot', color: '#2E7D67' },
  { label: 'Expenses', pct: 10, module: 'procurepulse', color: '#854F0B' },
  { label: 'Waste', pct: 6, module: 'wastewatch', color: '#A32D2D' },
];
export const FORECAST_COMMENTARY: string[] = [
  'Revenue is trending below target primarily due to a lower average order value this month.',
  'Current waste costs account for roughly R 4 200 of lost projected profit.',
  'Recovering outstanding invoices would extend cash runway by approximately 0.4 months.',
];

// ---------------------------------------------------------------------------
// Scenarios (interactive builder)
// ---------------------------------------------------------------------------

/** Current baseline the scenario sliders adjust from. */
export const SCENARIO_BASE = { revenue: 476000, expenses: 419000, cogs: 280000, cash: 265000, outstanding: 18000, runwayMonths: 4.2 };

export interface ScenarioSlider {
  id: 'revenueGrowth' | 'expenseReduction' | 'marginImprovement' | 'wasteReduction' | 'invoiceRecovery';
  label: string;
  max: number;
  unit: string;
  module?: VysoModuleKey;
}
export const SCENARIO_SLIDERS: ScenarioSlider[] = [
  { id: 'revenueGrowth', label: 'Revenue growth', max: 15, unit: '%', module: 'orderflow' },
  { id: 'expenseReduction', label: 'Expense reduction', max: 15, unit: '%', module: 'procurepulse' },
  { id: 'marginImprovement', label: 'Margin improvement', max: 10, unit: '%', module: 'pricepilot' },
  { id: 'wasteReduction', label: 'Waste reduction', max: 50, unit: '%', module: 'wastewatch' },
  { id: 'invoiceRecovery', label: 'Invoice recovery', max: 100, unit: '%', module: 'orderflow' },
];
export type SliderValues = Record<ScenarioSlider['id'], number>;

export interface ScenarioResult {
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
  runwayMonths: number;
  diffVsCurrent: number;
}
const CURRENT_PROFIT = SCENARIO_BASE.revenue - SCENARIO_BASE.expenses;

/** Pure mock projection from slider settings. */
export function projectScenario(v: SliderValues): ScenarioResult {
  const revenue = SCENARIO_BASE.revenue * (1 + v.revenueGrowth / 100);
  const expenses = SCENARIO_BASE.expenses * (1 - v.expenseReduction / 100);
  const marginGain = revenue * (v.marginImprovement / 100);
  const wasteSaved = 4200 * (v.wasteReduction / 100);
  const recovered = SCENARIO_BASE.outstanding * (v.invoiceRecovery / 100);
  const profit = revenue - expenses + marginGain + wasteSaved;
  const cash = SCENARIO_BASE.cash + recovered + Math.max(0, profit - CURRENT_PROFIT) * 0.5;
  const runwayMonths = SCENARIO_BASE.runwayMonths + recovered / 45000 + (profit - CURRENT_PROFIT) / 60000;
  return { revenue, expenses, profit, cash, runwayMonths: Math.max(0, runwayMonths), diffVsCurrent: profit - CURRENT_PROFIT };
}

export type RiskLevel = 'Low' | 'Medium' | 'High';
export interface Scenario {
  id: string;
  title: string;
  description: string;
  assumption: string;
  sliders: SliderValues;
  risk: RiskLevel;
  probability: number;
}
const Z: SliderValues = { revenueGrowth: 0, expenseReduction: 0, marginImprovement: 0, wasteReduction: 0, invoiceRecovery: 0 };
export const SCENARIOS: Scenario[] = [
  { id: 'A', title: 'Scenario A', description: 'Increase revenue by 5%', assumption: 'Win 2 new wholesale accounts', sliders: { ...Z, revenueGrowth: 5 }, risk: 'Medium', probability: 60 },
  { id: 'B', title: 'Scenario B', description: 'Reduce expenses by 8%', assumption: 'Cut produce waste + renegotiate transport', sliders: { ...Z, expenseReduction: 8, wasteReduction: 30 }, risk: 'Low', probability: 75 },
  { id: 'C', title: 'Scenario C', description: 'Increase pricing by 3%', assumption: 'Raise under-target margins to plan', sliders: { ...Z, marginImprovement: 3 }, risk: 'Medium', probability: 65 },
];
export const RISK_STYLE: Record<RiskLevel, { bg: string; fg: string }> = {
  Low: { bg: '#E1F5EE', fg: '#0F6E56' },
  Medium: { bg: '#FBEEDA', fg: '#854F0B' },
  High: { bg: '#FCEBEB', fg: '#A32D2D' },
};

/** The "Generate best scenario" AI recommendation (mock). */
export const AI_SCENARIO = {
  steps: ['Increase average order value by 4%', 'Reduce Produce spend by 3%', 'Raise margins on 8 products'],
  additionalProfit: 32000,
  sliders: { ...Z, revenueGrowth: 4, expenseReduction: 3, marginImprovement: 2 } as SliderValues,
};

// ---------------------------------------------------------------------------
// Financial flow
// ---------------------------------------------------------------------------

export interface FlowNode {
  key: string;
  label: string;
  value: number;
  tone: 'neutral' | 'positive' | 'critical';
  module?: VysoModuleKey;
  /** Sub-breakdown shown when the node is expanded. */
  children?: { label: string; value: number; module?: VysoModuleKey }[];
}
export const FINANCIAL_FLOW: FlowNode[] = [
  { key: 'revenue', label: 'Revenue', value: 476000, tone: 'neutral', module: 'orderflow' },
  { key: 'margins', label: 'Margins', value: 41, tone: 'neutral', module: 'pricepilot' },
  { key: 'gross', label: 'Gross profit', value: 196000, tone: 'positive' },
  {
    key: 'expenses',
    label: 'Expenses',
    value: 419000,
    tone: 'critical',
    children: [
      { label: 'Produce', value: 131200, module: 'procurepulse' },
      { label: 'Staff', value: 172400 },
      { label: 'Transport', value: 35600 },
      { label: 'Marketing', value: 18900 },
      { label: 'Utilities', value: 24100 },
      { label: 'Waste', value: 4200, module: 'wastewatch' },
    ],
  },
  { key: 'net', label: 'Net profit', value: 96000, tone: 'positive' },
  { key: 'cash', label: 'Cash position', value: 265000, tone: 'neutral' },
];

// ---------------------------------------------------------------------------
// Mobile snapshot
// ---------------------------------------------------------------------------

export type SnapshotSeverity = 'positive' | 'warning' | 'critical' | 'neutral';
export interface MobileSnapshot {
  id: string;
  label: string;
  value: string;
  severity: SnapshotSeverity;
}
export const MOBILE_SNAPSHOT: MobileSnapshot[] = [
  { id: 'rev', label: 'Revenue progress', value: '82%', severity: 'positive' },
  { id: 'budget', label: 'Budget used', value: '68%', severity: 'warning' },
  { id: 'gap', label: 'Forecast gap', value: '−R 18k', severity: 'warning' },
  { id: 'runway', label: 'Cash runway', value: '4.2 months', severity: 'neutral' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Progress toward a goal as 0–120 (handles "lower is better" ceilings). */
export function goalProgress(g: { target: number; current: number; higherIsBetter: boolean }): number {
  if (g.target <= 0) return 0;
  const pct = g.higherIsBetter ? (g.current / g.target) * 100 : (g.target / Math.max(1, g.current)) * 100;
  return Math.max(0, Math.min(120, Math.round(pct)));
}

export type GoalTone = 'positive' | 'warning' | 'critical';
/** Green only when the goal is actually met (>=100%); a shortfall reads amber/red. */
export function goalTone(pct: number): GoalTone {
  if (pct >= 100) return 'positive';
  if (pct >= 85) return 'warning';
  return 'critical';
}
export function goalToneColor(t: GoalTone): string {
  return t === 'positive' ? '#0F6E56' : t === 'warning' ? '#854F0B' : '#A32D2D';
}
