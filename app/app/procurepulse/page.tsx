import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchNotifications } from '@/lib/platform/procurepulse-queries';
import { computeAlerts, computeKpis, rand, NOTIFICATION_KINDS } from '@/lib/platform/procurepulse';
import {
  AreaChart,
  DocBadge,
  KpiCard,
  LiveChip,
  PageHead,
} from '@/components/platform/procurepulse/ui';

export default async function ProcurePulseDashboard() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, notifs] = await Promise.all([
    fetchStock(db, orgId),
    fetchNotifications(db, orgId),
  ]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-[#E3F0ED]">
          <span className="h-[30px] w-[30px] rounded-[7px] bg-[#1E5E54]" />
        </div>
        <h1 className="mt-4 text-[24px] font-bold text-[#1A1C1E]">Connect ProcurePulse to Doc-U</h1>
        <p className="mt-2 max-w-md text-[14px] text-[#5F6368]">
          Your live stock builds automatically from the documents you scan in Doc-U — direct
          supplier invoices and Joburg Fresh Produce Market statements.
        </p>
        <Link
          href="/app/docu"
          className="mt-5 inline-flex items-center rounded-lg bg-[#1E5E54] px-5 py-3 text-[15px] font-medium text-white"
        >
          Use my Doc-U documents
        </Link>
      </div>
    );
  }

  const kpis = computeKpis(items);
  const alerts = computeAlerts(items).slice(0, 3);
  const series = [0.86, 0.88, 0.84, 0.92, 0.9, 0.95, 0.97, 1].map((m) =>
    Math.round(kpis.stockValue * m),
  );
  const docNotifs = notifs
    .filter((n) => n.kind === 'new_direct_doc' || n.kind === 'new_market_statement')
    .slice(0, 2);
  const recentNotifs = notifs.slice(0, 5);
  const NOTIF_FALLBACK = { bg: '#F0F0EC', fg: '#5F6368', label: 'Update' };

  return (
    <div className="space-y-5">
      <PageHead title="ProcurePulse" subtitle="Procurement intelligence" right={<LiveChip />} />

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <KpiCard label="Stock value" value={rand(kpis.stockValue, { compact: true })} />
        <KpiCard label="Items low" value={String(kpis.itemsLow)} accent="#854F0B" />
        <KpiCard label="Out of stock" value={String(kpis.outOfStock)} accent="#A32D2D" />
        <KpiCard label="Spend this week" value={rand(kpis.spendWeek, { compact: true })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-medium text-[#1A1C1E]">Stock value over time</div>
            <div className="text-[13px] font-medium text-[#0F6E56]">▲ 6.2%</div>
          </div>
          <div className="mt-3">
            <AreaChart data={series} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[14px] font-medium text-[#1A1C1E]">Needs attention</div>
          <div className="mt-3 space-y-3.5">
            {alerts.map((a) => (
              <div key={a.item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#1A1C1E]">{a.item.name}</div>
                  <div
                    className="text-[12px]"
                    style={{ color: a.status === 'out' ? '#A32D2D' : '#854F0B' }}
                  >
                    {a.status === 'out'
                      ? 'Out of stock'
                      : `${a.item.on_hand} ${a.item.unit} left · below ${a.item.low_threshold}`}
                  </div>
                </div>
                <Link
                  href="/app/procurepulse/reorder"
                  className="shrink-0 rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white"
                >
                  Reorder
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[14px] font-medium text-[#1A1C1E]">Recent documents</div>
          <div className="mt-3 space-y-3.5">
            {docNotifs.length === 0 ? (
              <p className="text-[13px] text-[#9A9DA1]">No documents have fed stock yet.</p>
            ) : (
              docNotifs.map((n) => (
                <div key={n.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E3F0ED]">
                    <span className="h-[15px] w-[15px] rounded-[3px] bg-[#1E5E54]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[#1A1C1E]">{n.title}</div>
                    <div className="text-[12px] text-[#9A9DA1]">{n.body}</div>
                  </div>
                  <DocBadge />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-medium text-[#1A1C1E]">Notifications</div>
            <Link
              href="/app/procurepulse/notifications"
              className="text-[12px] font-medium text-[#1E5E54] hover:underline"
            >
              Show all
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {recentNotifs.length === 0 ? (
              <p className="text-[13px] text-[#9A9DA1]">No notifications yet.</p>
            ) : (
              recentNotifs.map((n) => {
                const k = NOTIFICATION_KINDS[n.kind] ?? NOTIF_FALLBACK;
                return (
                  <div key={n.id} className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: k.bg }}
                    >
                      <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: k.fg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{n.title}</div>
                      {n.body ? <div className="truncate text-[12px] text-[#9A9DA1]">{n.body}</div> : null}
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
