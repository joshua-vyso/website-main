import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { CustomersView } from '@/components/platform/orderflow/CustomersView';
import type { OfCustomer, OfOrder } from '@/lib/platform/orderflow';
import type { OrderLite } from '@/lib/platform/orderflow-crm';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

export default async function OrderFlowCustomersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: customers }, { data: orders }, { data: items }] = await Promise.all([
    db.from('of_customers').select('*').eq('org_id', orgId).order('name', { ascending: true }),
    db.from('of_orders').select('id, customer_id, status, invoice_number, created_at').eq('org_id', orgId),
    db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
  ]);

  const byOrder = new Map<string, { total: number; count: number }>();
  for (const it of (items ?? []) as ItemAgg[]) {
    const agg = byOrder.get(it.order_id) ?? { total: 0, count: 0 };
    agg.total += (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    agg.count += 1;
    byOrder.set(it.order_id, agg);
  }

  const ordersByCustomer: Record<string, OrderLite[]> = {};
  for (const o of (orders ?? []) as Pick<OfOrder, 'id' | 'customer_id' | 'status' | 'invoice_number' | 'created_at'>[]) {
    if (!o.customer_id) continue;
    const agg = byOrder.get(o.id) ?? { total: 0, count: 0 };
    (ordersByCustomer[o.customer_id] ??= []).push({
      id: o.id,
      customer_id: o.customer_id,
      status: o.status,
      invoice_number: o.invoice_number,
      created_at: o.created_at,
      total: agg.total,
      item_count: agg.count,
    });
  }

  return <CustomersView customers={(customers ?? []) as OfCustomer[]} ordersByCustomer={ordersByCustomer} />;
}
