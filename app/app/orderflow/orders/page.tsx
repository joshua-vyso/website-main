import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { OrdersView, type OrderRow, type OrderItemLite } from '@/components/platform/orderflow/OrdersView';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { orderTotal, type OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; name: string; qty: number; unit: string | null; unit_price: number };

export default async function OrderFlowOrdersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }, { data: products }, { data: settings }] =
    await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      db.from('of_order_items').select('order_id, name, qty, unit, unit_price').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId).order('name', { ascending: true }),
      db.from('pp_stock_items').select('id, name, unit, avg_unit_price').eq('org_id', orgId).order('name').limit(2000),
      // Org units (workspace-managed) feed the line-item unit dropdown. Tolerant of pp_settings missing.
      db.from('pp_settings').select('custom_units').eq('org_id', orgId).maybeSingle(),
    ]);
  const orgUnits = allUnits((settings as { custom_units?: string[] | null } | null)?.custom_units);

  // Group line items per order — used for totals, the detail drawer, and search.
  const itemsByOrder: Record<string, OrderItemLite[]> = {};
  for (const it of (items ?? []) as ItemRow[]) {
    (itemsByOrder[it.order_id] ??= []).push({
      name: it.name,
      qty: Number(it.qty) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
    });
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const rows: OrderRow[] = ((orders ?? []) as OfOrder[]).map((o) => {
    const its = itemsByOrder[o.id] ?? [];
    return {
      id: o.id,
      customer_id: o.customer_id,
      customer_name: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
      status: o.status,
      invoice_number: o.invoice_number,
      notes: o.notes,
      total: orderTotal(its),
      item_count: its.length,
      created_at: o.created_at,
    };
  });

  return (
    <OrdersView
      orders={rows}
      items={itemsByOrder}
      customers={(customers ?? []) as { id: string; name: string }[]}
      products={(products ?? []) as { id: string; name: string; unit: string | null; avg_unit_price: number | null }[]}
      orgUnits={orgUnits}
    />
  );
}
