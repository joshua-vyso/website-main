import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AreaChart, KpiCard } from '@/components/platform/procurepulse/ui';
import { Panel } from '@/components/platform/pricepilot/ui';
import {
  zar,
  zar2,
  sellPrice,
  pickBaseList,
  priceListValidity,
  VALIDITY_STYLE,
  CADENCE_LABEL,
  DEFAULT_TARGET_MARGIN,
  type PlPriceList,
  type PlOverride,
  type PlTargets,
} from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  avg_unit_price: number | null;
  price_history: number[] | null;
  source_document_id: string | null;
};
type ItemRow = { order_id: string; qty: number; unit_price: number };
const DAY = 86_400_000;

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: productRow }, { data: lists }, { data: overrides }, { data: orders }, { data: lineRows }, { data: customers }, { data: targetsRow }] =
    await Promise.all([
      db.from('pp_stock_items').select('id, name, category, unit, avg_unit_price, price_history, source_document_id').eq('id', id).maybeSingle(),
      db.from('pl_price_lists').select('*').eq('org_id', orgId),
      db.from('pl_overrides').select('*').eq('org_id', orgId).eq('stock_item_id', id),
      db.from('of_orders').select('id, created_at, customer_id').eq('org_id', orgId).in('status', ['invoiced', 'paid']),
      db.from('of_order_items').select('order_id, qty, unit_price').eq('org_id', orgId).eq('stock_item_id', id),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const product = productRow as ProductRow | null;
  if (!product) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#171A17]">Product not found</h1>
          <Link href="/app/pricepilot/products" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#171A17] px-4 text-[13px] font-medium text-white">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  const priceLists = (lists ?? []) as PlPriceList[];
  const ovs = (overrides ?? []) as PlOverride[];
  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;
  const cost = product.avg_unit_price != null ? Number(product.avg_unit_price) : null;
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // Catalogue margin on the base list (override on base, else base default).
  const base = pickBaseList(priceLists);
  const baseOv = base ? ovs.find((o) => o.price_list_id === base.id) : undefined;
  const catalogueMargin = base ? (baseOv ? Number(baseOv.margin_pct) : Number(base.default_margin_pct)) : null;
  const catalogueSell = cost != null && catalogueMargin != null ? sellPrice(cost, catalogueMargin) : null;

  // Per-customer prices for this product (customer-specific lists).
  const customerPrices = priceLists
    .filter((l) => l.customer_id)
    .map((l) => {
      const ov = ovs.find((o) => o.price_list_id === l.id);
      const margin = ov ? Number(ov.margin_pct) : Number(l.default_margin_pct);
      return {
        listId: l.id,
        customer: (l.customer_id && custName.get(l.customer_id)) || 'Customer',
        listName: l.name,
        cadence: l.cadence,
        margin,
        sell: cost != null ? sellPrice(cost, margin) : null,
        validity: priceListValidity(l),
      };
    })
    .sort((a, b) => a.customer.localeCompare(b.customer));

  // Realized sales of this product.
  const orderInfo = new Map(
    ((orders ?? []) as Pick<OfOrder, 'id' | 'created_at' | 'customer_id'>[]).map((o) => [o.id, { ts: new Date(o.created_at).getTime(), customerId: o.customer_id }]),
  );
  const lines = ((lineRows ?? []) as ItemRow[])
    .map((it) => {
      const info = orderInfo.get(it.order_id);
      if (!info) return null;
      const qty = Number(it.qty) || 0;
      const price = Number(it.unit_price) || 0;
      return { ts: info.ts, customerId: info.customerId, orderId: it.order_id, qty, price, revenue: qty * price };
    })
    .filter(Boolean) as { ts: number; customerId: string | null; orderId: string; qty: number; price: number; revenue: number }[];

  const now = Date.now();
  const since30 = now - 30 * DAY;
  const last30 = lines.filter((l) => l.ts >= since30);
  const units30 = last30.reduce((s, l) => s + l.qty, 0);
  const profit30 = cost != null ? last30.reduce((s, l) => s + l.qty * (l.price - cost), 0) : null;
  const projectedAnnualProfit = profit30 != null ? profit30 * 12 : null;

  // 6-month realized avg sell price + margin (carry-forward over empty months).
  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return { start: d.getTime(), end, label: d.toLocaleDateString('en-ZA', { month: 'short' }) };
  });
  let lastSell = 0;
  let lastMargin = 0;
  const sellSeries: number[] = [];
  const marginSeries: number[] = [];
  for (const b of monthBuckets) {
    const inB = lines.filter((l) => l.ts >= b.start && l.ts < b.end);
    const qty = inB.reduce((s, l) => s + l.qty, 0);
    const rev = inB.reduce((s, l) => s + l.revenue, 0);
    const avgSell = qty > 0 ? rev / qty : lastSell;
    const margin = qty > 0 && rev > 0 && cost != null ? ((rev - qty * cost) / rev) * 100 : lastMargin;
    lastSell = avgSell;
    lastMargin = margin;
    sellSeries.push(Math.round(avgSell));
    marginSeries.push(Math.round(margin));
  }
  const hasSalesHistory = lines.length > 0;
  const costHistory = (product.price_history ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n));

  // Linked document (the Doc-U doc this product last came from).
  let linkedDoc: { id: string; filename: string } | null = null;
  if (product.source_document_id) {
    const { data: doc } = await db.from('documents').select('id, filename').eq('id', product.source_document_id).maybeSingle();
    if (doc) linkedDoc = doc as { id: string; filename: string };
  }

  const recent = [...lines].sort((a, b) => b.ts - a.ts).slice(0, 6);
  const belowTarget = catalogueMargin != null && catalogueMargin < target;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app/pricepilot/products"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            <span aria-hidden>‹</span> Products
          </Link>
          <div className="min-w-0">
            <h1 className="of-display truncate text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">{product.name}</h1>
            <p className="mt-1 text-[14px] text-[#8A8E86]">
              {product.category ?? 'Uncategorised'}
              {product.unit ? ` · per ${product.unit}` : ''}
            </p>
          </div>
        </div>
        {catalogueMargin != null ? (
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium"
            style={belowTarget ? { backgroundColor: '#FCEBEB', color: '#A32D2D' } : { backgroundColor: '#E1F5EE', color: '#0F6E56' }}
          >
            {belowTarget ? 'Below target' : 'On target'} · <span className="of-num">{Math.round(catalogueMargin)}% vs {Math.round(target)}%</span>
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Latest cost" value={cost != null ? zar2(cost) : '—'} />
        <KpiCard label="Sell price" value={catalogueSell != null ? zar2(catalogueSell) : '—'} accent="#3E7BC4" />
        <KpiCard label="Sold (30 days)" value={units30 > 0 ? String(Math.round(units30)) : '—'} />
        <KpiCard label="Projected annual profit" value={projectedAnnualProfit != null ? zar(projectedAnnualProfit) : '—'} accent="#0F6E56" />
      </div>
      {projectedAnnualProfit != null ? (
        <p className="mt-2 text-[12px] text-[#A0A49C]">
          Projection = last 30 days&rsquo; gross profit on this product × 12 (estimate).
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Realized margin" right={<span className="text-[12px] text-[#A0A49C]">last 6 months</span>}>
          {hasSalesHistory ? (
            <>
              <div className="of-num text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{marginSeries[marginSeries.length - 1]}%</div>
              <div className="mt-3"><AreaChart data={marginSeries} height={100} /></div>
              <div className="of-num mt-1 flex justify-between text-[11px] text-[#A0A49C]">
                <span>{monthBuckets[0].label}</span>
                <span>{monthBuckets[monthBuckets.length - 1].label}</span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-[#8A8E86]">No sales of this product yet.</p>
          )}
        </Panel>
        <Panel title="Cost history" right={<span className="text-[12px] text-[#A0A49C]">from Doc-U</span>}>
          {costHistory.length > 1 ? (
            <>
              <div className="of-num text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{cost != null ? zar2(cost) : '—'}</div>
              <div className="mt-3"><AreaChart data={costHistory} height={100} color="#D9730D" fill="#FBEEDA" /></div>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-[#8A8E86]">Not enough cost history yet.</p>
          )}
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Customer pricing" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{customerPrices.length}</span> contract{customerPrices.length === 1 ? '' : 's'}</span>}>
          {customerPrices.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#8A8E86]">
              No customer-specific pricing for this product. It sells at the standard {catalogueMargin != null ? `${Math.round(catalogueMargin)}% margin` : 'price'}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                    <th className="py-2 pr-3 text-left font-medium">Customer</th>
                    <th className="px-3 py-2 text-left font-medium">Price list</th>
                    <th className="px-3 py-2 text-right font-medium">Margin</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="py-2 pl-3 text-right font-medium">Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPrices.map((cp) => {
                    const vs = VALIDITY_STYLE[cp.validity.status];
                    return (
                      <tr key={cp.listId} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                        <td className="py-3 pr-3 font-semibold text-[#171A17]">{cp.customer}</td>
                        <td className="px-3 py-3 text-[#6B6F68]">
                          <Link href={`/app/pricepilot/price-lists/${cp.listId}`} className="hover:text-[#174C87]">
                            {cp.listName} <span className="text-[#A0A49C]">· {CADENCE_LABEL[cp.cadence]}</span>
                          </Link>
                        </td>
                        <td className="of-num px-3 py-3 text-right text-[#6B6F68]">{Math.round(cp.margin)}%</td>
                        <td className="of-num px-3 py-3 text-right font-semibold text-[#171A17]">{cp.sell != null ? zar2(cp.sell) : '—'}</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: vs.bg, color: vs.fg }}>
                            {cp.validity.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Recent sales">
          {recent.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#8A8E86]">No sales yet.</p>
          ) : (
            <div className="-my-1">
              {recent.map((l, i) => (
                <Link
                  key={l.orderId + i}
                  href={`/app/orderflow/orders/${l.orderId}`}
                  className={`flex items-center justify-between py-3 text-[14px] transition-colors hover:bg-[#F5F9FE] ${i > 0 ? 'border-t border-[#F4F5F7]' : ''}`}
                >
                  <span className="min-w-0 truncate text-[#171A17]">
                    <span className="of-num text-[#A0A49C]">{new Date(l.ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>{' '}
                    {(l.customerId && custName.get(l.customerId)) || 'No customer'}
                  </span>
                  <span className="of-num shrink-0 text-[#6B6F68]">
                    {Math.round(l.qty)} × {zar2(l.price)} <span className="font-semibold text-[#171A17]">= {zar(l.revenue)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Linked document">
          {linkedDoc ? (
            <Link href={`/app/docu/${linkedDoc.id}`} className="flex items-center gap-3 rounded-[14px] border border-[#EEF1F5] p-3 transition-all hover:border-[#C9DEF7] hover:bg-[#F5F9FE]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EAF2FC] text-[#1F5FA8]">▦</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-[#171A17]">{linkedDoc.filename}</span>
                <span className="block text-[12px] text-[#A0A49C]">Source document in Doc-U →</span>
              </span>
            </Link>
          ) : (
            <p className="py-6 text-center text-[13px] text-[#8A8E86]">No linked source document.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
