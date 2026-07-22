import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getOrderDetail } from '@/lib/platform/orderflow-data';
import { OrderDetail } from '@/components/platform/orderflow/OrderDetail';

export default async function OrderDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const data = orgId ? await getOrderDetail(orgId, id) : null;

  if (!data?.order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#171A17]">Order not found</h1>
          <p className="mt-2 text-[13px] text-[#6B6F68]">It may have been deleted, or you may not have access.</p>
          <Link href="/app/orderflow/orders" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white hover:bg-[#174C87]">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OrderDetail
      order={data.order}
      items={data.items}
      customer={data.customer}
      invoice={data.invoice}
      invoiceItems={data.invoiceItems}
      invoicePayments={data.invoicePayments}
      deliveryNotes={data.deliveryNotes}
      documents={data.documents}
      activity={data.activity}
      settings={data.settings}
    />
  );
}
