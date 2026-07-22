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
  unknown: { bg: '#EEF1F5', fg: '#6B6F68', label: () => 'Link ingredients' },
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
        <div className="of-display text-[16px] font-semibold text-[#171A17]">
          Recipes {recipes.length > 0 ? `(${recipes.length})` : ''}
        </div>
        <button
          type="button"
          onClick={() => void newRecipe()}
          disabled={creating}
          className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
        >
          {creating ? 'Creating…' : '+ New recipe'}
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-8 py-16 text-center">
          <h2 className="of-display text-[18px] font-semibold text-[#171A17]">No recipes yet</h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#6B6F68]">
            Build a recipe like <span className="font-medium text-[#171A17]">Mixed Veg</span> from your
            stock products. You&apos;ll see how many batches you can make now, the limiting ingredient,
            and the stock cost per batch.
          </p>
          <button
            type="button"
            onClick={() => void newRecipe()}
            disabled={creating}
            className="mt-5 inline-flex h-[42px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
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
                className="group flex flex-col rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#C9DEF7]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="of-display truncate text-[16px] font-semibold text-[#171A17]">{r.name}</div>
                    <div className="mt-0.5 truncate text-[12px] text-[#A0A49C]">
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
                    <div className="of-num text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">
                      {r.batches == null ? '—' : r.batches}
                    </div>
                    <div className="mt-1.5 text-[12px] text-[#A0A49C]">batches now</div>
                  </div>
                  <div className="text-right">
                    <div className="of-num text-[16px] font-semibold text-[#171A17]">
                      {rand(r.costPerBatch)}
                    </div>
                    <div className="mt-1.5 text-[12px] text-[#A0A49C]">stock / batch</div>
                  </div>
                </div>

                {r.readiness === 'blocked' && r.limitingName ? (
                  <div className="mt-3 border-t border-[#EEF1F5] pt-2.5 text-[12px] text-[#A32D2D]">
                    Short: {r.limitingName}
                  </div>
                ) : r.readiness === 'ready' && r.limitingName ? (
                  <div className="mt-3 border-t border-[#EEF1F5] pt-2.5 text-[12px] text-[#6B6F68]">
                    Limited by {r.limitingName}
                  </div>
                ) : (
                  <div className="mt-3 border-t border-[#EEF1F5] pt-2.5 text-[12px] text-[#A0A49C]">
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
