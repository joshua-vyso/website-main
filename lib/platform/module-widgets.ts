/**
 * Mock module summary widgets — the shape the future MOBILE COMPANION will pull
 * to build its home dashboard, snapshots and quick-action cards. Pure mock data
 * for now (no backend); each module exposes 2–4 widgets. Desktop skeleton pages
 * can also render these so the data has a real home today.
 */

import type { VysoModuleKey } from './module-meta';

export type WidgetSeverity = 'neutral' | 'positive' | 'warning' | 'critical';

export interface ModuleWidget {
  id: string;
  moduleKey: VysoModuleKey;
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  severity?: WidgetSeverity;
  actionLabel?: string;
}

export const MODULE_WIDGETS: Record<VysoModuleKey, ModuleWidget[]> = {
  docu: [
    { id: 'docu-inbox', moduleKey: 'docu', title: 'Awaiting review', value: '0', subtitle: 'Extracted + pending', severity: 'neutral', actionLabel: 'Open inbox' },
    { id: 'docu-auto', moduleKey: 'docu', title: 'Auto-processed', value: '8', subtitle: 'This week', severity: 'positive' },
    { id: 'docu-capture', moduleKey: 'docu', title: 'Capture a document', value: 'Scan', subtitle: 'Invoice · receipt · delivery note', severity: 'neutral', actionLabel: 'Upload' },
  ],
  procurepulse: [
    { id: 'pp-low', moduleKey: 'procurepulse', title: 'Items low', value: '0', severity: 'positive' },
    { id: 'pp-out', moduleKey: 'procurepulse', title: 'Out of stock', value: '2', severity: 'critical', actionLabel: 'Reorder' },
    { id: 'pp-value', moduleKey: 'procurepulse', title: 'Stock value', value: 'R 3.5M', severity: 'neutral' },
  ],
  pricepilot: [
    { id: 'pilot-below', moduleKey: 'pricepilot', title: 'Below target margin', value: '12', subtitle: 'Products', severity: 'warning', actionLabel: 'Review' },
    { id: 'pilot-opp', moduleKey: 'pricepilot', title: 'Margin opportunity', value: 'R 1 809/mo', severity: 'positive' },
    { id: 'pilot-health', moduleKey: 'pricepilot', title: 'Pricing health', value: '70', subtitle: 'Needs attention', severity: 'warning' },
  ],
  planwise: [
    { id: 'plan-used', moduleKey: 'planwise', title: 'Monthly budget used', value: '68%', subtitle: 'R 305k of R 450k', trend: '+4% vs plan', severity: 'warning' },
    { id: 'plan-revenue', moduleKey: 'planwise', title: 'Revenue target progress', value: '82%', subtitle: 'R 410k of R 500k', severity: 'positive' },
    { id: 'plan-gap', moduleKey: 'planwise', title: 'Forecast gap', value: '−R 18k', subtitle: 'Projected vs target', severity: 'warning' },
    { id: 'plan-runway', moduleKey: 'planwise', title: 'Cash runway', value: '4.2 mo', severity: 'neutral' },
  ],
  wastewatch: [
    { id: 'waste-cost', moduleKey: 'wastewatch', title: 'Waste cost this week', value: 'R 4 280', trend: '+12% vs last week', severity: 'critical' },
    { id: 'waste-top', moduleKey: 'wastewatch', title: 'Top waste category', value: 'Produce', subtitle: '41% of waste', severity: 'warning' },
    { id: 'waste-prevent', moduleKey: 'wastewatch', title: 'Preventable waste', value: 'R 1 950', subtitle: 'Avoidable this week', severity: 'warning', actionLabel: 'Log waste' },
  ],
  shiftboard: [
    { id: 'shift-working', moduleKey: 'shiftboard', title: 'Staff working now', value: '13', subtitle: 'of 15 rostered', severity: 'neutral' },
    { id: 'shift-open', moduleKey: 'shiftboard', title: 'Open shifts', value: '3', subtitle: 'This week', severity: 'warning', actionLabel: 'Fill shifts' },
    { id: 'shift-ot', moduleKey: 'shiftboard', title: 'Overtime risk', value: '2', subtitle: 'Over contracted hours', severity: 'warning', actionLabel: 'Review' },
    { id: 'shift-attendance', moduleKey: 'shiftboard', title: 'Attendance issues', value: '2', subtitle: 'Late or absent today', severity: 'critical', actionLabel: 'View' },
    { id: 'shift-dispatch', moduleKey: 'shiftboard', title: 'Dispatch short today', value: '−1', subtitle: '2 of 3 this afternoon', severity: 'warning' },
    { id: 'shift-leave', moduleKey: 'shiftboard', title: 'Leave requests', value: '3', subtitle: 'Awaiting approval', severity: 'warning', actionLabel: 'Review' },
  ],
  supplysync: [
    { id: 'supply-risk', moduleKey: 'supplysync', title: 'Supplier risks', value: '3', subtitle: 'Need attention', severity: 'critical', actionLabel: 'Review' },
    { id: 'supply-docs', moduleKey: 'supplysync', title: 'Missing documents', value: '4', subtitle: 'Across 2 suppliers', severity: 'warning' },
    { id: 'supply-pref', moduleKey: 'supplysync', title: 'Preferred suppliers', value: '6', subtitle: 'Updated recently', severity: 'positive' },
    { id: 'supply-late', moduleKey: 'supplysync', title: 'Late deliveries', value: '2', subtitle: 'This month', severity: 'warning' },
  ],
  insightgen: [
    { id: 'ig-insights', moduleKey: 'insightgen', title: 'New AI insights', value: '5', subtitle: 'Across 4 modules', severity: 'positive', actionLabel: 'View' },
    { id: 'ig-anom', moduleKey: 'insightgen', title: 'Anomalies detected', value: '2', severity: 'critical' },
    { id: 'ig-reports', moduleKey: 'insightgen', title: 'Reports updated', value: '7', subtitle: 'Last 24h', severity: 'neutral' },
    { id: 'ig-brief', moduleKey: 'insightgen', title: 'Daily Vyso brief', value: 'Ready', subtitle: 'Business snapshot', severity: 'neutral', actionLabel: 'Read' },
  ],
  orderflow: [
    { id: 'of-today', moduleKey: 'orderflow', title: "Today's orders", value: '4', severity: 'neutral' },
    { id: 'of-outstanding', moduleKey: 'orderflow', title: 'Outstanding value', value: 'R 12 450', severity: 'warning' },
    { id: 'of-overdue', moduleKey: 'orderflow', title: 'Overdue invoices', value: '1', severity: 'critical', actionLabel: 'Chase' },
  ],
};

export function widgetsFor(key: VysoModuleKey): ModuleWidget[] {
  return MODULE_WIDGETS[key] ?? [];
}

export const WIDGET_SEVERITY_STYLE: Record<WidgetSeverity, { dot: string; fg: string }> = {
  neutral: { dot: '#8A8E86', fg: '#171A17' },
  positive: { dot: '#0F6E56', fg: '#0F6E56' },
  warning: { dot: '#854F0B', fg: '#854F0B' },
  critical: { dot: '#A32D2D', fg: '#A32D2D' },
};
