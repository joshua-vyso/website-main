import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock } from '@/lib/platform/procurepulse-queries';
import { computeAlerts } from '@/lib/platform/procurepulse';
import { LiveChip, PageHead } from '@/components/platform/procurepulse/ui';
import { AddStockButton } from '@/components/platform/procurepulse/AddStockButton';
import {
  LiveStockView,
  type RecentActivity,
} from '@/components/platform/procurepulse/LiveStockView';

export default async function ProcurePulseStockList() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const items = await fetchStock(db, orgId);
  const lowCount = computeAlerts(items).length;

  // Recent activity — the most recent quantity that moved per product, pulled
  // from OrderFlow order lines (newest first; first hit per item wins). Tolerant
  // of the OrderFlow tables not existing yet (data → null → empty map).
  const { data: lines } = await db
    .from('of_order_items')
    .select('stock_item_id, qty, unit, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  const recent: RecentActivity = {};
  for (const l of (lines ?? []) as {
    stock_item_id: string | null;
    qty: number;
    unit: string | null;
  }[]) {
    if (!l.stock_item_id || recent[l.stock_item_id]) continue;
    recent[l.stock_item_id] = { qty: Number(l.qty) || 0, unit: l.unit };
  }

  return (
    <div>
      <PageHead
        title="Live stock"
        subtitle="Real-time levels built from your Doc-U documents"
        right={
          <>
            <LiveChip />
            <AddStockButton />
          </>
        }
      />

      <LiveStockView items={items} recent={recent} lowCount={lowCount} />
    </div>
  );
}
