/**
 * PricePilot — types + pure helpers for price lists (margins on ProcurePulse
 * base prices), and customer complaints. Sales views read OrderFlow directly.
 */

export type PriceCadence = 'standard' | 'daily' | 'weekly' | 'monthly';
export type ComplaintStatus = 'open' | 'investigating' | 'resolved';

export interface PlPriceList {
  id: string;
  org_id: string;
  name: string;
  customer_id: string | null;
  default_margin_pct: number;
  cadence: PriceCadence;
  created_at: string;
}

export interface PlOverride {
  id: string;
  org_id: string;
  price_list_id: string;
  stock_item_id: string;
  margin_pct: number;
  created_at: string;
}

export interface PlComplaint {
  id: string;
  org_id: string;
  customer_id: string | null;
  order_id: string | null;
  title: string;
  body: string | null;
  image_url: string | null;
  status: ComplaintStatus;
  created_at: string;
}

export const CADENCES: readonly PriceCadence[] = ['standard', 'daily', 'weekly', 'monthly'];
export const CADENCE_LABEL: Record<PriceCadence, string> = {
  standard: 'Standard',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['open', 'investigating', 'resolved'];
export const COMPLAINT_STATUS_STYLE: Record<ComplaintStatus, { bg: string; fg: string; label: string }> = {
  open: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Open' },
  investigating: { bg: '#FBEEDA', fg: '#854F0B', label: 'Investigating' },
  resolved: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Resolved' },
};

/** Org pricing targets (`pl_targets`) — the MarginWise data PricePilot consumes. */
export interface PlTargets {
  org_id: string;
  target_margin_pct: number | null;
  monthly_revenue_target: number | null;
  monthly_gross_profit_target: number | null;
  monthly_opex: number | null;
  updated_at: string;
}

/** Fallback target margin used for health/opportunity maths when none is set. */
export const DEFAULT_TARGET_MARGIN = 30;

/** Sell price = base × (1 + margin%). */
export function sellPrice(base: number | null | undefined, marginPct: number): number {
  return (Number(base) || 0) * (1 + marginPct / 100);
}

// ---------------------------------------------------------------------------
// Pricing intelligence — catalogue margins, distribution, health, opportunities
// ---------------------------------------------------------------------------

export interface PriceItemLite {
  id: string;
  name: string;
  category: string | null;
  avg_unit_price: number | null;
}

/**
 * Pick the "base" price list a product's catalogue margin is read from: the
 * standard list with no customer (org-wide), else the oldest list. null = none.
 */
export function pickBaseList(lists: PlPriceList[]): PlPriceList | null {
  if (lists.length === 0) return null;
  const sorted = [...lists].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return sorted.find((l) => !l.customer_id && l.cadence === 'standard') ?? sorted.find((l) => !l.customer_id) ?? sorted[0];
}

export interface ProductMargin {
  item: PriceItemLite;
  cost: number | null;
  marginPct: number;
  sell: number;
}

/** Each product's current catalogue margin = its override on the base list, else the list default. */
export function productMargins(
  items: PriceItemLite[],
  base: PlPriceList | null,
  overrides: PlOverride[],
): ProductMargin[] {
  if (!base) return [];
  const ovByItem = new Map<string, number>();
  for (const o of overrides) if (o.price_list_id === base.id) ovByItem.set(o.stock_item_id, Number(o.margin_pct));
  return items.map((item) => {
    const cost = item.avg_unit_price != null ? Number(item.avg_unit_price) : null;
    const marginPct = ovByItem.has(item.id) ? ovByItem.get(item.id)! : Number(base.default_margin_pct);
    return { item, cost, marginPct, sell: sellPrice(cost, marginPct) };
  });
}

export const MARGIN_BANDS = [
  { label: '<10%', min: -Infinity, max: 10, color: '#A32D2D' },
  { label: '10–20%', min: 10, max: 20, color: '#BA7517' },
  { label: '20–30%', min: 20, max: 30, color: '#EF9F27' },
  { label: '30–40%', min: 30, max: 40, color: '#1D9E75' },
  { label: '40%+', min: 40, max: Infinity, color: '#0F6E56' },
] as const;

export interface MarginBand {
  label: string;
  color: string;
  count: number;
  pct: number;
}

/** Distribution of products across margin bands. */
export function marginDistribution(pms: ProductMargin[]): MarginBand[] {
  const total = pms.length || 1;
  return MARGIN_BANDS.map((b) => {
    const count = pms.filter((p) => p.marginPct >= b.min && p.marginPct < b.max).length;
    return { label: b.label, color: b.color, count, pct: Math.round((count / total) * 100) };
  });
}

/** Catalogue-average margin across all priced products. */
export function avgCatalogueMargin(pms: ProductMargin[]): number {
  if (pms.length === 0) return 0;
  return pms.reduce((s, p) => s + p.marginPct, 0) / pms.length;
}

export interface HealthInputs {
  hasBaseList: boolean;
  productCount: number;
  avgMargin: number;
  belowTargetCount: number;
  target: number;
  hasSalesThisMonth: boolean;
}

/**
 * Pricing Health (0–100): is pricing set up (30), is the average margin near
 * target (30), are most products at/above target (25), is pricing actually in
 * use this month (15).
 */
export function pricingHealth(h: HealthInputs): number {
  if (!h.hasBaseList || h.productCount === 0) return h.hasBaseList ? 30 : 0;
  const setup = 30;
  const vsTarget = Math.min(1, h.target > 0 ? h.avgMargin / h.target : 1) * 30;
  const aboveShare = 1 - Math.min(1, h.belowTargetCount / h.productCount);
  const coverage = aboveShare * 25;
  const inUse = h.hasSalesThisMonth ? 15 : 0;
  return Math.max(0, Math.min(100, Math.round(setup + vsTarget + coverage + inUse)));
}

export function healthBand(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Healthy', color: '#0F6E56' };
  if (score >= 55) return { label: 'Needs attention', color: '#854F0B' };
  return { label: 'At risk', color: '#A32D2D' };
}

export interface Opportunity {
  item: PriceItemLite;
  currentMargin: number;
  suggestedMargin: number;
  currentSell: number;
  suggestedSell: number;
  monthlyUnits: number;
  /** Estimated extra monthly gross profit from moving to the suggested margin. */
  monthlyImpact: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Margin opportunities: products below the target margin that actually sell.
 * Impact = (target − current) margin × cost × monthly units. Sorted by impact.
 */
export function computeOpportunities(
  pms: ProductMargin[],
  target: number,
  monthlyUnitsByItem: Map<string, number>,
): Opportunity[] {
  const ops: Opportunity[] = [];
  for (const p of pms) {
    if (p.cost == null || p.marginPct >= target) continue;
    const units = monthlyUnitsByItem.get(p.item.id) ?? 0;
    const suggestedSell = sellPrice(p.cost, target);
    const monthlyImpact = (suggestedSell - p.sell) * units;
    ops.push({
      item: p.item,
      currentMargin: p.marginPct,
      suggestedMargin: target,
      currentSell: p.sell,
      suggestedSell,
      monthlyUnits: units,
      monthlyImpact,
      priority: monthlyImpact >= 1000 ? 'high' : monthlyImpact >= 200 ? 'medium' : 'low',
    });
  }
  return ops.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
}

export const PRIORITY_STYLE: Record<Opportunity['priority'], { bg: string; fg: string; label: string }> = {
  high: { bg: '#FCEBEB', fg: '#A32D2D', label: 'High' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium' },
  low: { bg: '#F0F0EC', fg: '#5F6368', label: 'Low' },
};

export type Confidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_STYLE: Record<Confidence, { bg: string; fg: string; label: string }> = {
  high: { bg: '#E1F5EE', fg: '#0F6E56', label: 'High confidence' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium confidence' },
  low: { bg: '#F0F0EC', fg: '#5F6368', label: 'Low confidence' },
};

/** Deterministic confidence + plain-language reasoning for a suggested price change. */
export function recommendationMeta(o: Opportunity): { confidence: Confidence; reason: string } {
  const gap = o.suggestedMargin - o.currentMargin;
  const confidence: Confidence = o.monthlyUnits >= 10 && gap >= 5 ? 'high' : o.monthlyUnits > 0 ? 'medium' : 'low';
  const sold =
    o.monthlyUnits > 0
      ? `Sold ${Math.round(o.monthlyUnits)} ${o.monthlyUnits === 1 ? 'unit' : 'units'} in the last 30 days. `
      : 'No sales in the last 30 days. ';
  // Reason states the situation only — the live (possibly edited) rand impact is
  // shown separately in the row, so we don't bake a figure in here that could disagree.
  const close = o.monthlyUnits > 0 ? 'Raising it to target lifts gross profit on every sale.' : 'Worth repricing before it sells again.';
  return {
    confidence,
    reason: `Currently ${Math.round(o.currentMargin)}% margin vs your ${Math.round(o.suggestedMargin)}% target. ${sold}${close}`,
  };
}

// ---------------------------------------------------------------------------
// Realized margin (from sales) + the deterministic AI insight line
// ---------------------------------------------------------------------------

export interface SaleLine {
  /** Line revenue = qty × unit price. */
  revenue: number;
  /** Line cost = qty × unit cost; null when the cost is unknown (excluded from margin). */
  cost: number | null;
}

/** Realized gross margin % over the costable lines (null if nothing costable). */
export function marginPctForLines(lines: SaleLine[]): number | null {
  let rev = 0;
  let cost = 0;
  let any = false;
  for (const l of lines) {
    if (l.cost == null) continue;
    rev += l.revenue;
    cost += l.cost;
    any = true;
  }
  if (!any || rev <= 0) return null;
  return ((rev - cost) / rev) * 100;
}

export interface InsightInputs {
  hasBaseList: boolean;
  productCount: number;
  belowTargetCount: number;
  target: number;
  monthlyOpportunity: number;
  avgMargin: number;
  revenueThisMonth: number;
  revenueTarget: number | null;
}

/**
 * One deterministic, data-grounded sentence for the AI Insight card. Picks the
 * most actionable thing it can see; Haiku narration can replace this later.
 */
export function pricingInsight(i: InsightInputs): string {
  if (!i.hasBaseList || i.productCount === 0) {
    return 'Create a price list and set a target margin to start tracking profitability and surfacing pricing opportunities.';
  }
  if (i.belowTargetCount > 0 && i.monthlyOpportunity >= 1) {
    return `${i.belowTargetCount} product${i.belowTargetCount === 1 ? ' is' : 's are'} priced below your ${Math.round(
      i.target,
    )}% target margin. Moving them to target could add about ${zar(i.monthlyOpportunity)} in gross profit each month.`;
  }
  if (i.belowTargetCount > 0) {
    return `${i.belowTargetCount} product${i.belowTargetCount === 1 ? ' is' : 's are'} below your ${Math.round(
      i.target,
    )}% target margin, but none have recent sales — worth repricing before they sell again.`;
  }
  if (i.revenueTarget && i.revenueThisMonth < i.revenueTarget) {
    const pct = Math.round((i.revenueThisMonth / i.revenueTarget) * 100);
    return `Margins look healthy — every product is at or above your ${Math.round(
      i.target,
    )}% target. You're at ${pct}% of this month's revenue goal.`;
  }
  return `Pricing looks healthy — your catalogue averages ${Math.round(
    i.avgMargin,
  )}% margin, at or above your ${Math.round(i.target)}% target across the board.`;
}

/** Rand, plain. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

/** Rand with cents (price lists need precision). */
export function zar2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
