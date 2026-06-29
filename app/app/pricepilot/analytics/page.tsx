import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AnalyticsView, type DimensionData } from '@/components/platform/pricepilot/AnalyticsView';
import { finalizeAggs, DEFAULT_TARGET_MARGIN, type SalesAgg, type PlTargets } from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number; unit_price: number };
type WindowKey = '30d' | '90d' | 'all';

export default async function PricePilotAnalyticsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: orderItems }, { data: items }, { data: customers }, { data: targetsRow }] =
    await Promise.all([
      db.from('of_orders').select('id, created_at, customer_id').eq('org_id', orgId).in('status', ['invoiced', 'paid']),
      db.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
      db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).limit(5000),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;

  const costByItem = new Map<string, number | null>();
  const catByItem = new Map<string, string>();
  const nameByItem = new Map<string, string>();
  for (const it of (items ?? []) as { id: string; name: string; category: string | null; avg_unit_price: number | null }[]) {
    costByItem.set(it.id, it.avg_unit_price != null ? Number(it.avg_unit_price) : null);
    catByItem.set(it.id, it.category || 'Uncategorised');
    nameByItem.set(it.id, it.name);
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const orderInfo = new Map(
    ((orders ?? []) as Pick<OfOrder, 'id' | 'created_at' | 'customer_id'>[]).map((o) => [
      o.id,
      { ts: new Date(o.created_at).getTime(), customerId: o.customer_id },
    ]),
  );

  const now = Date.now();
  const starts: Record<WindowKey, number> = { '30d': now - 30 * 86_400_000, '90d': now - 90 * 86_400_000, all: 0 };
  const mk = () => ({ customer: new Map<string, SalesAgg>(), category: new Map<string, SalesAgg>(), product: new Map<string, SalesAgg>() });
  const buckets: Record<WindowKey, ReturnType<typeof mk>> = { '30d': mk(), '90d': mk(), all: mk() };

  const add = (map: Map<string, SalesAgg>, key: string, label: string, rev: number, costableRev: number, cost: number, units: number) => {
    const a = map.get(key) ?? { key, label, revenue: 0, costableRev: 0, cost: 0, units: 0 };
    a.revenue += rev;
    a.costableRev += costableRev;
    a.cost += cost;
    a.units += units;
    map.set(key, a);
  };

  for (const it of (orderItems ?? []) as ItemRow[]) {
    const info = orderInfo.get(it.order_id);
    if (!info) continue; // only invoiced/paid orders
    const qty = Number(it.qty) || 0;
    const rev = qty * (Number(it.unit_price) || 0);
    const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
    const costable = unitCost != null;
    const costableRev = costable ? rev : 0;
    const cost = costable ? qty * (unitCost as number) : 0;

    const custKey = info.customerId ?? '∅';
    const custLabel = (info.customerId && custName.get(info.customerId)) || 'No customer';
    const cat = it.stock_item_id ? catByItem.get(it.stock_item_id) ?? 'Uncategorised' : 'Uncategorised';
    const prodKey = it.stock_item_id ?? '∅';
    const prodLabel = (it.stock_item_id && nameByItem.get(it.stock_item_id)) || 'Unknown product';

    (['30d', '90d', 'all'] as WindowKey[]).forEach((w) => {
      if (info.ts < starts[w]) return;
      const b = buckets[w];
      add(b.customer, custKey, custLabel, rev, costableRev, cost, qty);
      add(b.category, cat, cat, rev, costableRev, cost, qty);
      add(b.product, prodKey, prodLabel, rev, costableRev, cost, qty);
    });
  }

  const build = (w: WindowKey): DimensionData => {
    const c = finalizeAggs([...buckets[w].customer.values()]);
    const cat = finalizeAggs([...buckets[w].category.values()]);
    const p = finalizeAggs([...buckets[w].product.values()]);
    return { customer: c.rows, category: cat.rows, product: p.rows, totals: c.totals };
  };

  const windows = { '30d': build('30d'), '90d': build('90d'), all: build('all') };

  return <AnalyticsView windows={windows} target={target} />;
}
