import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchPrices } from '@/lib/platform/procurepulse-queries';
import { buildMatrix, rand } from '@/lib/platform/procurepulse';
import { PageHead, LiveChip } from '@/components/platform/procurepulse/ui';

export default async function ProcurePulseIntelligence() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, prices] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
  ]);

  const { suppliers, rows } = buildMatrix(items, prices);

  const opportunities = [...rows]
    .filter((r) => r.saving > 0)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 2);

  return (
    <div>
      <PageHead
        title="Procurement intelligence"
        subtitle="Compare suppliers across your Doc-U documents · prices per box"
        right={<LiveChip />}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_330px]">
        {/* Matrix table */}
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {/* Header row */}
          <div className="flex items-center border-b border-[#EEF1F5] pb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
            <div className="flex-1">Product</div>
            {suppliers.map((s) => (
              <div key={s} className="w-[110px] truncate text-right">
                {s}
              </div>
            ))}
            <div className="w-[110px] text-right">Best saving</div>
          </div>

          {/* Data rows */}
          {rows.map((row) => (
            <div
              key={row.item.id}
              className="flex items-center border-t border-[#F4F5F7] py-3.5"
            >
              <div className="flex-1 text-[14px] font-semibold text-[#171A17]">
                {row.item.name}
              </div>
              {suppliers.map((s) => {
                const cell = row.cells[s];
                return (
                  <div key={s} className="of-num w-[110px] text-right text-[14px]">
                    {cell.price == null ? (
                      <span className="text-[#C4C7C5]">—</span>
                    ) : cell.cheapest ? (
                      <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[12px] font-semibold text-[#0F6E56]">
                        {rand(cell.price)}
                      </span>
                    ) : (
                      <span className="text-[#6B6F68]">{rand(cell.price)}</span>
                    )}
                  </div>
                );
              })}
              <div className="of-num w-[110px] text-right text-[14px] font-semibold text-[#0F6E56]">
                Save {rand(row.saving)}
              </div>
            </div>
          ))}
        </div>

        {/* Insights rail */}
        <div className="space-y-3">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
            Top opportunities
          </div>
          {opportunities.map((row) => (
            <div
              key={row.item.id}
              className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1F5FA8]">
                <span className="h-[13px] w-[13px] bg-white" />
              </div>
              <div className="of-num mt-3 text-[16px] font-semibold text-[#0F6E56]">
                Save ~{rand(row.saving * 50)} / week
              </div>
              <p className="mt-1 text-[13px] text-[#6B6F68]">
                Switch {row.item.name.toLowerCase()} to the cheapest supplier — buy ~50{' '}
                {row.item.unit}/week at less per {row.item.unit}.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex h-[42px] w-full items-center justify-center rounded-[11px] border border-[#E2E6EC] bg-white text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                Add to order
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
