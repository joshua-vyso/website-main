import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import {
  fetchStockItem,
  fetchPricesForItem,
  fetchMovements,
} from '@/lib/platform/procurepulse-queries';
import { stockStatus, suggestedReorder, rand } from '@/lib/platform/procurepulse';
import {
  AreaChart,
  LevelBar,
  PpButton,
  Sparkline,
  StockStatusPill,
} from '@/components/platform/procurepulse/ui';

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const { id } = await params;

  const item = await fetchStockItem(db, id);

  if (!item) {
    return (
      <div className="space-y-4">
        <Link href="/app/procurepulse/stock" className="text-[13px] text-[#5F6368]">
          ‹&nbsp;&nbsp;Live stock
        </Link>
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[14px] font-medium text-[#1A1C1E]">Item not found</div>
          <p className="mt-1 text-[13px] text-[#9A9DA1]">
            This stock line may have been removed or is not part of your organisation.
          </p>
        </div>
      </div>
    );
  }

  const [prices, moves] = await Promise.all([
    fetchPricesForItem(db, id),
    fetchMovements(db, id),
  ]);

  const status = stockStatus(item);
  const suggested = suggestedReorder(item);
  const cheapestPrice = prices[0]?.price ?? item.avg_unit_price ?? 0;
  const cheapestSupplier = prices[0]?.supplier_name ?? item.cheapest_supplier ?? '—';

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });

  return (
    <div>
      <Link href="/app/procurepulse/stock" className="text-[13px] text-[#5F6368]">
        ‹&nbsp;&nbsp;Live stock
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold text-[#1A1C1E]">{item.name}</h1>
            <StockStatusPill status={status} />
          </div>
          <p className="mt-1 text-[14px] text-[#9A9DA1]">
            {[item.pack, item.category].filter(Boolean).join(' · ') || item.unit}
          </p>
        </div>
        <div className="shrink-0">
          <PpButton href="/app/procurepulse/reorder">
            Reorder · {suggested} {item.unit}
          </PpButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Level card */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="text-[30px] font-bold text-[#1A1C1E]">{item.on_hand}</span>
                <span className="ml-1.5 text-[14px] text-[#9A9DA1]">{item.unit} on hand</span>
              </div>
              <div className="text-[13px] text-[#854F0B]">
                Low-stock threshold: {item.low_threshold} {item.unit}
              </div>
            </div>
            <div className="mt-3.5">
              <LevelBar value={item.on_hand} threshold={item.low_threshold} status={status} />
            </div>
          </div>

          {/* Stock level chart */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[14px] font-medium text-[#1A1C1E]">
              Stock level · last 30 days
            </div>
            <div className="mt-3">
              <AreaChart
                data={item.stock_history ?? [item.on_hand]}
                color="#BA7517"
                fill="#FBEEDA"
              />
            </div>
          </div>

          {/* Movement history */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[14px] font-medium text-[#1A1C1E]">Movement history</div>
            <div className="mt-2">
              {moves.length === 0 ? (
                <p className="py-3 text-[13px] text-[#9A9DA1]">No movements recorded yet.</p>
              ) : (
                moves.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between gap-3 py-3.5 ${
                      i === 0 ? '' : 'border-t border-[#EFEFEC]'
                    }`}
                  >
                    <div className="min-w-0 text-[13px] text-[#5F6368]">
                      {[fmtDate(m.occurred_at), m.reason, m.source_label]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    <div
                      className="shrink-0 text-[13px] font-medium"
                      style={{ color: m.change > 0 ? '#0F6E56' : '#5F6368' }}
                    >
                      {m.change > 0 ? '+' : ''}
                      {m.change}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* At a glance */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[14px] font-medium text-[#1A1C1E]">At a glance</div>
            <div className="mt-2">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-[#9A9DA1]">On hand</span>
                <span className="text-[13px] font-medium text-[#1A1C1E]">
                  {item.on_hand} {item.unit}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#EFEFEC] py-2.5">
                <span className="text-[13px] text-[#9A9DA1]">Avg unit price</span>
                <span className="text-[13px] font-medium text-[#1A1C1E]">
                  {rand(item.avg_unit_price)} / {item.unit}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#EFEFEC] py-2.5">
                <span className="text-[13px] text-[#9A9DA1]">Reorder point</span>
                <span className="text-[13px] font-medium text-[#1A1C1E]">
                  {item.low_threshold} {item.unit}
                </span>
              </div>
            </div>
            {item.price_history && item.price_history.length > 0 ? (
              <div className="mt-3 border-t border-[#EFEFEC] pt-3">
                <div className="text-[12px] text-[#9A9DA1]">Avg price trend</div>
                <div className="mt-1.5">
                  <Sparkline data={item.price_history} />
                </div>
              </div>
            ) : null}
          </div>

          {/* Suppliers */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[14px] font-medium text-[#1A1C1E]">Suppliers</div>
            <div className="mt-2">
              {prices.length === 0 ? (
                <p className="py-3 text-[13px] text-[#9A9DA1]">No supplier prices yet.</p>
              ) : (
                prices.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 py-3 ${
                      i === 0 ? '' : 'border-t border-[#EFEFEC]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-[#1A1C1E]">
                        {p.supplier_name}
                      </span>
                      {i === 0 ? (
                        <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] text-[#0F6E56]">
                          Cheapest
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[13px] font-medium text-[#1A1C1E]">
                      {rand(p.price)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reorder panel */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="text-[13px] text-[#9A9DA1]">Suggested reorder</div>
            <div className="mt-1 text-[26px] font-bold text-[#1A1C1E]">
              {suggested} {item.unit}
            </div>
            <div className="mt-1 text-[13px] text-[#5F6368]">
              ≈ {rand(suggested * cheapestPrice)} · {cheapestSupplier}
            </div>
            <Link
              href="/app/procurepulse/reorder"
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#1F5FA8] px-4 py-2.5 text-[14px] font-medium text-white"
            >
              Add to order
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
