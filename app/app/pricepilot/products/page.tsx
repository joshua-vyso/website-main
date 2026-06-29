import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { ProductsPricingView, type ProductPriceRow } from '@/components/platform/pricepilot/ProductsPricingView';
import {
  pickBaseList,
  productMargins,
  DEFAULT_TARGET_MARGIN,
  type PlPriceList,
  type PlOverride,
  type PlTargets,
  type PriceItemLite,
} from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number };

export default async function PricePilotProductsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: items }, { data: lists }, { data: overrides }, { data: orders }, { data: orderItems }, { data: targetsRow }] =
    await Promise.all([
      db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).order('name').limit(5000),
      db.from('pl_price_lists').select('*').eq('org_id', orgId),
      db.from('pl_overrides').select('*').eq('org_id', orgId),
      db.from('of_orders').select('id, created_at').eq('org_id', orgId).in('status', ['invoiced', 'paid']),
      db.from('of_order_items').select('order_id, stock_item_id, qty').eq('org_id', orgId),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const priceLists = (lists ?? []) as PlPriceList[];
  const priceItems = (items ?? []) as PriceItemLite[];
  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;

  const base = pickBaseList(priceLists);
  const pms = productMargins(priceItems, base, (overrides ?? []) as PlOverride[]);

  const since = Date.now() - 30 * 86_400_000;
  const orderTs = new Map(((orders ?? []) as Pick<OfOrder, 'id' | 'created_at'>[]).map((o) => [o.id, new Date(o.created_at).getTime()]));
  const units30d = new Map<string, number>();
  for (const it of (orderItems ?? []) as ItemRow[]) {
    const ts = orderTs.get(it.order_id);
    if (ts == null || ts < since || !it.stock_item_id) continue;
    units30d.set(it.stock_item_id, (units30d.get(it.stock_item_id) ?? 0) + (Number(it.qty) || 0));
  }

  const rows: ProductPriceRow[] = pms.map((p) => ({
    id: p.item.id,
    name: p.item.name,
    category: p.item.category,
    cost: p.cost,
    margin: p.marginPct,
    sell: p.sell,
    units: units30d.get(p.item.id) ?? 0,
  }));

  return <ProductsPricingView rows={rows} target={target} hasBaseList={!!base} />;
}
