/**
 * SupplySync data access — supplier INTELLIGENCE for the org (not inventory).
 * Fetches the supply base and its contacts, documents, pricing history, risk
 * register and relationship timeline from Supabase, maps snake_case → camelCase,
 * and derives the overall scorecard and buying opportunities so the views stay
 * coherent with the org's real numbers. Org-scoped by RLS; an unseeded org
 * returns empty arrays so it renders clean empty states.
 *
 * Boundary: SupplySync surfaces supplier pricing intelligence and recommends
 * suppliers, but actual procurement/purchasing lives in ProcurePulse.
 */

import { createServerSupabase } from './supabase-server';

export type SupplierStatus = 'preferred' | 'active' | 'review';
export type SupplierRisk = 'low' | 'medium' | 'high';
export type PriceTrend = 'stable' | 'rising' | 'volatile';
export type MarketPosition = 'below' | 'at' | 'above';
export type SupplierDocumentStatus = 'valid' | 'expiring' | 'expired' | 'missing';
export type PreferredMethod = 'Call' | 'WhatsApp' | 'Email';
export type SupplierRiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SupplierRiskStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

// ---------------------------------------------------------------------------
// Leaf shapes
// ---------------------------------------------------------------------------

export interface SupplierScorecard {
  overall: number;
  reliability: number;
  quality: number;
  deliveryConsistency: number;
  priceStability: number;
  responsiveness: number;
  compliance: number;
}

export interface SupplierContact {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  preferredMethod: PreferredMethod;
  isPrimary: boolean;
}

export interface SupplierDocument {
  id: string;
  docType: string;
  label: string;
  status: SupplierDocumentStatus;
  expiry: string | null;
  daysRemaining: number | null;
}

export interface SupplierPerformanceMetric {
  lateDeliveries: number;
  qualityIssues: number;
  complaints: number;
  responseHours: number;
  reliabilityTrend: number[];
  deliveryTrend: number[];
  scoreTrend: number[];
}

export interface SupplierPricingRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  item: string;
  category: string;
  unit: string;
  currentPrice: number;
  previousPrice: number;
  marketAvg: number;
  /** current vs previous, %. */
  changePct: number;
  /** current vs market average, % (negative = cheaper than market). */
  diffVsMarketPct: number;
  position: MarketPosition;
  lastUpdated: string | null;
  trend: number[];
}

export interface SupplierRiskItem {
  id: string;
  supplierId: string | null;
  supplierName: string;
  riskType: string;
  severity: SupplierRiskSeverity;
  description: string;
  suggestedAction: string | null;
  owner: string | null;
  status: SupplierRiskStatus;
  dueDate: string | null;
}

export interface SupplierNote {
  body: string;
  date: string;
  author?: string;
}

export interface SupplierHistoryEvent {
  id: string;
  supplierId: string | null;
  supplierName: string;
  eventType: string;
  channel: string | null;
  summary: string;
  contactName: string | null;
  followUp: string | null;
  followUpDate: string | null;
  followUpDone: boolean;
  owner: string | null;
  date: string;
}

export type OpportunityKind = 'buy_now' | 'review' | 'watch' | 'negotiate';
export interface SupplierOpportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  supplierId: string | null;
  supplierName: string;
  category: string;
  body: string;
  suggestedAction: string;
}

// ---------------------------------------------------------------------------
// Supplier (aggregate)
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  name: string;
  category: string;
  categories: string[];
  status: SupplierStatus;
  risk: SupplierRisk;
  rating: number;
  // primary contact quick-fields (denormalised on the row)
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  // scorecard
  scorecard: SupplierScorecard;
  reliability: number;
  quality: number;
  deliveryPct: number;
  onTimePct: number;
  priceTrend: PriceTrend;
  marketPosition: MarketPosition;
  leadTimeDays: number;
  lastIssue: string | null;
  lastOrder: string | null;
  spendMtd: number;
  avgMonthlySpend: number;
  updatedAt: string | null;
  performance: SupplierPerformanceMetric;
  notes: SupplierNote[];
  contacts: SupplierContact[];
  docs: SupplierDocument[];
  pricing: SupplierPricingRecord[];
  risks: SupplierRiskItem[];
  history: SupplierHistoryEvent[];
  // derived counts
  docsToAction: number;
  openRisks: number;
}

