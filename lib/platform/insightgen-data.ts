/**
 * InsightGen data access — the cross-module AI insight/report brain. Fetches the
 * org's ig_insights + ig_reports from Supabase and maps to UI-agnostic shapes.
 * Org-scoped by RLS; empty arrays for unseeded orgs → clean empty state.
 */

import { createServerSupabase } from './supabase-server';

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'positive';
export type ReportStatus = 'draft' | 'ready' | 'scheduled';

export interface GenInsight {
  id: string;
  sourceModule: string;
  severity: InsightSeverity;
  text: string;
  metricLabel: string | null;
  metricValue: string | null;
  isAnomaly: boolean;
}
export interface GenReport {
  id: string;
  name: string;
  scope: string | null;
  modules: string[];
  schedule: string;
  status: ReportStatus;
  owner: string | null;
  lastRun: string | null;
}
export interface InsightGenData {
  insights: GenInsight[];
  reports: GenReport[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getInsightGenData(orgId: string): Promise<InsightGenData> {
  const sb = await createServerSupabase();
  const [ins, rep] = await Promise.all([
    sb.from('ig_insights').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('ig_reports').select('*').eq('org_id', orgId).order('last_run', { ascending: false }),
  ]);

  const insights: GenInsight[] = ((ins.data as any[]) ?? []).map((r) => ({
    id: r.id,
    sourceModule: r.source_module ?? '',
    severity: (r.severity as InsightSeverity) ?? 'info',
    text: r.text ?? '',
    metricLabel: r.metric_label ?? null,
    metricValue: r.metric_value ?? null,
    isAnomaly: !!r.is_anomaly,
  }));

  const reports: GenReport[] = ((rep.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? '',
    scope: r.scope ?? null,
    modules: Array.isArray(r.modules) ? (r.modules as string[]) : [],
    schedule: r.schedule ?? 'weekly',
    status: (r.status as ReportStatus) ?? 'ready',
    owner: r.owner ?? null,
    lastRun: r.last_run ?? null,
  }));

  return { insights, reports };
}
