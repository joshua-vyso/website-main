import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock } from '@/lib/platform/procurepulse-queries';
import { computeAlerts, stockStatus, rand } from '@/lib/platform/procurepulse';
import {
  LiveChip,
  PageHead,
  PpButton,
  StockStatusPill,
  TrendText,
} from '@/components/platform/procurepulse/ui';
import { AddStockButton } from '@/components/platform/procurepulse/AddStockButton';

export default async function ProcurePulseStockList() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const items = await fetchStock(db, orgId);

  const lowCount = computeAlerts(items).length;

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

      <div className="mt-4 mb-4 flex items-center gap-2">
        <div className="w-[280px] rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-[13px] text-[#9A9DA1]">
          Search products
        </div>
        <span className="rounded-full bg-[#1A1C1E] px-3 py-1.5 text-[12px] text-white">All</span>
        <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
          Low
        </span>
        <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
          Out
        </span>
        <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
          Supplier
        </span>
        <span className="rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px] text-[#5F6368]">
          Category
        </span>
        <div className="flex-1" />
        <PpButton href="/app/procurepulse/reorder">Reorder low · {lowCount}</PpButton>
      </div>

      <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
        <div className="flex items-center border-b border-[#E7E7E2] pb-2.5 text-[12px] font-medium text-[#9A9DA1]">
          <div className="flex-1">Product</div>
          <div className="w-[120px]">Pack</div>
          <div className="w-[110px]">Category</div>
          <div className="w-[110px] text-right">On hand</div>
          <div className="w-[90px]">Status</div>
          <div className="w-[90px] text-right">Trend</div>
          <div className="w-[100px] text-right">Avg price</div>
          <div className="w-[150px]">Cheapest</div>
          <div className="w-[110px]">Updated</div>
        </div>

        {items.map((item) => (
          <Link
            key={item.id}
            href={`/app/procurepulse/stock/${item.id}`}
            className="flex items-center border-t border-[#EFEFEC] py-3.5 text-[13px] text-[#1A1C1E] hover:bg-black/[0.02]"
          >
            <div className="flex-1 font-medium">{item.name}</div>
            <div className="w-[120px] text-[#5F6368]">{item.pack ?? '—'}</div>
            <div className="w-[110px] text-[#5F6368]">{item.category ?? '—'}</div>
            <div className="w-[110px] text-right">
              {item.on_hand} {item.unit}
            </div>
            <div className="w-[90px]">
              <StockStatusPill status={stockStatus(item)} />
            </div>
            <div className="w-[90px] text-right">
              <TrendText pct={item.trend_pct} />
            </div>
            <div className="w-[100px] text-right">{rand(item.avg_unit_price)}</div>
            <div className="w-[150px] text-[#5F6368]">{item.cheapest_supplier ?? '—'}</div>
            <div className="w-[110px] text-[#9A9DA1]">2m ago</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
