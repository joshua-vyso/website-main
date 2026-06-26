import { PageHead } from '@/components/platform/procurepulse/ui';

/**
 * Recipes — production planning from stock. Recipes define how stock products
 * combine into finished/internal products (e.g. Mixed Veg), with live ingredient
 * availability and estimated stock cost. Full editor + batch planning lands next.
 */
export default function ProcurePulseRecipes() {
  return (
    <div>
      <PageHead
        title="Recipes"
        subtitle="Combine stock products into finished items — with live ingredient availability and stock cost"
      />
      <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-16 text-center">
        <h2 className="text-[18px] font-semibold text-[#1A1C1E]">Recipes are coming to this module</h2>
        <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
          Build recipes like Mixed Veg from your stock products. You&apos;ll see which recipes can be
          produced now, the limiting ingredient, estimated cost per output unit, and one-click
          add-to-stock-order for anything short.
        </p>
      </div>
    </div>
  );
}
