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

      <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-1 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        {/* Header row */}
        <div className="flex items-center gap-3 border-b border-[#EEF1F5] py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
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
          <div className="py-12 text-center text-[14px] text-[#8A8E86]">
            Everything is above threshold — no alerts right now.
          </div>
        ) : (
          alerts.map((a) => {
            const cheapest = cheapestByItem.get(a.item.id);
            return (
              <div
                key={a.item.id}
                className="flex items-center gap-3 border-t border-[#F4F5F7] py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[#171A17]">
                    {a.item.name}
                  </div>
                </div>
                <div className="w-[110px] truncate text-[14px] text-[#2C333B]">{a.item.pack}</div>
                <div className="w-[90px]">
                  <StockStatusPill status={a.status} />
                </div>
                <div className="of-num w-[80px] text-right text-[14px] text-[#171A17]">
                  {a.item.on_hand}
                </div>
                <div className="of-num w-[90px] text-right text-[14px] text-[#6B6F68]">
                  {a.item.low_threshold}
                </div>
                <div className="of-num w-[110px] text-right text-[14px] font-semibold text-[#171A17]">
                  {a.suggested} {a.item.unit}
                </div>
                <div className="w-[170px] min-w-0 text-[13px] text-[#6B6F68]">
                  {cheapest ? (
                    <span className="block truncate">
                      {cheapest.supplier_name} · {rand(cheapest.price)}
                    </span>
                  ) : (
                    <span className="text-[#A0A49C]">No quote</span>
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
