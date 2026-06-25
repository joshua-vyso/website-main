import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { KpiCard } from '@/components/platform/procurepulse/ui';
import { rand } from '@/lib/platform/procurepulse';
import { zar, type OfOrder } from '@/lib/platform/orderflow';
import type { PlPriceList } from '@/lib/platform/pricepilot';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

export default async function PricePilotDashboardPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ count: productCount }, { data: lists }, { data: orders }, { data: items }, { data: complaints }, { data: customers }] =
    await Promise.all([
      db.from('pp_stock_items').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      db.from('pl_price_lists').select('*').eq('org_id', orgId),
      db.from('of_orders').select('*').eq('org_id', orgId).in('status', ['invoiced', 'paid']).order('created_at', { ascending: false }),
      db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
      db.from('pl_complaints').select('id, status').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
    ]);

  const byOrder = new Map<string, number>();
  for (const it of (items ?? []) as ItemAgg[]) {
    byOrder.set(it.order_id, (byOrder.get(it.order_id) ?? 0) + (Number(it.qty) || 0) * (Number(it.unit_price) || 0));
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const sales = (orders ?? []) as OfOrder[];
  const priceLists = (lists ?? []) as PlPriceList[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const salesThisMonth = sales
    .filter((o) => new Date(o.created_at).getTime() >= monthStart)
    .reduce((s, o) => s + (byOrder.get(o.id) ?? 0), 0);

  const products = productCount ?? 0;
  const avgMargin = priceLists.length
    ? Math.round(priceLists.reduce((s, l) => s + Number(l.default_margin_pct), 0) / priceLists.length)
    : 0;
  const openComplaints = ((complaints ?? []) as { status: string }[]).filter((c) => c.status !== 'resolved').length;

  const recent = sales.slice(0, 5);

  return (
    <div>
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">PricePilot</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">Margins, price lists and sales at a glance</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Products priced" value={String(products)} />
        <KpiCard label="Price lists" value={String(priceLists.length)} accent="#1E5E54" />
        <KpiCard label="Sales this month" value={rand(salesThisMonth, { compact: true })} accent="#0F6E56" />
        <KpiCard label="Open complaints" value={String(openComplaints)} accent={openComplaints > 0 ? '#A32D2D' : undefined} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent sales */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between border-b border-[#F0F0EC] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Recent sales</h2>
            <Link href="/app/pricepilot/recent-sales" className="text-[12px] font-medium text-[#1E5E54] hover:underline">View all</Link>
          </div>
          <div className="px-5">
            {recent.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9A9DA1]">No sales yet.</p>
            ) : (
              recent.map((o, i) => (
                <Link key={o.id} href={`/app/orderflow/orders/${o.id}`} className={`flex items-center justify-between py-3 text-[13px] transition-colors hover:bg-[#FAFAF8] ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                  <span className="min-w-0 truncate text-[#1A1C1E]">
                    <span className="font-medium">{o.invoice_number ?? 'Invoice'}</span>{' '}
                    <span className="text-[#9A9DA1]">{(o.customer_id && custName.get(o.customer_id)) || ''}</span>
                  </span>
                  <span className="shrink-0 font-medium text-[#1A1C1E]">{zar(byOrder.get(o.id) ?? 0)}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Pricing snapshot */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
          <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Pricing</h2>
          <div className="mt-3 space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Average margin across price lists</span>
              <span className="font-semibold text-[#1A1C1E]">{avgMargin}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Products in catalogue</span>
              <span className="font-semibold text-[#1A1C1E]">{products}</span>
            </div>
            <div className="border-t border-[#F0F0EC] pt-3">
              <Link href="/app/pricepilot/price-lists" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45]">
                Build a price list →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
