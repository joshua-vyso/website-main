import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import {
  fetchStock,
  fetchNotifications,
  fetchThresholds,
  fetchRecentMovements,
} from '@/lib/platform/procurepulse-queries';
import {
  computeAlerts,
  computeKpis,
  stockByCategory,
  freshnessStatus,
  rand,
  NOTIFICATION_KINDS,
} from '@/lib/platform/procurepulse';
import { AreaChart, DonutChart, KpiCard, LiveChip, PageHead } from '@/components/platform/procurepulse/ui';

/** Friendly labels for the stock-movement reasons (no wastage in ProcurePulse). */
const MOVEMENT_LABEL: Record<string, string> = {
  received: 'Received',
  document_sync: 'Received',
  order_received: 'Order received',
  manual_adjustment: 'Adjusted',
  adjustment: 'Adjusted',
  count_adjustment: 'Count adjustment',
  recipe_reserved: 'Reserved for recipe',
  recipe_consumed: 'Used in recipe',
  used: 'Used',
  reorder: 'Reorder',
  transfer: 'Transfer',
  sale: 'Sold',
};

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function ProcurePulseDashboard() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, notifs, thresholds, movements] = await Promise.all([
    fetchStock(db, orgId),
    fetchNotifications(db, orgId),
    fetchThresholds(db, orgId),
    fetchRecentMovements(db, orgId, 7),
  ]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-[#EAF2FC]">
          <span className="h-[30px] w-[30px] rounded-[7px] bg-[#1F5FA8]" />
        </div>
        <h1 className="of-display mt-4 text-[24px] font-semibold tracking-[-0.015em] text-[#171A17]">Connect ProcurePulse to Doc-U</h1>
        <p className="mt-2 max-w-md text-[14px] text-[#6B6F68]">
          Your live stock builds automatically from the documents you scan in Doc-U — direct
          supplier invoices and Joburg Fresh Produce Market statements.
        </p>
        <Link
          href="/app/docu"
          className="mt-5 inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
        >
          Use my Doc-U documents
        </Link>
      </div>
    );
  }

  const kpis = computeKpis(items);
  const alerts = computeAlerts(items).slice(0, 4);
  const categories = stockByCategory(items);

  // Freshness risk: items whose freshness threshold is configured AND status is
  // aging/expired. Age tracking lands with movements/counts, so this reads 0 until
  // there's age data — the tile is wired and lights up then.
  const freshById = new Map(
    thresholds.filter((t) => t.freshness_value != null).map((t) => [t.stock_item_id, t]),
  );
  const freshnessRisk = items.filter((it) => {
    const t = freshById.get(it.id);
    if (!t) return false;
    return freshnessStatus(null, t.freshness_value) !== 'fresh';
  }).length;

  const series = [0.86, 0.88, 0.84, 0.92, 0.9, 0.95, 0.97, 1].map((m) =>
    Math.round(kpis.stockValue * m),
  );

  const recentNotifs = notifs.slice(0, 5);
  const NOTIF_FALLBACK = { bg: '#EEF1F5', fg: '#6B6F68', label: 'Update' };

  // Stock activity — recent stock MOVEMENTS (the actual stock changes). Document
  // extraction events live in Notifications, not here. Wastage is never shown.
  const itemById = new Map(items.map((i) => [i.id, i]));
  const activityFeed = movements
    .filter((m) => m.reason !== 'waste')
    .map((m) => {
      const it = itemById.get(m.stock_item_id);
      const change = Number(m.change) || 0;
      return {
        id: m.id,
        name: it?.name ?? 'Stock item',
        unit: it?.unit ?? '',
        change,
        label: MOVEMENT_LABEL[m.reason ?? ''] ?? 'Stock change',
        when: timeAgo(m.occurred_at),
      };
    });

  return (
    <div className="space-y-5">
      <PageHead title="ProcurePulse" subtitle="Stock intelligence" right={<LiveChip />} />

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Stock value" value={rand(kpis.stockValue, { compact: true })} />
        <KpiCard label="Items low" value={String(kpis.itemsLow)} accent="#854F0B" />
        <KpiCard label="Out of stock" value={String(kpis.outOfStock)} accent="#A32D2D" />
        <KpiCard label="Freshness risk" value={String(freshnessRisk)} accent={freshnessRisk > 0 ? '#854F0B' : undefined} />
        <KpiCard label="Count variance" value="—" />
      </div>

      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display text-[16px] font-semibold text-[#171A17]">Stock by category</div>
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
          <DonutChart
            segments={categories}
            centerLabel={String(items.length)}
            centerSub={items.length === 1 ? 'product' : 'products'}
          />
          <div className="grid w-full flex-1 grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {categories.map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate text-[13px] text-[#171A17]">{c.label}</span>
                </div>
                <span className="of-num shrink-0 text-[13px] text-[#6B6F68]">
                  {c.value} · {Math.round((c.value / items.length) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="flex items-center justify-between">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Stock value over time</div>
            <div className="of-num text-[13px] font-semibold text-[#0F6E56]">▲ 6.2%</div>
          </div>
          <div className="mt-3">
            <AreaChart data={series} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="of-display text-[16px] font-semibold text-[#171A17]">Needs attention</div>
          <div className="mt-3 space-y-3">
            {alerts.length === 0 ? (
              <p className="text-[13px] text-[#8A8E86]">Everything is well stocked.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#171A17]">{a.item.name}</div>
                    <div className="text-[12px]" style={{ color: a.status === 'out' ? '#A32D2D' : '#854F0B' }}>
                      {a.status === 'out'
                        ? `Out of stock · order ${a.suggested} ${a.item.unit}`
                        : `${a.item.on_hand} ${a.item.unit} left, below ${a.item.low_threshold} · order ${a.suggested}`}
                    </div>
                  </div>
                  <Link
                    href="/app/procurepulse/reorder"
                    className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
                  >
                    Order
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="of-display text-[16px] font-semibold text-[#171A17]">Stock activity</div>
          <div className="mt-3 space-y-3.5">
            {activityFeed.length === 0 ? (
              <p className="text-[13px] text-[#8A8E86]">No stock activity yet.</p>
            ) : (
              activityFeed.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: e.change >= 0 ? '#E1F5EE' : '#FCEBEB' }}
                  >
                    <span
                      className="h-[15px] w-[15px] rounded-[3px]"
                      style={{ backgroundColor: e.change >= 0 ? '#0F6E56' : '#A32D2D' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#171A17]">{e.name}</div>
                    <div className="text-[12px] text-[#8A8E86]">
                      {e.label}
                      {e.when ? ` · ${e.when}` : ''}
                    </div>
                  </div>
                  <div
                    className="of-num shrink-0 text-[13px] font-semibold"
                    style={{ color: e.change >= 0 ? '#0F6E56' : '#A32D2D' }}
                  >
                    {e.change >= 0 ? '+' : ''}
                    {fmtQty(e.change)} {e.unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="flex items-center justify-between">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Notifications</div>
            <Link
              href="/app/procurepulse/notifications"
              className="text-[13px] font-semibold text-[#1F5FA8] hover:underline"
            >
              Show all
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {recentNotifs.length === 0 ? (
              <p className="text-[13px] text-[#8A8E86]">No notifications yet.</p>
            ) : (
              recentNotifs.map((n) => {
                const k = NOTIFICATION_KINDS[n.kind] ?? NOTIF_FALLBACK;
                return (
                  <div key={n.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: k.bg }}>
                      <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: k.fg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[#171A17]">{n.title}</div>
                      {n.body ? <div className="truncate text-[12px] text-[#8A8E86]">{n.body}</div> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
