import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { ComplaintsManager, type ComplaintRow } from '@/components/platform/pricepilot/ComplaintsManager';
import type { PlComplaint } from '@/lib/platform/pricepilot';

export default async function PricePilotComplaintsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: complaints }, { data: customers }, { data: orders }] = await Promise.all([
    db.from('pl_complaints').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    db.from('of_customers').select('id, name').eq('org_id', orgId).order('name'),
    db.from('of_orders').select('id, invoice_number, customer_id, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
  ]);

  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const orderList = (orders ?? []) as { id: string; invoice_number: string | null; customer_id: string | null; created_at: string }[];
  const orderInvoice = new Map(orderList.map((o) => [o.id, o.invoice_number]));

  const rows: ComplaintRow[] = ((complaints ?? []) as PlComplaint[]).map((c) => ({
    id: c.id,
    title: c.title,
    body: c.body,
    image_url: c.image_url,
    status: c.status,
    customer_name: (c.customer_id && custName.get(c.customer_id)) || 'No customer',
    order_id: c.order_id,
    order_invoice: (c.order_id && orderInvoice.get(c.order_id)) || null,
    created_at: c.created_at,
  }));

  // Order picker labels (invoice number or short id + customer).
  const orderOptions = orderList.map((o) => ({
    id: o.id,
    name: `${o.invoice_number ?? `Order ${o.id.slice(0, 6)}`}${o.customer_id && custName.get(o.customer_id) ? ` · ${custName.get(o.customer_id)}` : ''}`,
  }));

  return (
    <ComplaintsManager complaints={rows} customers={(customers ?? []) as { id: string; name: string }[]} orders={orderOptions} />
  );
}
