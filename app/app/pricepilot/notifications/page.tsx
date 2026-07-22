import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { NotificationList } from '@/components/platform/pricepilot/NotificationList';
import {
  pickBaseList,
  productMargins,
  computeOpportunities,
  priceListValidity,
  computeNotifications,
  DEFAULT_TARGET_MARGIN,
  type PlPriceList,
  type PlOverride,
  type PlTargets,
  type PriceItemLite,
} from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number };
type ProductRow = PriceItemLite & { price_history: number[] | null };

export default async function PricePilotNotificationsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: items }, { data: lists }, { data: overrides }, { data: orders }, { data: orderItems }, { data: customers }, { data: targetsRow }] =
    await Promise.all([
      db.from('pp_stock_items').select('id, name, category, avg_unit_price, price_history').eq('org_id', orgId).limit(5000),
      db.from('pl_price_lists').select('*').eq('org_id', orgId),
      db.from('pl_overrides').select('*').eq('org_id', orgId),
      db.from('of_orders').select('id, created_at').eq('org_id', orgId).in('status', ['invoiced', 'paid']),
      db.from('of_order_items').select('order_id, stock_item_id, qty').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const priceLists = (lists ?? []) as PlPriceList[];
  const priceItems = (items ?? []) as ProductRow[];
  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const base = pickBaseList(priceLists);
  const pms = productMargins(priceItems, base, (overrides ?? []) as PlOverride[]);
  const belowTargetCount = pms.filter((p) => p.marginPct < target).length;

  const since = Date.now() - 30 * 86_400_000;
  const orderTs = new Map(((orders ?? []) as Pick<OfOrder, 'id' | 'created_at'>[]).map((o) => [o.id, new Date(o.created_at).getTime()]));
  const units30d = new Map<string, number>();
  for (const it of (orderItems ?? []) as ItemRow[]) {
    const ts = orderTs.get(it.order_id);
    if (ts == null || ts < since || !it.stock_item_id) continue;
    units30d.set(it.stock_item_id, (units30d.get(it.stock_item_id) ?? 0) + (Number(it.qty) || 0));
  }
  const marginOpportunity = computeOpportunities(pms, target, units30d).reduce((s, o) => s + o.monthlyImpact, 0);

  const expiringContracts = priceLists
    .filter((l) => l.customer_id)
    .map((l) => ({ list: l, v: priceListValidity(l) }))
    .filter(({ v }) => v.status === 'expiring' || v.status === 'expired')
    .map(({ list, v }) => ({
      customer: (list.customer_id && custName.get(list.customer_id)) || 'Customer',
      listName: list.name,
      listId: list.id,
      label: v.label,
      expired: v.status === 'expired',
    }));

  const costSpikes = priceItems
    .map((p) => {
      const h = (p.price_history ?? []).map(Number).filter((n) => Number.isFinite(n));
      if (h.length < 2) return null;
      const prev = h[h.length - 2];
      const last = h[h.length - 1];
      if (!(prev > 0)) return null;
      const pctUp = ((last - prev) / prev) * 100;
      return pctUp >= 15 ? { id: p.id, name: p.name, pctUp } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b!.pctUp - a!.pctUp)
    .slice(0, 5) as { id: string; name: string; pctUp: number }[];

  const notifications = computeNotifications({ expiringContracts, belowTargetCount, marginOpportunity, target, costSpikes });
  const high = notifications.filter((n) => n.severity === 'high').length;

  return (
    <div>
      <div>
        <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Notifications</h1>
        <p className="mt-1 text-[14px] text-[#8A8E86]">
          {notifications.length === 0
            ? 'Pricing alerts across contracts, margins and costs'
            : `${notifications.length} alert${notifications.length === 1 ? '' : 's'}${high > 0 ? ` · ${high} need${high === 1 ? 's' : ''} action` : ''}`}
        </p>
      </div>
      <div className="mt-5">
        <NotificationList items={notifications} />
      </div>
    </div>
  );
}
