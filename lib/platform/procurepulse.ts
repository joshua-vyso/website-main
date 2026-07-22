/**
 * ProcurePulse — pure display metadata + compute helpers shared by web + mobile.
 * No framework imports: same stock-status / KPI / alert / matrix / draft-order
 * logic powers both surfaces. Mirrored byte-identical into each app's lib:
 *   shared/procurepulse.ts ↔ website/lib/platform/procurepulse.ts ↔ mobile/lib/procurepulse.ts
 */
import type {
  ItemSupplierPrice,
  PpNotificationKind,
  Recipe,
  RecipeIngredient,
  StockItem,
  StockStatus,
} from './types';

// ---------------------------------------------------------------------------
// Display metadata
// ---------------------------------------------------------------------------

/** Stock status pill background/foreground + label. */
export const STOCK_STATUS_COLORS: Record<StockStatus, { bg: string; fg: string; label: string }> = {
  in_stock: { bg: '#E1F5EE', fg: '#0F6E56', label: 'In stock' },
  low: { bg: '#FBEEDA', fg: '#854F0B', label: 'Low' },
  out: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Out' },
};

/** Notification tile colours, keyed by kind. */
export const NOTIFICATION_KINDS: Record<PpNotificationKind, { bg: string; fg: string; label: string }> = {
  low_stock: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Low stock' },
  new_direct_doc: { bg: '#E6F1FB', fg: '#0C447C', label: 'New document' },
  new_market_statement: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Market statement' },
  price_change: { bg: '#FBEEDA', fg: '#854F0B', label: 'Price change' },
  reorder: { bg: '#EAF2FC', fg: '#1F5FA8', label: 'Reorder' },
};

export const TREND_UP = '#0F6E56';
export const TREND_DOWN = '#A32D2D';
export const TREND_FLAT = '#9A9DA1';

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

/** Live status derived from on-hand vs the low-stock threshold. */
export function stockStatus(item: Pick<StockItem, 'on_hand' | 'low_threshold'>): StockStatus {
  if (item.on_hand <= 0) return 'out';
  if (item.on_hand <= item.low_threshold) return 'low';
  return 'in_stock';
}

export function trendColor(pct: number | null | undefined): string {
  if (pct == null || pct === 0) return TREND_FLAT;
  return pct > 0 ? TREND_UP : TREND_DOWN;
}