/** Comparison row for the compare drawer (2–3 suppliers side by side). */
export interface SupplierComparison {
  supplierId: string;
  name: string;
  overall: number;
  reliability: number;
  quality: number;
  delivery: number;
  priceStability: number;
  compliance: number;
  pricePosition: MarketPosition;
  lastIssue: string | null;
  recommendation: string;
}

export interface SupplySyncData {
  suppliers: Supplier[];
  risks: SupplierRiskItem[];
  history: SupplierHistoryEvent[];
  pricing: SupplierPricingRecord[];
  opportunities: SupplierOpportunity[];
}

export const EMPTY_SUPPLYSYNC: SupplySyncData = { suppliers: [], risks: [], history: [], pricing: [], opportunities: [] };

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function numArr(v: any): number[] {
  return Array.isArray(v) ? v.map((n) => num(n)) : [];
}
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  if (!Number.isFinite(then)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((then - today) / 86_400_000);
}
function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round(((a - b) / b) * 1000) / 10;
}
function positionOf(current: number, market: number): MarketPosition {
  const d = pct(current, market);
  if (d <= -3) return 'below';
  if (d >= 3) return 'above';
  return 'at';
}
/** Supplier-level market position = the average of its pricing rows vs market. */
function aggregatePosition(records: SupplierPricingRecord[]): MarketPosition | null {
  if (!records.length) return null;
  const avg = records.reduce((s, p) => s + p.diffVsMarketPct, 0) / records.length;
  if (avg <= -3) return 'below';
  if (avg >= 3) return 'above';
  return 'at';
}

/** Weighted overall score when a supplier row hasn't stored one. */
function deriveOverall(s: { reliability: number; quality: number; deliveryConsistency: number; priceStability: number; responsiveness: number; compliance: number }): number {
  const v = s.reliability * 0.24 + s.quality * 0.18 + s.deliveryConsistency * 0.2 + s.priceStability * 0.14 + s.responsiveness * 0.1 + s.compliance * 0.14;
  return Math.round(v);
}

