'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rand, type RecipeReadiness } from '@/lib/platform/procurepulse';

/** A pre-computed, serializable summary of one recipe for the list grid. */
export interface RecipeCard {
  id: string;
  name: string;
  output: string | null;
  ingredientCount: number;
  batches: number | null;
  readiness: RecipeReadiness;
  limitingName: string | null;
  limitingUnit: string | null;
  costPerBatch: number;
}

const READINESS: Record<RecipeReadiness, { bg: string; fg: string; label: (b: number | null) => string }> = {
  ready: { bg: '#E1F5EE', fg: '#0F6E56', label: (b) => `Make ${b} now` },
  blocked: { bg: '#FCEBEB', fg: '#A32D2D', label: () => 'Short on stock' },
  unknown: { bg: '#F0F0EC', fg: '#5F6368', label: () => 'Link ingredients' },
};

export function RecipesView({ recipes }: { recipes: RecipeCard[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function newRecipe() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/procurepulse/recipe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'New recipe' }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && json.id) router.push(`/app/procurepulse/recipes/${json.id}`);
      else setCreating(false);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold text-[#1A1C1E]">
          Recipes {recipes.length > 0 ? `(${recipes.length})` : ''}
        </div>
        <button
          type="button"
          onClick={() => void newRecipe()}
          disabled={creating}
          className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ New recipe'}
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-16 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">No recipes yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
            Build a recipe like <span className="font-medium text-[#1A1C1E]">Mixed Veg</span> from your
            stock products. You&apos;ll see how many batches you can make now, the limiting ingredient,
            and the stock cost per batch.
          </p>
          <button
            type="button"
            onClick={() => void newRecipe()}
            disabled={creating}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#1F5FA8] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create your first recipe'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => {
            const tone = READINESS[r.readiness];
            return (
              <Link
                key={r.id}
                href={`/app/procurepulse/recipes/${r.id}`}
                className="group flex flex-col rounded-2xl border border-[#E7E7E2] bg-white p-4 transition-colors hover:border-[#3E7BC4]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[#1A1C1E]">{r.name}</div>
                    <div className="mt-0.5 truncate text-[12px] text-[#9A9DA1]">
                      {r.output ?? `${r.ingredientCount} ingredient${r.ingredientCount === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                  >
                    {tone.label(r.batches)}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-[28px] font-bold leading-none text-[#1A1C1E]">
                      {r.batches == null ? '—' : r.batches}
                    </div>
                    <div className="mt-1 text-[12px] text-[#9A9DA1]">batches now</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-medium text-[#1A1C1E]">
                      {rand(r.costPerBatch)}
                    </div>
                    <div className="mt-1 text-[12px] text-[#9A9DA1]">stock / batch</div>
                  </div>
                </div>

                {r.readiness === 'blocked' && r.limitingName ? (
                  <div className="mt-3 border-t border-[#EFEFEC] pt-2.5 text-[12px] text-[#A32D2D]">
                    Short: {r.limitingName}
                  </div>
                ) : r.readiness === 'ready' && r.limitingName ? (
                  <div className="mt-3 border-t border-[#EFEFEC] pt-2.5 text-[12px] text-[#5F6368]">
                    Limited by {r.limitingName}
                  </div>
                ) : (
                  <div className="mt-3 border-t border-[#EFEFEC] pt-2.5 text-[12px] text-[#9A9DA1]">
                    {r.ingredientCount} ingredient{r.ingredientCount === 1 ? '' : 's'}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
