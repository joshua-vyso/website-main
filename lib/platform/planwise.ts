/**
 * PlanWise — the strategic planning layer ("business GPS"). Types + mock data
 * for goals, budget, forecast, scenarios and cross-module recommendations.
 * Recommendations reference the module RESPONSIBLE for closing each gap, so the
 * UI is ready to later consume live data from PricePilot / OrderFlow /
 * WasteWatch / ProcurePulse / Doc-U. Real persisted targets live in `pl_targets`
 * (edited via the Goals tab); everything else here is illustrative mock data.
 */

import type { VysoModuleKey } from './module-meta';

export interface BudgetRow {
  cat: string;
  budgeted: number;
  actual: number;
  profitImpact: number;
  suggestedAction: string;
}

export const BUDGET: BudgetRow[] = [
  { cat: 'Staff', budgeted: 180000, actual: 172400, profitImpact: 7600, suggestedAction: 'On plan — hold' },
  { cat: 'Produce', budgeted: 120000, actual: 131200, profitImpact: -11200, suggestedAction: 'Review buying strategy' },
  { cat: 'Transport', budgeted: 38000, actual: 35600, profitImpact: 2400, suggestedAction: 'On plan — hold' },
  { cat: 'Utilities', budgeted: 22000, actual: 24100, profitImpact: -2100, suggestedAction: 'Check for leaks / tariffs' },
  { cat: 'Marketing', budgeted: 30000, actual: 18900, profitImpact: 6800, suggestedAction: 'Increase spend' },
  { cat: 'Other', budgeted: 20000, actual: 22700, profitImpact: -2700, suggestedAction: 'Reconcile in Doc-U' },
];

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
  /** Whether being above target is good (revenue) or bad (expense ceiling). */
  higherIsBetter: boolean;
  module?: VysoModuleKey;
}
export const GOAL_SUMMARY: GoalSummary[] = [
  { id: 'rev', label: 'Revenue target', target: 500000, current: 476000, unit: 'R', higherIsBetter: true, module: 'orderflow' },
  { id: 'profit', label: 'Profit target', target: 120000, current: 96000, unit: 'R', higherIsBetter: true, module: 'pricepilot' },
  { id: 'expense', label: 'Expense ceiling', target: 410000, current: 419000, unit: 'R', higherIsBetter: false, module: 'procurepulse' },
  { id: 'cash', label: 'Cash reserve goal', target: 300000, current: 265000, unit: 'R', higherIsBetter: true },
];

export type RecStatus = 'open' | 'in_progress' | 'done';
export interface PlanRecommendation {
  id: string;
  module: VysoModuleKey;
  action: string;
  impact: string;
  status: RecStatus;
}
export const RECOMMENDATIONS: PlanRecommendation[] = [
  { id: 'r1', module: 'procurepulse', action: 'Reduce Produce overspend', impact: '−R 11 200', status: 'open' },
  { id: 'r2', module: 'orderflow', action: 'Recover outstanding invoices', impact: '+R 18 000', status: 'in_progress' },
  { id: 'r3', module: 'orderflow', action: 'Increase average order value', impact: '+R 320 / order', status: 'open' },
  { id: 'r4', module: 'wastewatch', action: 'Reduce preventable waste', impact: '−R 2 400', status: 'open' },
  { id: 'r5', module: 'pricepilot', action: 'Review 6 low-margin products', impact: '+R 6 400', status: 'open' },
  { id: 'r6', module: 'docu', action: 'Add 3 missing expense documents', impact: 'Cleaner forecast', status: 'open' },
];

export interface ForecastLine {
  id: string;
  label: string;
  value: number;
  vsTarget: string;
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
  data: number[];
}
export const FORECASTS: ForecastLine[] = [
  { id: 'rev', label: 'Revenue forecast', value: 476000, vsTarget: '6% below target', tone: 'warning', data: [410, 430, 425, 460, 470, 476] },
  { id: 'exp', label: 'Expense forecast', value: 419000, vsTarget: 'R 9k over ceiling', tone: 'critical', data: [300, 320, 332, 340, 351, 419] },
  { id: 'profit', label: 'Profit forecast', value: 96000, vsTarget: 'R 24k below goal', tone: 'warning', data: [70, 82, 78, 90, 92, 96] },
  { id: 'cash', label: 'Cash position', value: 265000, vsTarget: '4.2 months runway', tone: 'neutral', data: [230, 240, 248, 255, 260, 265] },
];
export const FORECAST_COMMENTARY: string[] = [
  'Revenue is tracking 6% below target on the current run-rate.',
  'At this pace the month projects a profit of about R 96 000.',
  'Reducing Produce costs by 4% would lift projected profit to roughly R 108 000.',
];

export interface Scenario {
  id: string;
  title: string;
  description: string;
  assumption: string;
  projectedRevenue: number;
  projectedProfit: number;
  diffVsCurrent: number;
}
const CURRENT_PROFIT = 96000;
export const SCENARIOS: Scenario[] = [
  { id: 'A', title: 'Scenario A', description: 'Increase revenue by 5%', assumption: 'Win 2 new wholesale accounts', projectedRevenue: 525000, projectedProfit: 122000, diffVsCurrent: 122000 - CURRENT_PROFIT },
  { id: 'B', title: 'Scenario B', description: 'Reduce expenses by 8%', assumption: 'Cut produce waste + renegotiate transport', projectedRevenue: 476000, projectedProfit: 130000, diffVsCurrent: 130000 - CURRENT_PROFIT },
  { id: 'C', title: 'Scenario C', description: 'Increase pricing by 3%', assumption: 'Raise under-target margins to plan', projectedRevenue: 490000, projectedProfit: 127000, diffVsCurrent: 127000 - CURRENT_PROFIT },
];

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

/** Progress toward a goal as 0–100 (handles "lower is better" ceilings). */
export function goalProgress(g: { target: number; current: number; higherIsBetter: boolean }): number {
  if (g.target <= 0) return 0;
  const pct = g.higherIsBetter ? (g.current / g.target) * 100 : (g.target / Math.max(1, g.current)) * 100;
  return Math.max(0, Math.min(120, Math.round(pct)));
}

export type GoalTone = 'positive' | 'warning' | 'critical';
/**
 * Green only when the goal is actually met (>=100% of target / at-or-under a
 * ceiling). A shortfall or a breached ceiling reads amber/red — never green —
 * so the badge can't contradict a negative variance.
 */
export function goalTone(pct: number): GoalTone {
  if (pct >= 100) return 'positive';
  if (pct >= 85) return 'warning';
  return 'critical';
}
export function goalToneColor(t: GoalTone): string {
  return t === 'positive' ? '#0F6E56' : t === 'warning' ? '#854F0B' : '#A32D2D';
}

export const REC_STATUS_LABEL: Record<RecStatus, string> = { open: 'Open', in_progress: 'In progress', done: 'Done' };
