import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchPrices, fetchReorderRequests } from '@/lib/platform/procurepulse-queries';
import { buildDraftOrder } from '@/lib/platform/procurepulse';
import { PageHead } from '@/components/platform/procurepulse/ui';
import { ReorderView } from '@/components/platform/procurepulse/ReorderView';

export default async function ProcurePulseReorder() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, prices, manual] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
    fetchReorderRequests(db, orgId, 'open'),
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
        title="Reordering"
        subtitle="What to order from suppliers — suggested from low stock, plus your own requests"
      />
      <ReorderView order={order} manual={manual} items={pickerItems} />
    </div>
  );
}