export async function getSupplySyncData(orgId: string): Promise<SupplySyncData> {
  const sb = await createServerSupabase();
  const [sup, con, doc, pri, rsk, his] = await Promise.all([
    sb.from('ss_suppliers').select('*').eq('org_id', orgId).order('name'),
    sb.from('ss_supplier_contacts').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('ss_supplier_documents').select('*').eq('org_id', orgId),
    sb.from('ss_supplier_pricing').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('ss_supplier_risks').select('*').eq('org_id', orgId),
    sb.from('ss_supplier_history').select('*').eq('org_id', orgId).order('event_date', { ascending: false }),
  ]);

  const nameById = new Map<string, string>();
  for (const r of (sup.data as any[]) ?? []) nameById.set(r.id, r.name);

  const contactsBy = new Map<string, SupplierContact[]>();
  for (const c of (con.data as any[]) ?? []) {
    const arr = contactsBy.get(c.supplier_id) ?? [];
    arr.push({
      id: c.id,
      name: c.name ?? '',
      role: c.role ?? 'Sales',
      email: c.email ?? null,
      phone: c.phone ?? null,
      preferredMethod: (c.preferred_method as PreferredMethod) ?? 'Call',
      isPrimary: !!c.is_primary,
    });
    contactsBy.set(c.supplier_id, arr);
  }

  const docsBy = new Map<string, SupplierDocument[]>();
  for (const d of (doc.data as any[]) ?? []) {
    const arr = docsBy.get(d.supplier_id) ?? [];
    arr.push({
      id: d.id,
      docType: d.doc_type,
      label: d.label ?? d.doc_type,
      status: (d.status as SupplierDocumentStatus) ?? 'valid',
      expiry: d.expiry ?? null,
      daysRemaining: daysUntil(d.expiry ?? null),
    });
    docsBy.set(d.supplier_id, arr);
  }

  const pricingBy = new Map<string, SupplierPricingRecord[]>();
  const allPricing: SupplierPricingRecord[] = [];
  for (const p of (pri.data as any[]) ?? []) {
    const rec: SupplierPricingRecord = {
      id: p.id,
      supplierId: p.supplier_id,
      supplierName: nameById.get(p.supplier_id) ?? '',
      item: p.item ?? '',
      category: p.category ?? '',
      unit: p.unit ?? 'kg',
      currentPrice: num(p.current_price),
      previousPrice: num(p.previous_price),
      marketAvg: num(p.market_avg),
      changePct: pct(num(p.current_price), num(p.previous_price)),
      diffVsMarketPct: pct(num(p.current_price), num(p.market_avg)),
      position: positionOf(num(p.current_price), num(p.market_avg)),
      lastUpdated: p.last_updated ?? null,
      trend: numArr(p.trend),
    };
    const arr = pricingBy.get(p.supplier_id) ?? [];
    arr.push(rec);
    pricingBy.set(p.supplier_id, arr);
    allPricing.push(rec);
  }

  const risksBy = new Map<string, SupplierRiskItem[]>();
  const allRisks: SupplierRiskItem[] = [];
  for (const r of (rsk.data as any[]) ?? []) {
    const item: SupplierRiskItem = {
      id: r.id,
      supplierId: r.supplier_id ?? null,
      supplierName: r.supplier_id ? nameById.get(r.supplier_id) ?? '' : '',
      riskType: r.risk_type ?? '',
      severity: (r.severity as SupplierRiskSeverity) ?? 'medium',
      description: r.description ?? '',
      suggestedAction: r.suggested_action ?? null,
      owner: r.owner ?? null,
      status: (r.status as SupplierRiskStatus) ?? 'open',
      dueDate: r.due_date ?? null,
    };
    if (item.supplierId) {
      const arr = risksBy.get(item.supplierId) ?? [];
      arr.push(item);
      risksBy.set(item.supplierId, arr);
    }
    allRisks.push(item);
  }

  const historyBy = new Map<string, SupplierHistoryEvent[]>();
  const allHistory: SupplierHistoryEvent[] = [];
  for (const h of (his.data as any[]) ?? []) {
    const ev: SupplierHistoryEvent = {
      id: h.id,
      supplierId: h.supplier_id ?? null,
      supplierName: h.supplier_id ? nameById.get(h.supplier_id) ?? '' : '',
      eventType: h.event_type ?? '',
      channel: h.channel ?? null,
      summary: h.summary ?? '',
      contactName: h.contact_name ?? null,
      followUp: h.follow_up ?? null,
      followUpDate: h.follow_up_date ?? null,
      followUpDone: !!h.follow_up_done,
      owner: h.owner ?? null,
      date: h.event_date ?? '',
    };
    if (ev.supplierId) {
      const arr = historyBy.get(ev.supplierId) ?? [];
      arr.push(ev);
      historyBy.set(ev.supplierId, arr);
    }
    allHistory.push(ev);
  }

  const suppliers: Supplier[] = ((sup.data as any[]) ?? []).map((r) => {
    const reliability = num(r.reliability, 80);
    const quality = num(r.quality, 80);
    const deliveryConsistency = num(r.delivery_consistency, num(r.delivery_pct, 85));
    const priceStability = num(r.price_stability, 80);
    const responsiveness = num(r.responsiveness, 85);
    const compliance = num(r.compliance_score, 90);
    const overall = r.overall_score != null ? num(r.overall_score) : deriveOverall({ reliability, quality, deliveryConsistency, priceStability, responsiveness, compliance });
    const docs = docsBy.get(r.id) ?? [];
    const risks = risksBy.get(r.id) ?? [];
    const supPricing = pricingBy.get(r.id) ?? [];
    // Prefer the position implied by this supplier's real pricing rows; fall
    // back to the stored column only when it has no pricing history yet.
    const marketPosition: MarketPosition = aggregatePosition(supPricing) ?? (r.market_position as MarketPosition) ?? 'at';
    return {
      id: r.id,
      name: r.name,
      category: r.category ?? '',
      categories: Array.isArray(r.categories) && r.categories.length ? (r.categories as string[]) : (r.category ? [r.category] : []),
      status: (r.status as SupplierStatus) ?? 'active',
      risk: (r.risk as SupplierRisk) ?? 'low',
      rating: num(r.rating, 3),
      contactName: r.contact_name ?? null,
      contactPhone: r.contact_phone ?? null,
      contactEmail: r.contact_email ?? null,
      scorecard: { overall, reliability, quality, deliveryConsistency, priceStability, responsiveness, compliance },
      reliability,
      quality,
      deliveryPct: num(r.delivery_pct, 85),
      onTimePct: num(r.on_time_pct, 90),
      priceTrend: (r.price_trend as PriceTrend) ?? 'stable',
      marketPosition,
      leadTimeDays: num(r.lead_time_days, 2),
      lastIssue: r.last_issue ?? null,
      lastOrder: r.last_order ?? null,
      spendMtd: num(r.spend_mtd),
      avgMonthlySpend: num(r.avg_monthly_spend) || num(r.spend_mtd),
      updatedAt: r.updated_at ?? null,
      performance: {
        lateDeliveries: num(r.late_deliveries),
        qualityIssues: num(r.quality_issues),
        complaints: num(r.complaints),
        responseHours: num(r.response_hours, 6),
        reliabilityTrend: numArr(r.reliability_trend),
        deliveryTrend: numArr(r.delivery_trend),
        scoreTrend: numArr(r.score_trend),
      },
      notes: Array.isArray(r.notes) ? (r.notes as SupplierNote[]) : [],
      contacts: contactsBy.get(r.id) ?? [],
      docs,
      pricing: supPricing,
      risks,
      history: historyBy.get(r.id) ?? [],
      docsToAction: docs.filter((d) => d.status !== 'valid').length,
      openRisks: risks.filter((rk) => rk.status === 'open' || rk.status === 'in_progress').length,
    };
  });

  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const opportunities = deriveOpportunities(allPricing, byId);

  return { suppliers, risks: allRisks, history: allHistory, pricing: allPricing, opportunities };
}

