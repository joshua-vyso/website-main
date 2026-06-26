/**
 * ProcurePulse server data access (website). All reads are org-scoped; RLS
 * enforces the same boundary + the `procurepulse` feature gate.
 */
import { createServerSupabase } from './supabase-server';
import type {
  ItemSupplierPrice,
  PpNotification,
  PpSettings,
  ProcurePulseActivityEvent,
  ProductAlias,
  ProductUnit,
  ReorderRequest,
  StockItem,
  StockMovement,
  StockOrder,
  StockThreshold,
} from './types';

type DB = Awaited<ReturnType<typeof createServerSupabase>>;

export async function fetchStock(db: DB, orgId: string): Promise<StockItem[]> {
  const { data } = await db
    .from('pp_stock_items')
    .select('*')
    .eq('org_id', orgId)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  return (data ?? []) as StockItem[];
}

export async function fetchStockItem(db: DB, id: string): Promise<StockItem | null> {
  const { data } = await db.from('pp_stock_items').select('*').eq('id', id).maybeSingle();
  return (data as StockItem) ?? null;
}

export async function fetchPrices(db: DB, orgId: string): Promise<ItemSupplierPrice[]> {
  const { data } = await db.from('pp_item_suppliers').select('*').eq('org_id', orgId);
  return (data ?? []) as ItemSupplierPrice[];
}

export async function fetchPricesForItem(db: DB, itemId: string): Promise<ItemSupplierPrice[]> {
  const { data } = await db
    .from('pp_item_suppliers')
    .select('*')
    .eq('stock_item_id', itemId)
    .order('price', { ascending: true });
  return (data ?? []) as ItemSupplierPrice[];
}

export async function fetchMovements(db: DB, itemId: string): Promise<StockMovement[]> {
  const { data } = await db
    .from('pp_movements')
    .select('*')
    .eq('stock_item_id', itemId)
    .order('occurred_at', { ascending: false });
  return (data ?? []) as StockMovement[];
}

/** Most-recent stock movements across the org — for the dashboard activity feed. */
export async function fetchRecentMovements(
  db: DB,
  orgId: string,
  limit = 8,
): Promise<StockMovement[]> {
  const { data } = await db
    .from('pp_movements')
    .select('*')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as StockMovement[];
}

export async function fetchNotifications(db: DB, orgId: string): Promise<PpNotification[]> {
  const { data } = await db
    .from('pp_notifications')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []) as PpNotification[];
}

export async function fetchSettings(db: DB, orgId: string): Promise<PpSettings | null> {
  const { data } = await db.from('pp_settings').select('*').eq('org_id', orgId).maybeSingle();
  return (data as PpSettings) ?? null;
}

/**
 * Manual reorder requests for an org. Tolerant of the table not existing yet
 * (data → null → empty list) so the page renders before the migration lands.
 */
export async function fetchReorderRequests(
  db: DB,
  orgId: string,
  status = 'open',
): Promise<ReorderRequest[]> {
  const { data } = await db
    .from('pp_reorder_requests')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', status)
    .order('created_at', { ascending: false });
  return (data ?? []) as ReorderRequest[];
}

/**
 * Confirmed/dismissed product-name aliases for an org. Tolerant of the table not
 * existing yet (data → null → empty list) so the Products page renders before the
 * pp-name-aliases migration lands.
 */
export async function fetchProductAliases(db: DB, orgId: string): Promise<ProductAlias[]> {
  const { data } = await db.from('pp_name_aliases').select('*').eq('org_id', orgId);
  return (data ?? []) as ProductAlias[];
}

/** Per-product stock/freshness thresholds. Tolerant of the table not existing yet. */
export async function fetchThresholds(db: DB, orgId: string): Promise<StockThreshold[]> {
  const { data } = await db.from('pp_stock_thresholds').select('*').eq('org_id', orgId);
  return (data ?? []) as StockThreshold[];
}

/** Per-product unit setup. Tolerant of the table not existing yet. */
export async function fetchProductUnits(db: DB, orgId: string): Promise<ProductUnit[]> {
  const { data } = await db.from('pp_product_units').select('*').eq('org_id', orgId);
  return (data ?? []) as ProductUnit[];
}

/** Stock orders created from the Reordering page. Tolerant of missing table. */
export async function fetchStockOrders(db: DB, orgId: string, limit = 60): Promise<StockOrder[]> {
  const { data } = await db
    .from('pp_stock_orders')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as StockOrder[];
}

/** Recent stock activity events for the dashboard feed. Tolerant of missing table. */
export async function fetchActivityEvents(
  db: DB,
  orgId: string,
  limit = 8,
): Promise<ProcurePulseActivityEvent[]> {
  const { data } = await db
    .from('procurepulse_activity_events')
    .select('*')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ProcurePulseActivityEvent[];
}
