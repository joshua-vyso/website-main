import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchPrices } from '@/lib/platform/procurepulse-queries';
import { computeAlerts, rand } from '@/lib/platform/procurepulse';
import {
  LiveChip,
  PageHead,
  PpButton,
  StockStatusPill,
} from '@/components/platform/procurepulse/ui';
import { AlertRowActions } from '@/components/platform/procurepulse/AlertRowActions';
import type { ItemSupplierPrice } from '@/lib/platform/types';

export default async function ProcurePulseAlerts() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, prices] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
  ]);

  const alerts = computeAlerts(items);

  // Cheapest supplier price per stock item.
  const cheapestByItem = new Map<string, ItemSupplierPrice>();
  for (const p of prices) {
    const current = cheapestByItem.get(p.stock_item_id);
    if (!current || p.price < current.price) cheapestByItem.set(p.stock_item_id, p);
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Low-stock alerts"
        subtitle={`${alerts.length} products below threshold · sorted by severity`}
        right={
          <>
            <LiveChip label="Live" />
            <PpButton href="/app/procurepulse/reorder">Reorder all · {alerts.length}</PpButton>
          </>
        }
      />

      <div className="rounded-2xl border border-[#E7E7E2] bg-white px-4 py-1">
        {/* Header row */}
        <div className="flex items-center gap-3 border-b border-[#E7E7E2] py-3 text-[12px] font-medium text-[#9A9DA1]">
          <div className="flex-1">Product</div>
          <div className="w-[110px]">Pack</div>
          <div className="w-[90px]">Severity</div>
          <div className="w-[80px] text-right">On hand</div>
          <div className="w-[90px] text-right">Threshold</div>
          <div className="w-[110px] text-right">Suggested</div>
          <div className="w-[170px]">Best supplier</div>
          <div className="w-[170px]">Actions</div>
        </div>

        {alerts.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#9A9DA1]">
            Everything is above threshold — no alerts right now.
          </div>
        ) : (
          alerts.map((a) => {
            const cheapest = cheapestByItem.get(a.item.id);
            return (
              <div
                key={a.item.id}
                className="flex items-center gap-3 border-t border-[#EFEFEC] py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[#1A1C1E]">
                    {a.item.name}
                  </div>
                </div>
                <div className="w-[110px] truncate text-[13px] text-[#5F6368]">{a.item.pack}</div>
                <div className="w-[90px]">
                  <StockStatusPill status={a.status} />
                </div>
                <div className="w-[80px] text-right text-[13px] text-[#1A1C1E]">
                  {a.item.on_hand}
                </div>
                <div className="w-[90px] text-right text-[13px] text-[#5F6368]">
                  {a.item.low_threshold}
                </div>
                <div className="w-[110px] text-right text-[13px] font-medium text-[#1A1C1E]">
                  {a.suggested} {a.item.unit}
                </div>
                <div className="w-[170px] min-w-0 text-[13px] text-[#5F6368]">
                  {cheapest ? (
                    <span className="block truncate">
                      {cheapest.supplier_name} · {rand(cheapest.price)}
                    </span>
                  ) : (
                    <span className="text-[#9A9DA1]">No quote</span>
                  )}
                </div>
                <div className="w-[170px]">
                  <AlertRowActions
                    stockItemId={a.item.id}
                    productName={a.item.name}
                    qty={a.suggested}
                    unit={a.item.unit}
                    supplier={cheapest?.supplier_name ?? null}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
