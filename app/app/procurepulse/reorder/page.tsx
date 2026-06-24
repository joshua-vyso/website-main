import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchPrices } from '@/lib/platform/procurepulse-queries';
import { buildDraftOrder, rand } from '@/lib/platform/procurepulse';
import { PageHead, PpButton } from '@/components/platform/procurepulse/ui';

export default async function ProcurePulseReorder() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, prices] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
  ]);

  const order = buildDraftOrder(items, prices);

  return (
    <div>
      <PageHead
        title="Purchase order"
        subtitle="Draft built from your low-stock items · grouped by supplier"
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* PO table */}
        <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center border-b border-[#E7E7E2] px-4 py-3 text-[12px] font-medium text-[#9A9DA1]">
            <div className="flex-1">Product</div>
            <div className="w-[150px]">Pack</div>
            <div className="w-[110px] text-right">Qty</div>
            <div className="w-[120px] text-right">Unit price</div>
            <div className="w-[120px] text-right">Line total</div>
          </div>

          {order.groups.map((group) => (
            <div key={group.supplier}>
              <div className="flex items-center justify-between bg-[#FAFAF8] px-4 py-2.5">
                <div className="text-[13px] font-medium text-[#1A1C1E]">{group.supplier}</div>
                <div className="text-[12px] text-[#5F6368]">Subtotal  {rand(group.subtotal)}</div>
              </div>
              {group.lines.map((line) => (
                <div
                  key={line.item.id}
                  className="flex items-center border-t border-[#EFEFEC] px-4 py-3.5 text-[13px] text-[#1A1C1E]"
                >
                  <div className="flex-1 font-medium">{line.item.name}</div>
                  <div className="w-[150px] text-[#5F6368]">{line.item.pack}</div>
                  <div className="w-[110px] text-right text-[#5F6368]">
                    {line.qty} {line.item.unit}
                  </div>
                  <div className="w-[120px] text-right text-[#5F6368]">{rand(line.unitPrice)}</div>
                  <div className="w-[120px] text-right font-medium">{rand(line.lineTotal)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="h-fit rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[14px] font-medium text-[#1A1C1E]">Order summary</div>

          <div className="mt-4 text-[13px] text-[#9A9DA1]">Order total (excl. VAT)</div>
          <div className="mt-1 text-[28px] font-bold text-[#1A1C1E]">{rand(order.total)}</div>

          <div className="my-4 border-t border-[#EFEFEC]" />

          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Items</span>
              <span className="font-medium text-[#1A1C1E]">{order.itemCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">Suppliers</span>
              <span className="font-medium text-[#1A1C1E]">{order.groups.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5F6368]">VAT (15%)</span>
              <span className="font-medium text-[#1A1C1E]">{rand(order.total * 0.15)}</span>
            </div>
          </div>

          <div className="my-4 border-t border-[#EFEFEC]" />

          <div className="flex items-center justify-between text-[14px]">
            <span className="font-medium text-[#1A1C1E]">Total incl. VAT</span>
            <span className="font-bold text-[#1A1C1E]">{rand(order.total * 1.15)}</span>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <PpButton>Send to supplier</PpButton>
            <PpButton variant="outline">Save draft</PpButton>
          </div>
        </div>
      </div>
    </div>
  );
}
