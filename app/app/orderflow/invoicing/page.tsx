import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { InvoicingView, type CustomerContactLite } from '@/components/platform/orderflow/InvoicingView';
import type { OrderItemLite } from '@/components/platform/orderflow/OrdersView';
import { orderTotal, type OfOrder } from '@/lib/platform/orderflow';
import { deriveInvoice, type Invoice, type OrderLite } from '@/lib/platform/orderflow-crm';

type ItemRow = { order_id: string; name: string; qty: number; unit: string | null; unit_price: number };

export default async function OrderFlowInvoicingPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }] = await Promise.all([
    db
      .from('of_orders')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['confirmed', 'packed', 'delivered', 'invoiced', 'partially_paid', 'paid', 'cancelled'])
      .order('created_at', { ascending: false }),
    db.from('of_order_items').select('order_id, name, qty, unit, unit_price').eq('org_id', orgId),
    db.from('of_customers').select('id, name, email, phone').eq('org_id', orgId),
  ]);

  const itemsByOrder: Record<string, OrderItemLite[]> = {};
  for (const it of (items ?? []) as ItemRow[]) {
    (itemsByOrder[it.order_id] ??= []).push({ name: it.name, qty: Number(it.qty) || 0, unit: it.unit, unit_price: Number(it.unit_price) || 0 });
  }
  const custRows = (customers ?? []) as { id: string; name: string; email: string | null; phone: string | null }[];
  const custName = new Map(custRows.map((c) => [c.id, c.name]));
  const custContacts: Record<string, CustomerContactLite> = {};
  for (const c of custRows) custContacts[c.id] = { name: c.name, email: c.email, phone: c.phone };

  const orderList = (orders ?? []) as OfOrder[];
  const now = Date.now();
  let seq = orderList.filter((o) => o.invoice_number).length + 1;
  const invoices: Invoice[] = orderList.map((o) => {
    const its = itemsByOrder[o.id] ?? [];
    const lite: OrderLite = {
      id: o.id,
      customer_id: o.customer_id,
      status: o.status,
      invoice_number: o.invoice_number,
      created_at: o.created_at,
      total: orderTotal(its),
      item_count: its.length,
    };
    const inv = deriveInvoice(lite, (o.customer_id && custName.get(o.customer_id)) || 'No customer', seq, now);
    if (!o.invoice_number) seq++;
    return inv;
  });

  return <InvoicingView invoices={invoices} items={itemsByOrder} customers={custContacts} startSeq={orderList.filter((o) => o.invoice_number).length + 1} />;
}
