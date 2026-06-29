import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { OrdersView, type OrderRow } from '@/components/platform/orderflow/OrdersView';
import { allUnits } from '@/lib/platform/procurepulse/units';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

export default async function OrderFlowOrdersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }, { data: products }, { data: settings }] =
    await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId).order('name', { ascending: true }),
      db.from('pp_stock_items').select('id, name, unit, avg_unit_price').eq('org_id', orgId).order('name').limit(2000),
      // Org units (workspace-managed) feed the line-item unit dropdown. Tolerant of pp_settings missing.
      db.from('pp_settings').select('custom_units').eq('org_id', orgId).maybeSingle(),
    ]);
  const orgUnits = allUnits((settings as { custom_units?: string[] | null } | null)?.custom_units);

  const byOrder = new Map<string, { total: number; count: number }>();
  for (const it of (items ?? []) as ItemAgg[]) {
    const agg = byOrder.get(it.order_id) ?? { total: 0, count: 0 };
    agg.total += (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    agg.count += 1;
    byOrder.set(it.order_id, agg);
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const rows: OrderRow[] = ((orders ?? []) as OfOrder[]).map((o) => {
    const agg = byOrder.get(o.id) ?? { total: 0, count: 0 };
    return {
      id: o.id,
      customer_name: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
      status: o.status,
      invoice_number: o.invoice_number,
      total: agg.total,
      item_count: agg.count,
      created_at: o.created_at,
    };
  });

  return (
    <OrdersView
      orders={rows}
      customers={(customers ?? []) as { id: string; name: string }[]}
      products={(products ?? []) as { id: string; name: string; unit: string | null; avg_unit_price: number | null }[]}
      orgUnits={orgUnits}
    />
  );
}
