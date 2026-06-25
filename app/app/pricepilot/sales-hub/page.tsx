import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { zar, type OfOrder } from '@/lib/platform/orderflow';

type ItemAgg = { order_id: string; qty: number; unit_price: number };

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string): string {
  if (key === 'unknown') return 'Undated';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export default async function PricePilotSalesHubPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }] = await Promise.all([
    db.from('of_orders').select('*').eq('org_id', orgId).in('status', ['invoiced', 'paid']).order('created_at', { ascending: false }),
    db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId),
    db.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);

  const byOrder = new Map<string, number>();
  for (const it of (items ?? []) as ItemAgg[]) {
    byOrder.set(it.order_id, (byOrder.get(it.order_id) ?? 0) + (Number(it.qty) || 0) * (Number(it.unit_price) || 0));
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const sales = (orders ?? []) as OfOrder[];

  const groups: { key: string; total: number; orders: OfOrder[] }[] = [];
  const byKey = new Map<string, number>();
  for (const o of sales) {
    const k = monthKey(o.created_at);
    if (!byKey.has(k)) {
      byKey.set(k, groups.length);
      groups.push({ key: k, total: 0, orders: [] });
    }
    const g = groups[byKey.get(k)!];
    g.orders.push(o);
    g.total += byOrder.get(o.id) ?? 0;
  }

  return (
    <div>
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Sales hub</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">All sales grouped by month, each linked to its OrderFlow invoice</p>
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No sales yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">Invoiced orders from OrderFlow will roll up here by month.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
              <div className="flex items-center justify-between border-b border-[#F0F0EC] bg-[#FBFBF9] px-5 py-3">
                <span className="text-[15px] font-semibold text-[#1A1C1E]">{monthLabel(g.key)}</span>
                <span className="text-[13px] text-[#5F6368]">
                  {g.orders.length} sale{g.orders.length === 1 ? '' : 's'} · <span className="font-semibold text-[#1A1C1E]">{zar(g.total)}</span>
                </span>
              </div>
              {g.orders.map((o) => (
                <Link key={o.id} href={`/app/orderflow/orders/${o.id}`} className="flex items-center border-t border-[#F0F0EC] px-5 py-3 text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8] first:border-t-0">
                  <div className="w-[130px] font-medium">{o.invoice_number ?? '—'}</div>
                  <div className="flex-1">{(o.customer_id && custName.get(o.customer_id)) || 'No customer'}</div>
                  <div className="w-[120px] text-right font-medium">{zar(byOrder.get(o.id) ?? 0)}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
