import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { InvoicingView, type InvoiceRow } from '@/components/platform/orderflow/InvoicingView';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

export default async function OrderFlowInvoicingPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }] = await Promise.all([
    db
      .from('of_orders')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['confirmed', 'invoiced', 'paid'])
      .order('created_at', { ascending: false }),
    db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
    db.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);

  const byOrder = new Map<string, number>();
  for (const it of (items ?? []) as ItemAgg[]) {
    byOrder.set(it.order_id, (byOrder.get(it.order_id) ?? 0) + (Number(it.qty) || 0) * (Number(it.unit_price) || 0));
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const orderList = (orders ?? []) as OfOrder[];

  const rows: InvoiceRow[] = orderList.map((o) => ({
    id: o.id,
    customer_name: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
    status: o.status,
    invoice_number: o.invoice_number,
    total: byOrder.get(o.id) ?? 0,
    created_at: o.created_at,
  }));

  const startSeq = orderList.filter((o) => o.invoice_number).length + 1;

  return <InvoicingView rows={rows} startSeq={startSeq} />;
}
