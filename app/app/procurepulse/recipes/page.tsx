import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchRecipes, fetchRecipeIngredients } from '@/lib/platform/procurepulse-queries';
import { maxRecipeBatches, computeRecipeKpis, rand } from '@/lib/platform/procurepulse';
import type { RecipeWithPlan } from '@/lib/platform/procurepulse';
import type { StockItem } from '@/lib/platform/types';
import { PageHead, KpiCard } from '@/components/platform/procurepulse/ui';
import { RecipesView, type RecipeCard } from '@/components/platform/procurepulse/RecipesView';

/**
 * Recipes — production planning from live stock. Each recipe combines tracked
 * stock products into a finished/internal item; we surface how many batches can
 * be made now, the limiting ingredient, and the stock cost per batch.
 */
export default async function ProcurePulseRecipes() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, recipes, allIngredients] = await Promise.all([
    fetchStock(db, orgId),
    fetchRecipes(db, orgId),
    fetchRecipeIngredients(db, orgId),
  ]);

  const stockByItem = new Map<string, StockItem>(items.map((i) => [i.id, i]));
  const ingredientsByRecipe = new Map<string, typeof allIngredients>();
  for (const ing of allIngredients) {
    (ingredientsByRecipe.get(ing.recipe_id) ?? ingredientsByRecipe.set(ing.recipe_id, []).get(ing.recipe_id)!).push(ing);
  }

  const plans: RecipeWithPlan[] = recipes.map((recipe) => {
    const ings = ingredientsByRecipe.get(recipe.id) ?? [];
    return { recipe, plan: maxRecipeBatches(ings, stockByItem), ingredientCount: ings.length };
  });
  const kpis = computeRecipeKpis(plans, allIngredients);

  const cards: RecipeCard[] = plans.map(({ recipe, plan, ingredientCount }) => ({
    id: recipe.id,
    name: recipe.name,
    output:
      recipe.output_product
        ? `${recipe.output_product}${
            recipe.output_qty ? ` · makes ${recipe.output_qty}${recipe.output_unit ? ' ' + recipe.output_unit : ''}` : ''
          }`
        : null,
    ingredientCount,
    batches: plan.batches,
    readiness: plan.readiness,
    limitingName: plan.limiting?.ingredient.product_name ?? null,
    limitingUnit: plan.limiting?.ingredient.unit ?? null,
    costPerBatch: plan.costPerBatch,
  }));

  return (
    <div>
      <PageHead
        title="Recipes"
        subtitle="Combine stock products into finished items — with live ingredient availability and stock cost"
      />

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active recipes" value={String(kpis.activeRecipes)} />
        <KpiCard
          label="Short on stock"
          value={String(kpis.blocked)}
          accent={kpis.blocked > 0 ? '#A32D2D' : undefined}
        />
        <KpiCard label="Stock value · one batch each" value={rand(kpis.costOneBatchEach, { compact: true })} />
        <KpiCard label="Most-used ingredient" value={kpis.mostUsedIngredient} />
      </div>

      <RecipesView recipes={cards} />
    </div>
  );
}
