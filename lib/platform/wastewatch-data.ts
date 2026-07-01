/**
 * WasteWatch data access — fetches the org's waste data from Supabase
 * (ww_waste_categories, ww_waste_events, ww_devices) and derives the analytics
 * aggregates (employee/recipe stats, preventable split) from the events.
 * Category stats (cost/pct/trend) are stored on ww_waste_categories. Org-scoped
 * by RLS; empty collections for unseeded orgs → clean empty states.
 */

import { createServerSupabase } from './supabase-server';
import type { WasteWatchData, WasteCategoryRow, WasteEvent, Device, EmployeeStat, RecipeStat } from './wastewatch';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function arr<T = unknown>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function getWasteWatchData(orgId: string): Promise<WasteWatchData> {
  const sb = await createServerSupabase();
  const [cat, ev, dev] = await Promise.all([
    sb.from('ww_waste_categories').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('ww_waste_events').select('*').eq('org_id', orgId).order('event_date', { ascending: false }),
    sb.from('ww_devices').select('*').eq('org_id', orgId).order('name'),
  ]);

  const categories: WasteCategoryRow[] = ((cat.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? '#9A9DA1',
    cost: num(r.cost),
    pct: num(r.pct),
    trend: arr<number>(r.trend).map((n) => num(n)),
  }));

  const events: WasteEvent[] = ((ev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    date: r.event_date ?? '',
    time: r.event_time ?? '',
    item: r.item ?? '',
    category: r.category ?? '',
    qty: num(r.qty),
    unit: r.unit ?? '',
    cost: num(r.cost),
    reason: r.reason ?? 'Other',
    recipe: r.recipe ?? null,
    employee: r.employee ?? '',
    device: r.device ?? '',
    location: r.location ?? '',
    preventable: !!r.preventable,
    notes: r.notes ?? undefined,
    ingredient: r.ingredient ?? undefined,
    supplier: r.supplier ?? undefined,
    batch: r.batch ?? undefined,
    expectedQty: r.expected_qty != null ? num(r.expected_qty) : undefined,
  }));

  const devices: Device[] = ((dev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    location: r.location ?? '',
    status: r.status ?? 'offline',
    battery: r.battery != null ? num(r.battery) : null,
    lastSync: r.last_sync ?? '',
    firmware: r.firmware ?? '',
    calibration: r.calibration ?? '',
    eventsToday: num(r.events_today),
    currentUser: r.current_operator ?? null,
    currentRecipe: r.current_recipe ?? null,
    measurements: arr(r.measurements),
    history: arr(r.history),
  }));

  return { categories, events, devices, ...deriveAggregates(events) };
}

/** Employee/recipe leaderboards + preventable split, computed from the events. */
function deriveAggregates(events: WasteEvent[]): { employeeStats: EmployeeStat[]; recipeStats: RecipeStat[]; preventable: { preventable: number; unavoidable: number } } {
  // Employees
  const empMap = new Map<string, { cost: number; events: number }>();
  for (const e of events) {
    if (!e.employee) continue;
    const cur = empMap.get(e.employee) ?? { cost: 0, events: 0 };
    cur.cost += e.cost;
    cur.events += 1;
    empMap.set(e.employee, cur);
  }
  const empList = [...empMap.entries()].map(([name, v]) => ({ name, ...v }));
  const teamAvg = empList.length ? empList.reduce((s, e) => s + e.cost, 0) / empList.length : 0;
  const employeeStats: EmployeeStat[] = empList
    .sort((a, b) => b.cost - a.cost)
    .map((e) => {
      const vsTeamPct = teamAvg ? Math.round(((e.cost - teamAvg) / teamAvg) * 100) : 0;
      return { name: e.name, cost: Math.round(e.cost), events: e.events, trend: vsTeamPct > 10 ? 'up' : vsTeamPct < -10 ? 'down' : 'flat', vsTeamPct };
    });

  // Recipes
  const recMap = new Map<string, { cost: number; count: number; overPct: number[] }>();
  for (const e of events) {
    if (!e.recipe) continue;
    const cur = recMap.get(e.recipe) ?? { cost: 0, count: 0, overPct: [] };
    cur.cost += e.cost;
    cur.count += 1;
    if (e.expectedQty && e.expectedQty > 0) cur.overPct.push(Math.max(0, ((e.qty - e.expectedQty) / e.expectedQty) * 100));
    recMap.set(e.recipe, cur);
  }
  const recipeStats: RecipeStat[] = [...recMap.entries()]
    .map(([recipe, v]) => ({
      recipe,
      avgCost: Math.round(v.cost / v.count),
      frequency: v.count,
      wastePct: v.overPct.length ? Math.round(v.overPct.reduce((s, n) => s + n, 0) / v.overPct.length) : 12,
    }))
    .sort((a, b) => b.avgCost - a.avgCost);

  // Preventable split
  let preventable = 0;
  let unavoidable = 0;
  for (const e of events) (e.preventable ? (preventable += e.cost) : (unavoidable += e.cost));

  return { employeeStats, recipeStats, preventable: { preventable: Math.round(preventable), unavoidable: Math.round(unavoidable) } };
}