/**
 * Deterministic "AI-style" buying opportunities derived from real pricing +
 * scorecards. Cheaper-than-market from a strong supplier → buy now; sharply
 * above market → review/negotiate; steady → watch.
 */
function deriveOpportunities(pricing: SupplierPricingRecord[], byId: Map<string, Supplier>): SupplierOpportunity[] {
  const out: SupplierOpportunity[] = [];
  for (const p of pricing) {
    const s = p.supplierId ? byId.get(p.supplierId) : undefined;
    const score = s?.scorecard.overall ?? 0;
    const belowBy = -p.diffVsMarketPct; // positive when cheaper than market
    if (belowBy >= 4 && score >= 80) {
      out.push({
        id: `opp-buy-${p.id}`,
        kind: 'buy_now',
        title: `${p.category} opportunity`,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        category: p.category,
        body: `${p.supplierName} is ${Math.round(belowBy)}% below market average on ${p.item.toLowerCase()} while holding a ${score} supplier score.`,
        suggestedAction: `Prioritise ${p.supplierName} for ${p.category.toLowerCase()} orders this week.`,
      });
    } else if (p.diffVsMarketPct >= 8) {
      out.push({
        id: `opp-review-${p.id}`,
        kind: score < 75 ? 'review' : 'negotiate',
        title: `${p.category} price watch`,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        category: p.category,
        body: `${p.supplierName} ${p.item.toLowerCase()} is ${Math.round(p.diffVsMarketPct)}% above market average and rising.`,
        suggestedAction: score < 75 ? `Review ${p.supplierName}; source ${p.category.toLowerCase()} elsewhere if it holds.` : `Negotiate ${p.category.toLowerCase()} pricing with ${p.supplierName}.`,
      });
    } else if (Math.abs(p.changePct) <= 1 && score >= 82) {
      out.push({
        id: `opp-watch-${p.id}`,
        kind: 'watch',
        title: `${p.category} stable`,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        category: p.category,
        body: `${p.supplierName} has held ${p.item.toLowerCase()} pricing steady for weeks — a dependable ${p.category.toLowerCase()} line.`,
        suggestedAction: `Keep ${p.supplierName} as the anchor for ${p.category.toLowerCase()}.`,
      });
    }
  }
  // Strongest signals first: buy_now, then negotiate/review, then watch.
  const rank: Record<OpportunityKind, number> = { buy_now: 0, negotiate: 1, review: 2, watch: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 8);
}
