import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchRecipe, fetchIngredientsForRecipe } from '@/lib/platform/procurepulse-queries';
import { RecipeEditor, type ItemLite } from '@/components/platform/procurepulse/RecipeEditor';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const { id } = await params;

  const recipe = await fetchRecipe(db, id);
  if (!recipe) {
    return (
      <div className="space-y-4">
        <Link href="/app/procurepulse/recipes" className="text-[13px] text-[#6B6F68]">
          ‹&nbsp;&nbsp;Recipes
        </Link>
        <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="of-display text-[16px] font-semibold text-[#171A17]">Recipe not found</div>
          <p className="mt-1 text-[13px] text-[#8A8E86]">
            This recipe may have been removed or is not part of your organisation.
          </p>
        </div>
      </div>
    );
  }

  const [ingredients, items] = await Promise.all([
    fetchIngredientsForRecipe(db, id),
    fetchStock(db, orgId),
  ]);

  const lite: ItemLite[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    on_hand: i.on_hand,
    avg_unit_price: i.avg_unit_price,
  }));

  return <RecipeEditor recipe={recipe} ingredients={ingredients} items={lite} />;
}
