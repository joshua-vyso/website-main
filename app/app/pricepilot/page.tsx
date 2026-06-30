import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { KpiCard, LiveChip } from '@/components/platform/procurepulse/ui';
import { ScoreRing, MarginBars, Panel, MarginTrendCard, type TrendSeries } from '@/components/platform/pricepilot/ui';
import { ProfitSnapshot, type BreakdownOrder } from '@/components/platform/pricepilot/ProfitSnapshot';
import { NotificationList } from '@/components/platform/pricepilot/NotificationList';
import {
  zar,
  pickBaseList,
  productMargins,
  marginDistribution,
  avgCatalogueMargin,
  pricingHealth,
  healthBand,
  computeOpportunities,
  pricingInsight,
  marginPctForLines,
  priceListValidity,
  computeNotifications,
  DEFAULT_TARGET_MARGIN,
  PRIORITY_STYLE,
  type PlPriceList,
  type PlOverride,
  type PlTargets,
  type PriceItemLite,
  type SaleLine,
} from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number; unit_price: number };

export default async function PricePilotDashboardPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [
    { data: items },
    { data: lists },
    { data: overrides },
    { data: orders },
    { data: orderItems },
    { data: targetsRow },
    { data: customers },
  ] = await Promise.all([
    db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).limit(5000),
    db.from('pl_price_lists').select('*').eq('org_id', orgId),
    db.from('pl_overrides').select('*').eq('org_id', orgId),
    db
      .from('of_orders')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['invoiced', 'paid'])
      .order('created_at', { ascending: false }),
    db.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
    db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    db.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);

  const priceLists = (lists ?? []) as PlPriceList[];
  const priceItems = (items ?? []) as PriceItemLite[];
  const targets = (targetsRow ?? null) as PlTargets | null;
  const sales = (orders ?? []) as OfOrder[];
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // ---- Catalogue margins (drive distribution, below-target, opportunities) ----
  const base = pickBaseList(priceLists);
  const pms = productMargins(priceItems, base, (overrides ?? []) as PlOverride[]);
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;
  const bands = marginDistribution(pms);
  const avgMargin = avgCatalogueMargin(pms);
  const belowTarget = pms.filter((p) => p.marginPct < target);
  const atOrAbove = pms.length - belowTarget.length;

  // ---- Realized sales (revenue / gross profit / margin trend) ----
  const costByItem = new Map(priceItems.map((it) => [it.id, it.avg_unit_price != null ? Number(it.avg_unit_price) : null]));
  const orderTs = new Map(sales.map((o) => [o.id, new Date(o.created_at).getTime()]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  // Opportunity impact uses a rolling 30-day window so it matches the Products /
  // Recommendations pages (which also use 30d); revenue/GP below stay month-to-date.
  const oppSince = now.getTime() - 30 * 86_400_000;

  const allLines: (SaleLine & { ts: number })[] = [];
  const orderAgg = new Map<string, { rev: number; costableRev: number; cost: number }>();
  const monthlyUnitsByItem = new Map<string, number>();
  for (const it of (orderItems ?? []) as ItemRow[]) {
    const ts = orderTs.get(it.order_id);
    if (ts == null) continue; // only realized (invoiced/paid) orders
    const qty = Number(it.qty) || 0;
    const revenue = qty * (Number(it.unit_price) || 0);
    const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
    const cost = unitCost != null ? qty * unitCost : null;
    allLines.push({ ts, revenue, cost });
    const a = orderAgg.get(it.order_id) ?? { rev: 0, costableRev: 0, cost: 0 };
    a.rev += revenue;
    if (cost != null) {
      a.costableRev += revenue;
      a.cost += cost;
    }
    orderAgg.set(it.order_id, a);
    if (ts >= oppSince && it.stock_item_id) {
      monthlyUnitsByItem.set(it.stock_item_id, (monthlyUnitsByItem.get(it.stock_item_id) ?? 0) + qty);
    }
  }

  // Per-order profit breakdown for this month (powers the expandable snapshot tiles).
  // Only orders with line activity (orderAgg) — keeps the row list and count aligned
  // with the line-level tile totals (no phantom zero-line orders).
  const monthOrders: BreakdownOrder[] = sales
    .filter((o) => (orderTs.get(o.id) ?? 0) >= monthStart && orderAgg.has(o.id))
    .map((o) => {
      const a = orderAgg.get(o.id)!;
      const profit = a.costableRev - a.cost;
      return {
        id: o.id,
        invoice: o.invoice_number ?? 'Invoice',
        customer: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
        date: o.created_at,
        revenue: a.rev, // full invoice revenue (Revenue tile reconciles to this)
        costableRev: a.costableRev, // revenue of costed lines (cost/profit/margin reconcile to this)
        cost: a.cost,
        profit,
        margin: a.costableRev > 0 ? (profit / a.costableRev) * 100 : null,
        uncosted: a.rev - a.costableRev > 0.005,
      };
    });

  const monthLines = allLines.filter((l) => l.ts >= monthStart);
  const revenueThisMonth = monthLines.reduce((s, l) => s + l.revenue, 0);
  const costableRev = monthLines.filter((l) => l.cost != null).reduce((s, l) => s + l.revenue, 0);
  const costableCost = monthLines.filter((l) => l.cost != null).reduce((s, l) => s + (l.cost ?? 0), 0);
  const grossProfit = costableRev - costableCost;
  const realizedMargin = marginPctForLines(monthLines);
  const opex = targets?.monthly_opex != null ? Number(targets.monthly_opex) : null;
  const netProfit = opex != null ? grossProfit - opex : null;

  // ---- Opportunities ----
  const opportunities = computeOpportunities(pms, target, monthlyUnitsByItem);
  const marginOpportunity = opportunities.reduce((s, o) => s + o.monthlyImpact, 0);
  const revenueAtRisk = opportunities.reduce((s, o) => s + o.monthlyUnits * o.currentSell, 0);

  // ---- Notifications (alerts strip) ----
  const expiringContracts = priceLists
    .filter((l) => l.customer_id)
    .map((l) => ({ list: l, v: priceListValidity(l) }))
    .filter(({ v }) => v.status === 'expiring' || v.status === 'expired')
    .map(({ list, v }) => ({
      customer: (list.customer_id && custName.get(list.customer_id)) || 'Customer',
      listName: list.name,
      listId: list.id,
      label: v.label,
      expired: v.status === 'expired',
    }));
  const notifications = computeNotifications({
    expiringContracts,
    belowTargetCount: belowTarget.length,
    marginOpportunity,
    target,
    costSpikes: [], // cost-spike signals live on the full Notifications page
  });

  // ---- Health + insight ----
  const health = pricingHealth({
    hasBaseList: !!base,
    productCount: pms.length,
    avgMargin,
    belowTargetCount: belowTarget.length,
    target,
    hasSalesThisMonth: revenueThisMonth > 0,
  });
  const band = healthBand(health);
  const insight = pricingInsight({
    hasBaseList: !!base,
    productCount: pms.length,
    belowTargetCount: belowTarget.length,
    target,
    monthlyOpportunity: marginOpportunity,
    avgMargin,
    revenueThisMonth,
    revenueTarget: targets?.monthly_revenue_target != null ? Number(targets.monthly_revenue_target) : null,
  });

  // ---- Margin trend series (carry-forward over empty buckets) ----
  const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  const fmtMonth = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('en-ZA', { month: 'short' });
  const DAY = 86_400_000;
  const nowTs = now.getTime();
  const seriesFor = (ranges: { start: number; end: number; label: string }[]) => {
    let last = 0;
    let hasData = false;
    const points: number[] = [];
    const labels: string[] = [];
    for (const r of ranges) {
      const m = marginPctForLines(allLines.filter((l) => l.ts >= r.start && l.ts < r.end));
      if (m != null) hasData = true;
      const v = m == null ? last : m; // carry forward over empty buckets; allow real losses to dip negative
      last = v;
      points.push(Math.round(v));
      labels.push(r.label);
    }
    return { points, labels, hasData };
  };
  const weeklyRanges = Array.from({ length: 8 }, (_, i) => {
    const start = nowTs - (8 - i) * 7 * DAY; // 8 rolling 7-day windows ending now
    return { start, end: start + 7 * DAY, label: fmtDay(start) };
  });
  const monthlyRanges = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: d.getTime(), end: end.getTime(), label: fmtMonth(d.getFullYear(), d.getMonth()) };
  });
  const q = Math.floor(now.getMonth() / 3);
  const quarterlyRanges = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), (q - (3 - i)) * 3, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 3, 1);
    return { start: d.getTime(), end: end.getTime(), label: `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}` };
  });
  const yearlyRanges = Array.from({ length: 3 }, (_, i) => {
    const y = now.getFullYear() - (2 - i);
    return { start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime(), label: String(y) };
  });
  const trendSeries: TrendSeries = {
    weekly: seriesFor(weeklyRanges),
    monthly: seriesFor(monthlyRanges),
    quarterly: seriesFor(quarterlyRanges),
    yearly: seriesFor(yearlyRanges),
  };

  const recent = sales.slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">PricePilot</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Your pricing intelligence — margins, profitability and opportunities</p>
        </div>
        <LiveChip label="Live pricing" />
      </div>

      {!targets ? (
        <Link
          href="/app/marginview/goals"
          className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#FBEEDA] bg-[#FFFBF4] px-5 py-3.5 transition-colors hover:border-[#EFD9AE]"
        >
          <span className="text-[13px] text-[#7A6A4F]">
            <span className="font-semibold text-[#854F0B]">Set your goals in PlanWise</span> to unlock profit tracking,
            health scoring and tailored opportunities.
          </span>
          <span className="text-[13px] font-medium text-[#854F0B]">Open PlanWise → Goals →</span>
        </Link>
      ) : null}

      {notifications.length > 0 ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Alerts</h2>
            <Link href="/app/pricepilot/notifications" className="text-[12px] font-medium text-[#1E5E54] hover:underline">
              View all ({notifications.length}) →
            </Link>
          </div>
          <NotificationList items={notifications.slice(0, 3)} compact />
        </div>
      ) : null}

      {/* Hero — pricing health + AI insight */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E7E2] bg-white p-6 text-center">
          <span className="text-[13px] font-medium text-[#9A9DA1]">Pricing health</span>
          <div className="mt-3">
            <ScoreRing score={health} color={band.color} label={band.label} />
          </div>
          <p className="mt-4 text-[13px] text-[#5F6368]">
            {pms.length > 0 ? (
              <>
                <span className="font-semibold text-[#1A1C1E]">{atOrAbove}</span> of {pms.length} products at or above your{' '}
                {Math.round(target)}% target
              </>
            ) : (
              'No catalogue pricing yet'
            )}
          </p>
        </div>

        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-[#E7E7E2] bg-gradient-to-br from-white to-[#F6FAF8] p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E3F0ED] text-[14px] text-[#1E5E54]">
              ✦
            </span>
            <span className="text-[13px] font-semibold text-[#1E5E54]">AI insight</span>
          </div>
          <p className="mt-3 text-[18px] font-medium leading-relaxed text-[#1A1C1E]">{insight}</p>
          <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-5">
            <InsightChip label="Avg margin" value={`${Math.round(avgMargin)}%`} />
            <InsightChip label="Below target" value={String(belowTarget.length)} />
            <InsightChip label="Opportunity" value={`${zar(marginOpportunity)}/mo`} />
            <Link
              href="/app/pricepilot/recommendations"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45]"
            >
              Review pricing →
            </Link>
          </div>
        </div>
      </div>

      {/* Revenue & profit snapshot — tiles expand to the per-order breakdown */}
      <div className="mt-8 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Revenue &amp; profit · this month</h2>
        <span className="text-[12px] text-[#9A9DA1]">— tap a tile for the breakdown</span>
      </div>
      <div className="mt-3">
        <ProfitSnapshot
          revenue={revenueThisMonth}
          grossProfit={grossProfit}
          realizedMargin={realizedMargin}
          netProfit={netProfit}
          opex={opex}
          target={target}
          revenueTarget={targets?.monthly_revenue_target != null ? Number(targets.monthly_revenue_target) : null}
          gpTarget={targets?.monthly_gross_profit_target != null ? Number(targets.monthly_gross_profit_target) : null}
          orders={monthOrders}
        />
      </div>

      {/* Distribution + trend */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Margin distribution"
          right={<span className="text-[12px] text-[#9A9DA1]">{pms.length} products · avg {Math.round(avgMargin)}%</span>}
        >
          {pms.length > 0 ? (
            <MarginBars bands={bands} />
          ) : (
            <p className="py-6 text-center text-[13px] text-[#9A9DA1]">
              Build a price list to see how your margins are distributed.
            </p>
          )}
        </Panel>
        <MarginTrendCard series={trendSeries} target={target} />
      </div>

      {/* Opportunity centre */}
      <div className="mt-5">
        <Panel
          title="Opportunity centre"
          right={
            <Link href="/app/pricepilot/recommendations" className="text-[12px] font-medium text-[#1E5E54] hover:underline">
              Review all →
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Margin opportunity / month" value={zar(marginOpportunity)} accent="#1E5E54" />
            <KpiCard label="Revenue at risk / month" value={zar(revenueAtRisk)} accent={revenueAtRisk > 0 ? '#A32D2D' : undefined} />
          </div>
          <div className="mt-4">
            {opportunities.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#9A9DA1]">
                {pms.length === 0
                  ? 'No catalogue pricing yet — create a price list to surface opportunities.'
                  : 'Every product is at or above target. Nothing to reprice right now. 🎉'}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#F0F0EC]">
                <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-2 bg-[#FBFBF9] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">
                  <span>Product</span>
                  <span className="text-right">Margin</span>
                  <span className="text-right">Impact / mo</span>
                  <span className="text-right">Priority</span>
                </div>
                {opportunities.slice(0, 5).map((o) => {
                  const ps = PRIORITY_STYLE[o.priority];
                  return (
                    <div
                      key={o.item.id}
                      className="grid grid-cols-[1.6fr_1fr_1fr_auto] items-center gap-2 border-t border-[#F0F0EC] px-4 py-3 text-[13px]"
                    >
                      <span className="min-w-0 truncate font-medium text-[#1A1C1E]">{o.item.name}</span>
                      <span className="text-right tabular-nums text-[#5F6368]">
                        {Math.round(o.currentMargin)}% <span className="text-[#9A9DA1]">→</span>{' '}
                        <span className="font-medium text-[#0F6E56]">{Math.round(o.suggestedMargin)}%</span>
                      </span>
                      <span className="text-right font-semibold tabular-nums text-[#1A1C1E]">
                        {o.monthlyImpact > 0 ? `+${zar(o.monthlyImpact)}` : <span className="text-[#9A9DA1]">—</span>}
                      </span>
                      <span className="flex justify-end">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: ps.bg, color: ps.fg }}
                        >
                          {ps.label}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Recent sales */}
      <div className="mt-5">
        <Panel
          title="Recent sales"
          right={
            <Link href="/app/pricepilot/recent-sales" className="text-[12px] font-medium text-[#1E5E54] hover:underline">
              View all →
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#9A9DA1]">No sales yet.</p>
          ) : (
            <div className="-my-1">
              {recent.map((o, i) => (
                <Link
                  key={o.id}
                  href={`/app/orderflow/orders/${o.id}`}
                  className={`flex items-center justify-between py-3 text-[13px] transition-colors hover:bg-[#FAFAF8] ${
                    i > 0 ? 'border-t border-[#F0F0EC]' : ''
                  }`}
                >
                  <span className="min-w-0 truncate text-[#1A1C1E]">
                    <span className="font-medium">{o.invoice_number ?? 'Invoice'}</span>{' '}
                    <span className="text-[#9A9DA1]">{(o.customer_id && custName.get(o.customer_id)) || ''}</span>
                  </span>
                  <span className="shrink-0 font-medium text-[#1A1C1E]">{zar(orderAgg.get(o.id)?.rev ?? 0)}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InsightChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[12px]">
      <span className="text-[#9A9DA1]">{label}</span>
      <span className="font-semibold text-[#1A1C1E]">{value}</span>
    </span>
  );
}