export function trendLabel(pct: number | null | undefined): string {
  if (pct == null || pct === 0) return '—';
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(Math.round(pct))}%`;
}

/** Rand formatter. `compact` → "R 248k" / "R 1.2M"; otherwise "R 3,284". */
export function rand(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n == null) return '—';
  if (opts?.compact && Math.abs(n) >= 1000) {
    const decimals = Math.abs(n) >= 100_000 ? 0 : 1;
    const k = Number((n / 1000).toFixed(decimals));
    // Anything that would read as ≥ 1,000k rolls over to millions ("R 1.2M").
    if (Math.abs(k) >= 1000) {
      const m = n / 1_000_000;
      return `R ${m.toFixed(Math.abs(m) >= 10 ? 0 : 1)}M`;
    }
    return `R ${k.toFixed(decimals)}k`;
  }
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

// ---------------------------------------------------------------------------
// KPIs (Dashboard)
// ---------------------------------------------------------------------------

export interface StockKpis {
  stockValue: number;
  itemsLow: number;
  outOfStock: number;
  spendWeek: number;
}

export function computeKpis(items: StockItem[]): StockKpis {
  let stockValue = 0;
  let itemsLow = 0;
  let outOfStock = 0;
  for (const it of items) {
    stockValue += (it.on_hand ?? 0) * (it.avg_unit_price ?? 0);
    const s = stockStatus(it);
    if (s === 'low') itemsLow += 1;
    if (s === 'out') outOfStock += 1;
  }
  // Illustrative weekly spend ≈ a third of stock value (demo metric until POs land).
  return { stockValue, itemsLow, outOfStock, spendWeek: Math.round(stockValue * 0.33) };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/** Suggested reorder quantity: lift on-hand back above the threshold. */
export function suggestedReorder(item: Pick<StockItem, 'on_hand' | 'low_threshold'>): number {
  const target = Math.max(item.low_threshold * 1.5, item.low_threshold + 4);
  return Math.max(0, Math.ceil(target - item.on_hand));
}

export interface StockAlert {
  item: StockItem;
  status: StockStatus;
  suggested: number;
}

/** Low + out items, sorted out-first then by how far below threshold. */
export function computeAlerts(items: StockItem[]): StockAlert[] {
  const rank = (s: StockStatus) => (s === 'out' ? 0 : 1);
  return items
    .map((item) => ({ item, status: stockStatus(item), suggested: suggestedReorder(item) }))
    .filter((a) => a.status !== 'in_stock')
    .sort((a, b) => {
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return a.item.on_hand - a.item.low_threshold - (b.item.on_hand - b.item.low_threshold);
    });
}

// ---------------------------------------------------------------------------
// Forecast / freshness helpers (reusable across the stock-intelligence pages)
// ---------------------------------------------------------------------------

export type FreshnessStatus = 'fresh' | 'aging' | 'expired';

/** Freshness state from an item's age vs its freshness threshold (same unit). */
export function freshnessStatus(age: number | null, threshold: number | null): FreshnessStatus {
  if (age == null || threshold == null || threshold <= 0) return 'fresh';
  if (age >= threshold) return 'expired';
  if (age >= threshold * 0.7) return 'aging';
  return 'fresh';
}

/** Days of cover at a given daily usage; null when usage is unknown/zero. */
export function daysOfCover(onHand: number, dailyUsage: number | null | undefined): number | null {
  if (!dailyUsage || dailyUsage <= 0) return null;
  return Math.round((onHand / dailyUsage) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Draft purchase order (Reorder)
// ---------------------------------------------------------------------------

export interface DraftLine {
  item: StockItem;
  qty: number;
  supplier: string;
  unitPrice: number;
  lineTotal: number;
}
export interface DraftGroup {
  supplier: string;
  lines: DraftLine[];
  subtotal: number;
}
export interface DraftOrder {
  groups: DraftGroup[];
  total: number;
  itemCount: number;
}

function pricesByItem(prices: ItemSupplierPrice[]): Map<string, ItemSupplierPrice[]> {
  const byItem = new Map<string, ItemSupplierPrice[]>();
  for (const p of prices) {
    const arr = byItem.get(p.stock_item_id) ?? [];
    arr.push(p);
    byItem.set(p.stock_item_id, arr);
  }
  return byItem;
}

/** Build a draft PO from low/out items, each at its cheapest supplier, grouped by supplier. */
export function buildDraftOrder(items: StockItem[], prices: ItemSupplierPrice[]): DraftOrder {
  const byItem = pricesByItem(prices);
  const lines: DraftLine[] = computeAlerts(items).map(({ item, suggested }) => {
    const cheapest = (byItem.get(item.id) ?? []).slice().sort((a, b) => a.price - b.price)[0];
    const supplier = cheapest?.supplier_name ?? item.cheapest_supplier ?? 'Supplier';
    const unitPrice = cheapest?.price ?? item.avg_unit_price ?? 0;
    return { item, qty: suggested, supplier, unitPrice, lineTotal: suggested * unitPrice };
  });
  const groupsMap = new Map<string, DraftLine[]>();
  for (const l of lines) {
    const arr = groupsMap.get(l.supplier) ?? [];
    arr.push(l);
    groupsMap.set(l.supplier, arr);
  }
  const groups: DraftGroup[] = [...groupsMap.entries()].map(([supplier, ls]) => ({
    supplier,
    lines: ls,
    subtotal: ls.reduce((s, l) => s + l.lineTotal, 0),
  }));
  return { groups, total: groups.reduce((s, g) => s + g.subtotal, 0), itemCount: lines.length };
}

// ---------------------------------------------------------------------------
// Supplier price matrix (Procurement intelligence)
// ---------------------------------------------------------------------------

export interface MatrixCell {
  price: number | null;
  cheapest: boolean;
}
export interface MatrixRow {
  item: StockItem;
  cells: Record<string, MatrixCell>;
  saving: number;
}
export interface PriceMatrix {
  suppliers: string[];
  rows: MatrixRow[];
}

export function buildMatrix(items: StockItem[], prices: ItemSupplierPrice[]): PriceMatrix {
  const suppliers = [...new Set(prices.map((p) => p.supplier_name))];
  const byItem = pricesByItem(prices);
  const rows: MatrixRow[] = items
    .filter((it) => (byItem.get(it.id) ?? []).length > 0)
    .map((item) => {
      const ps = byItem.get(item.id) ?? [];
      const min = ps.length ? Math.min(...ps.map((p) => p.price)) : null;
      const max = ps.length ? Math.max(...ps.map((p) => p.price)) : null;
      const cells: Record<string, MatrixCell> = {};
      for (const s of suppliers) {
        const hit = ps.find((p) => p.supplier_name === s);
        cells[s] = { price: hit?.price ?? null, cheapest: hit != null && hit.price === min };
      }
      return { item, cells, saving: min != null && max != null ? max - min : 0 };
    });
  return { suppliers, rows };
}

// ---------------------------------------------------------------------------
// Recipes (production planning from live stock)
// ---------------------------------------------------------------------------

export type RecipeReadiness = 'ready' | 'blocked' | 'unknown';

/** One ingredient's live availability against the stock item it draws from. */
export interface IngredientAvailability {
  ingredient: RecipeIngredient;
  stockItem: StockItem | null;
  /** Whether the line is linked to a tracked stock item. */
  linked: boolean;
  /** Units on hand of the linked stock item (0 when unlinked). */
  onHand: number;
  /** Units this ingredient consumes per batch. */
  perBatch: number;
  /**
   * Batches this ingredient alone could supply: `floor(onHand / perBatch)`.
   * `Infinity` (non-constraining) when unlinked or perBatch ≤ 0 — we can't
   * judge availability, so it shouldn't drag the whole recipe to zero.
   */
  possibleBatches: number;
}

export function ingredientAvailability(
  ingredient: RecipeIngredient,
  stockItem: StockItem | null | undefined,
): IngredientAvailability {
  const perBatch = ingredient.qty_per_batch > 0 ? ingredient.qty_per_batch : 0;
  const linked = !!stockItem;
  const onHand = stockItem?.on_hand ?? 0;
  const possibleBatches = linked && perBatch > 0 ? Math.floor(onHand / perBatch) : Infinity;
  return { ingredient, stockItem: stockItem ?? null, linked, onHand, perBatch, possibleBatches };
}

export interface RecipeBatchPlan {
  availabilities: IngredientAvailability[];
  /** Max batches producible now; `null` when nothing constrains it (empty / all unlinked). */
  batches: number | null;
  /** The ingredient that caps production (smallest finite possibleBatches). */
  limiting: IngredientAvailability | null;
  readiness: RecipeReadiness;
  /** Stock cost of one batch = Σ perBatch × avg_unit_price over linked ingredients. */
  costPerBatch: number;
}

/**
 * Live max-batches for a recipe from its ingredients and a stock snapshot.
 * `batches` is governed by the most-constrained *linked* ingredient; unlinked or
 * zero-per-batch lines are surfaced (via `availabilities`) but don't constrain.
 */
export function maxRecipeBatches(
  ingredients: RecipeIngredient[],
  stockByItem: Map<string, StockItem>,
): RecipeBatchPlan {
  const availabilities = ingredients.map((ing) =>
    ingredientAvailability(ing, ing.stock_item_id ? stockByItem.get(ing.stock_item_id) : null),
  );
  const costPerBatch = availabilities.reduce(
    (s, a) => s + a.perBatch * (a.stockItem?.avg_unit_price ?? 0),
    0,
  );
  const constraining = availabilities.filter((a) => Number.isFinite(a.possibleBatches));
  if (constraining.length === 0) {
    return { availabilities, batches: null, limiting: null, readiness: 'unknown', costPerBatch };
  }
  let limiting = constraining[0];
  for (const a of constraining) if (a.possibleBatches < limiting.possibleBatches) limiting = a;
  const batches = limiting.possibleBatches;
  return {
    availabilities,
    batches,
    limiting,
    readiness: batches > 0 ? 'ready' : 'blocked',
    costPerBatch,
  };
}

export interface RecipeWithPlan {
  recipe: Recipe;
  plan: RecipeBatchPlan;
  ingredientCount: number;
}

export interface RecipeKpis {
  activeRecipes: number;
  blocked: number;
  /** Stock cost to make one batch of every recipe. */
  costOneBatchEach: number;
  /** Product name used across the most recipes (— when there are none). */
  mostUsedIngredient: string;
  mostUsedCount: number;
}

/** Roll a set of recipes + their ingredients against stock into list-page KPIs. */
export function computeRecipeKpis(plans: RecipeWithPlan[], ingredients: RecipeIngredient[]): RecipeKpis {
  const blocked = plans.filter((p) => p.plan.readiness === 'blocked').length;
  const costOneBatchEach = plans.reduce((s, p) => s + p.plan.costPerBatch, 0);

  // Most-used ingredient: count distinct recipes a normalized product name appears in.
  const recipesByName = new Map<string, { label: string; recipes: Set<string> }>();
  for (const ing of ingredients) {
    const key = (ing.product_name ?? '').trim().toLowerCase();
    if (!key) continue;
    const entry = recipesByName.get(key) ?? { label: ing.product_name.trim(), recipes: new Set() };
    entry.recipes.add(ing.recipe_id);
    recipesByName.set(key, entry);
  }
  let mostUsedIngredient = '—';
  let mostUsedCount = 0;
  for (const { label, recipes } of recipesByName.values()) {
    if (recipes.size > mostUsedCount) {
      mostUsedCount = recipes.size;
      mostUsedIngredient = label;
    }
  }

  return {
    activeRecipes: plans.length,
    blocked,
    costOneBatchEach,
    mostUsedIngredient,
    mostUsedCount,
  };
}

// ---------------------------------------------------------------------------
// Stock composition (Dashboard category breakdown)
// ---------------------------------------------------------------------------

/** Donut colours per produce category (aligned to the categorise taxonomy). */
export const CATEGORY_COLORS: Record<string, string> = {
  Fruit: '#BA7517',
  Vegetables: '#1D9E75',
  Herbs: '#3E7BC4',
  'Salad & Leafy Greens': '#0F6E56',
  Mushrooms: '#854F0B',
  Other: '#9A9DA1',
  Uncategorised: '#D7DAD8',
};

export interface CategorySlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Group stock items into category slices by product count. Items with no category
 * fall under "Uncategorised", which is always sorted last; the rest go largest-first.
 */
export function stockByCategory(items: Pick<StockItem, 'category'>[]): CategorySlice[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const label = (it.category ?? '').trim() || 'Uncategorised';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, color: CATEGORY_COLORS[label] ?? '#C4C4BE' }))
    .sort((a, b) => {
      if (a.label === 'Uncategorised') return 1;
      if (b.label === 'Uncategorised') return -1;
      return b.value - a.value;
    });
}
