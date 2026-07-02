import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { OrdersView, type OrderRow, type OrderItemLite } from '@/components/platform/orderflow/OrdersView';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { orderTotal, DEFAULT_OF_SETTINGS, type OfOrder, type OfCustomer, type OfSettings } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; name: string; qty: number; unit: string | null; unit_price: number };

export default async function OrderFlowOrdersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }, { data: products }, { data: ppSettings }, { data: ofSettings }] =
    await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
      db.from('of_order_items').select('order_id, stock_item_id, name, qty, unit, unit_price').eq('org_id', orgId),
      db.from('of_customers').select('*').eq('org_id', orgId).order('name', { ascending: true }),
      db.from('pp_stock_items').select('id, name, unit, avg_unit_price').eq('org_id', orgId).order('name').limit(2000),
      // Org units (workspace-managed) feed the line-item unit dropdown. Tolerant of pp_settings missing.
      db.from('pp_settings').select('custom_units').eq('org_id', orgId).maybeSingle(),
      db.from('of_settings').select('*').eq('org_id', orgId).maybeSingle(),
    ]);
  const orgUnits = allUnits((ppSettings as { custom_units?: string[] | null } | null)?.custom_units);
  const settings = (ofSettings as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId };

  // Group line items per order — used for totals, the detail drawer, search and
  // the real generate-invoice / delivery-note actions (they need stock_item_id).
  const itemsByOrder: Record<string, OrderItemLite[]> = {};
  for (const it of (items ?? []) as ItemRow[]) {
    (itemsByOrder[it.order_id] ??= []).push({
      stock_item_id: it.stock_item_id ?? null,
      name: it.name,
      qty: Number(it.qty) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
    });
  }
  const customerRows = (customers ?? []) as OfCustomer[];
  const custName = new Map(customerRows.map((c) => [c.id, c.name]));

  const rows: OrderRow[] = ((orders ?? []) as OfOrder[]).map((o) => {
    const its = itemsByOrder[o.id] ?? [];
    return {
      id: o.id,
      customer_id: o.customer_id,
      customer_name: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
      status: o.status,
      order_number: o.order_number ?? null,
      invoice_number: o.invoice_number,
      invoice_id: o.invoice_id ?? null,
      delivery_date: o.delivery_date ?? null,
      delivery_address: o.delivery_address ?? null,
      delivery_instructions: o.delivery_instructions ?? null,
      customer_po: o.customer_po ?? null,
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
      customers={customerRows}
      products={(products ?? []) as { id: string; name: string; unit: string | null; avg_unit_price: number | null }[]}
      settings={settings}
      orgUnits={orgUnits}
    />
  );
}
