import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { OrderDetail } from '@/components/platform/orderflow/OrderDetail';
import type { OfOrder, OfOrderItem } from '@/lib/platform/orderflow';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orderRow }, { data: itemRows }, { data: invoiced }] = await Promise.all([
    db.from('of_orders').select('*').eq('id', id).maybeSingle(),
    db.from('of_order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    db.from('of_orders').select('invoice_number').eq('org_id', orgId).not('invoice_number', 'is', null),
  ]);

  const order = orderRow as OfOrder | null;
  if (!order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Order not found</h1>
          <Link href="/app/orderflow/orders" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#1A1C1E] px-4 text-[13px] font-medium text-white">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  let customerName = 'No customer';
  if (order.customer_id) {
    const { data: cust } = await db.from('of_customers').select('name').eq('id', order.customer_id).maybeSingle();
    customerName = (cust as { name?: string } | null)?.name ?? 'No customer';
  }

  const nextSeq = ((invoiced ?? []) as { invoice_number: string | null }[]).length + 1;

  return (
    <OrderDetail order={order} customerName={customerName} items={(itemRows ?? []) as OfOrderItem[]} nextSeq={nextSeq} />
  );
}
