/**
 * ProcurePulse server data access (website). All reads are org-scoped; RLS
 * enforces the same boundary + the `procurepulse` feature gate.
 */
import { createServerSupabase } from './supabase-server';
import type {
  ItemSupplierPrice,
  PpNotification,
  PpSettings,
  StockItem,
  StockMovement,
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
