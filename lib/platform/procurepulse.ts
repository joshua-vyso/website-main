/**
 * ProcurePulse — pure display metadata + compute helpers shared by web + mobile.
 * No framework imports: same stock-status / KPI / alert / matrix / draft-order
 * logic powers both surfaces. Mirrored byte-identical into each app's lib:
 *   shared/procurepulse.ts ↔ website/lib/platform/procurepulse.ts ↔ mobile/lib/procurepulse.ts
 */
import type {
  ItemSupplierPrice,
  PpNotificationKind,
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
  reorder: { bg: '#E3F0ED', fg: '#1E5E54', label: 'Reorder' },
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

/** Rand formatter. `compact` → "R 248k"; otherwise "R 3,284". */
export function rand(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n == null) return '—';
  if (opts?.compact && Math.abs(n) >= 1000) {
    return `R ${(n / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1)}k`;
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
