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
        <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Recent sales</h1>
        <p className="mt-1 text-[14px] text-[#8A8E86]">Every recent sale, linked to its OrderFlow invoice</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="flex items-center border-b border-[#EEF1F5] bg-[#FBFCFE] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <div className="w-[130px]">Invoice</div>
          <div className="flex-1">Customer</div>
          <div className="w-[110px]">Status</div>
          <div className="w-[120px] text-right">Total</div>
          <div className="w-[150px] text-right">Date</div>
        </div>
        {sales.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
            No sales yet. Invoice an order in OrderFlow and it'll appear here.
          </div>
        ) : (
          sales.map((o) => {
            const s = ORDER_STATUS_STYLE[o.status] ?? ORDER_STATUS_STYLE.invoiced;
            return (
              <Link key={o.id} href={`/app/orderflow/orders/${o.id}`} className="flex items-center border-t border-[#F4F5F7] px-5 py-3.5 text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
                <div className="of-num w-[130px] font-semibold">{o.invoice_number ?? '—'}</div>
                <div className="flex-1 text-[#2C333B]">{(o.customer_id && custName.get(o.customer_id)) || 'No customer'}</div>
                <div className="w-[110px]">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>
                </div>
                <div className="of-num w-[120px] text-right font-semibold">{zar(byOrder.get(o.id) ?? 0)}</div>
                <div className="of-num w-[150px] text-right text-[#A0A49C]">{fmtDate(o.created_at)}</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
