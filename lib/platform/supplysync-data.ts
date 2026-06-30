/**
 * SupplySync data access — fetches the org's supplier intelligence from Supabase
 * (ss_suppliers + ss_supplier_documents) and maps the snake_case rows to the
 * camelCase shapes the view renders. Org-scoped by RLS; an org with no rows
 * returns empty arrays so unseeded accounts render clean empty states.
 *
 * This is the Phase-2 wiring template: getXData(orgId) on the server, called by
 * the page, passed to the client view as props.
 */

import { createServerSupabase } from './supabase-server';

export type SupplierStatus = 'preferred' | 'active' | 'review';
export type SupplierRisk = 'low' | 'medium' | 'high';
export type PriceTrend = 'stable' | 'rising' | 'volatile';
export type DocStatus = 'valid' | 'expiring' | 'missing';

export interface SupplierNote {
  body: string;
  date: string;
  author?: string;
}
export interface SupplierDoc {
  docType: string;
  label: string;
  status: DocStatus;
  expiry: string | null;
}
export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: SupplierStatus;
  risk: SupplierRisk;
  rating: number;
  reliability: number;
  quality: number;
  deliveryPct: number;
  onTimePct: number;
  priceTrend: PriceTrend;
  leadTimeDays: number;
  lastIssue: string | null;
  lastOrder: string | null;
  spendMtd: number;
  notes: SupplierNote[];
  docs: SupplierDoc[];
}
export interface SupplySyncData {
  suppliers: Supplier[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function getSupplySyncData(orgId: string): Promise<SupplySyncData> {
  const sb = await createServerSupabase();
  const [sup, doc] = await Promise.all([
    sb.from('ss_suppliers').select('*').eq('org_id', orgId).order('name'),
    sb.from('ss_supplier_documents').select('*').eq('org_id', orgId),
  ]);

  const docsBySupplier = new Map<string, SupplierDoc[]>();
  for (const d of (doc.data as any[]) ?? []) {
    const arr = docsBySupplier.get(d.supplier_id) ?? [];
    arr.push({ docType: d.doc_type, label: d.label ?? d.doc_type, status: (d.status as DocStatus) ?? 'valid', expiry: d.expiry ?? null });
    docsBySupplier.set(d.supplier_id, arr);
  }

  const suppliers: Supplier[] = ((sup.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? '',
    contactName: r.contact_name ?? null,
    contactPhone: r.contact_phone ?? null,
    contactEmail: r.contact_email ?? null,
    status: (r.status as SupplierStatus) ?? 'active',
    risk: (r.risk as SupplierRisk) ?? 'low',
    rating: num(r.rating, 3),
    reliability: num(r.reliability, 80),
    quality: num(r.quality, 80),
    deliveryPct: num(r.delivery_pct, 85),
    onTimePct: num(r.on_time_pct, 90),
    priceTrend: (r.price_trend as PriceTrend) ?? 'stable',
    leadTimeDays: num(r.lead_time_days, 2),
    lastIssue: r.last_issue ?? null,
    lastOrder: r.last_order ?? null,
    spendMtd: num(r.spend_mtd),
    notes: Array.isArray(r.notes) ? (r.notes as SupplierNote[]) : [],
    docs: docsBySupplier.get(r.id) ?? [],
  }));

  return { suppliers };
}
