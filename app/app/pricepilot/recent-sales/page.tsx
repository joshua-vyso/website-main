import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { ORDER_STATUS_STYLE, zar, type OfOrder } from '@/lib/platform/orderflow';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function PricePilotRecentSalesPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }] = await Promise.all([
    db.from('of_orders').select('*').eq('org_id', orgId).in('status', ['invoiced', 'paid']).order('created_at', { ascending: false }).limit(50),
    db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
    db.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);

  const byOrder = new Map<string, number>();
  for (const it of (items ?? []) as ItemAgg[]) {
    byOrder.set(it.order_id, (byOrder.get(it.order_id) ?? 0) + (Number(it.qty) || 0) * (Number(it.unit_price) || 0));
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const sales = (orders ?? []) as OfOrder[];

  return (
    <div>
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Recent sales</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">Every recent sale, linked to its OrderFlow invoice</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="flex items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-2.5 text-[12px] text-[#5F6368]">
          <div className="w-[130px]">Invoice</div>
          <div className="flex-1">Customer</div>
          <div className="w-[110px]">Status</div>
          <div className="w-[120px] text-right">Total</div>
          <div className="w-[150px] text-right">Date</div>
        </div>
        {sales.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
            No sales yet. Invoice an order in OrderFlow and it'll appear here.
          </div>
        ) : (
          sales.map((o) => {
            const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.invoiced;
            return (
              <Link key={o.id} href={`/app/orderflow/orders/${o.id}`} className="flex items-center border-t border-[#F0F0EC] px-5 py-3.5 text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]">
                <div className="w-[130px] font-medium">{o.invoice_number ?? '—'}</div>
                <div className="flex-1">{(o.customer_id && custName.get(o.customer_id)) || 'No customer'}</div>
                <div className="w-[110px]">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>
                </div>
                <div className="w-[120px] text-right font-medium">{zar(byOrder.get(o.id) ?? 0)}</div>
                <div className="w-[150px] text-right text-[#9A9DA1]">{fmtDate(o.created_at)}</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
