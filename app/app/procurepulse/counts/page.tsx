import { PageHead } from '@/components/platform/procurepulse/ui';

/**
 * Counts — cycle/stock counts and stock-accuracy intelligence (NOT wastage).
 * Count queue, recent counts, and variance review land next; framed strictly as
 * stock accuracy.
 */
export default function ProcurePulseCounts() {
  return (
    <div>
      <PageHead
        title="Counts"
        subtitle="Cycle counts and stock accuracy — keep on-hand levels honest"
      />
      <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-16 text-center">
        <h2 className="text-[18px] font-semibold text-[#1A1C1E]">Stock counts are coming to this module</h2>
        <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
          A count queue for items due, recent counts with variance, and a variance review for
          products that drift repeatedly — all framed as stock accuracy, feeding the dashboard
          accuracy figure and Alerts.
        </p>
      </div>
    </div>
  );
}
