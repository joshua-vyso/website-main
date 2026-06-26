import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import {
  fetchStock,
  fetchPrices,
  fetchReorderRequests,
  fetchStockOrders,
} from '@/lib/platform/procurepulse-queries';
import { buildDraftOrder } from '@/lib/platform/procurepulse';
import { PageHead } from '@/components/platform/procurepulse/ui';
import { ReorderView } from '@/components/platform/procurepulse/ReorderView';

export default async function ProcurePulseReorder() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, prices, manual, orders] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
    fetchReorderRequests(db, orgId, 'open'),
    fetchStockOrders(db, orgId),
  ]);

  const order = buildDraftOrder(items, prices);
  const pickerItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    cheapest_supplier: i.cheapest_supplier,
  }));

  return (
    <div>
      <PageHead
        title="Stock orders"
        subtitle="What to order — suggested from low stock, plus your own requests. Send to your team."
      />
      <ReorderView order={order} manual={manual} items={pickerItems} orders={orders} />
    </div>
  );
}
