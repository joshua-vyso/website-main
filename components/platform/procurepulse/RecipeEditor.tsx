'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  maxRecipeBatches,
  rand,
  type RecipeReadiness,
} from '@/lib/platform/procurepulse';
import type { Recipe, RecipeIngredient, StockItem } from '@/lib/platform/types';

/** The thin stock snapshot the editor needs for typeahead + availability. */
export interface ItemLite {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  avg_unit_price: number | null;
}

interface Row {
  key: string;
  stock_item_id: string | null;
  product_name: string;
  qty_per_batch: string;
  unit: string;
}

const READINESS: Record<RecipeReadiness, { bg: string; fg: string; label: string }> = {
  ready: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Ready to produce' },
  blocked: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Short on stock' },
  unknown: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Link ingredients' },
};

function sanitizeDecimal(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
}
function sanitizeInt(s: string): string {
  return s.replace(/[^0-9]/g, '');
}

let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;

export function RecipeEditor({
  recipe,
  ingredients,
  items,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  items: ItemLite[];
}) {
  const router = useRouter();

  const [name, setName] = useState(recipe.name ?? '');
  const [outputProduct, setOutputProduct] = useState(recipe.output_product ?? '');
  const [outputQty, setOutputQty] = useState(recipe.output_qty != null ? String(recipe.output_qty) : '');
  const [outputUnit, setOutputUnit] = useState(recipe.output_unit ?? '');
  const [notes, setNotes] = useState(recipe.notes ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    ingredients.map((ing) => ({
      key: newKey(),
      stock_item_id: ing.stock_item_id,
      product_name: ing.product_name,
      qty_per_batch: ing.qty_per_batch ? String(ing.qty_per_batch) : '',
      unit: ing.unit ?? '',
    })),
  );
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [planN, setPlanN] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Live plan — reuse the shared helper. We only ever read on_hand / avg_unit_price
  // off the stock item, so the ItemLite → StockItem cast is safe here.
  const stockByItem = useMemo(
    () => new Map<string, StockItem>(items.map((i) => [i.id, i as unknown as StockItem])),
    [items],
  );
  const draftIngredients: RecipeIngredient[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.key,
        org_id: recipe.org_id,
        recipe_id: recipe.id,
        stock_item_id: r.stock_item_id,
        product_name: r.product_name,
        qty_per_batch: Number(r.qty_per_batch) || 0,
        unit: r.unit || null,
      })),
    [rows, recipe.org_id, recipe.id],
  );
  const plan = useMemo(() => maxRecipeBatches(draftIngredients, stockByItem), [draftIngredients, stockByItem]);
  const tone = READINESS[plan.readiness];

  const planCount = Math.max(0, Number(planN) || 0);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { key: newKey(), stock_item_id: null, product_name: '', qty_per_batch: '', unit: '' }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setOpenRow(null);
  }
  function chooseItem(i: number, it: ItemLite) {
    updateRow(i, { stock_item_id: it.id, product_name: it.name, unit: it.unit || '' });
    setOpenRow(null);
  }

  function matchesFor(row: Row): ItemLite[] {
    const q = row.product_name.trim().toLowerCase();
    if (!q) return [];
    // Already an exact pick → don't re-show the list.
    if (row.stock_item_id && itemById.get(row.stock_item_id)?.name === row.product_name) return [];
    return items.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 6);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/procurepulse/recipe', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: recipe.id,
          name: name.trim() || 'Untitled recipe',
          output_product: outputProduct,
          output_qty: outputQty,
          output_unit: outputUnit,
          notes,
          ingredients: rows
            .filter((r) => r.product_name.trim())
            .map((r) => ({
              stock_item_id: r.stock_item_id,
              product_name: r.product_name.trim(),
              qty_per_batch: Number(r.qty_per_batch) || 0,
              unit: r.unit || null,
            })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setMsg(json?.error ?? 'Could not save the recipe.');
      else {
        setMsg('Saved.');
        router.refresh();
      }
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (deleting) return;
    if (!window.confirm('Delete this recipe? This can’t be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/procurepulse/recipe', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: recipe.id }),
      });
      if (res.ok) {
        router.push('/app/procurepulse/recipes');
        router.refresh();
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(json?.error ?? 'Could not delete the recipe.');
        setDeleting(false);
      }
    } catch {
      setMsg('Could not reach the server.');
      setDeleting(false);
    }
  }

  const field =
    'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  return (
    <div>
      <Link href="/app/procurepulse/recipes" className="text-[13px] text-[#6B6F68]">
        ‹&nbsp;&nbsp;Recipes
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Recipe name"
          className="of-display min-w-0 flex-1 border-0 bg-transparent text-[28px] font-semibold tracking-[-0.015em] text-[#171A17] outline-none placeholder:text-[#C4C4BE]"
        />
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#A32D2D]/40 hover:text-[#A32D2D] disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {/* Output definition */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[#6B6F68]">
        <span>Produces</span>
        <input
          value={outputProduct}
          onChange={(e) => setOutputProduct(e.target.value)}
          placeholder="output product (e.g. Mixed Veg)"
          className="h-10 w-[220px] rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <span>· makes</span>
        <input
          value={outputQty}
          onChange={(e) => setOutputQty(sanitizeDecimal(e.target.value))}
          inputMode="decimal"
          placeholder="qty"
          className="of-num h-10 w-[72px] rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-right text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <input
          value={outputUnit}
          onChange={(e) => setOutputUnit(e.target.value)}
          placeholder="unit"
          className="h-10 w-[110px] rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <span className="text-[#8A8E86]">per batch</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* LEFT — ingredients */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="flex items-center justify-between border-b border-[#EEF1F5] px-5 py-4">
              <div className="of-display text-[16px] font-semibold text-[#171A17]">
                Ingredients{rows.length ? ` (${rows.length})` : ''}
              </div>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex h-[38px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#1F5FA8] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                + Add ingredient
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
                No ingredients yet. Add stock products and how much each batch uses.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                  <div className="flex-1">Ingredient</div>
                  <div className="w-[92px] text-right">Per batch</div>
                  <div className="w-[88px]">Unit</div>
                  <div className="w-6" />
                </div>
                {rows.map((row, i) => {
                  const item = row.stock_item_id ? itemById.get(row.stock_item_id) : null;
                  const matches = openRow === i ? matchesFor(row) : [];
                  const perBatch = Number(row.qty_per_batch) || 0;
                  const canBatches = item && perBatch > 0 ? Math.floor(item.on_hand / perBatch) : null;
                  return (
                    <div key={row.key} className="border-t border-[#F4F5F7] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            className={`${field} w-full`}
                            placeholder="Search stock or type a name"
                            value={row.product_name}
                            onFocus={() => setOpenRow(i)}
                            onChange={(e) => {
                              updateRow(i, { product_name: e.target.value, stock_item_id: null });
                              setOpenRow(i);
                            }}
                          />
                          {matches.length > 0 ? (
                            <div className="absolute left-0 right-0 top-[48px] z-20 max-h-[220px] overflow-auto rounded-lg border border-[#EAEDF2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]">
                              {matches.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    chooseItem(i, it);
                                  }}
                                  className="flex w-full items-center justify-between px-4 py-2 text-left text-[14px] text-[#171A17] hover:bg-[#F5F9FE]"
                                >
                                  <span className="truncate">{it.name}</span>
                                  <span className="of-num ml-2 shrink-0 text-[11px] text-[#A0A49C]">
                                    {it.on_hand} {it.unit}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <input
                          className={`${field} of-num w-[92px] text-right`}
                          inputMode="decimal"
                          placeholder="0"
                          value={row.qty_per_batch}
                          onChange={(e) => updateRow(i, { qty_per_batch: sanitizeDecimal(e.target.value) })}
                        />
                        <input
                          className={`${field} w-[88px]`}
                          placeholder="unit"
                          value={row.unit}
                          onChange={(e) => updateRow(i, { unit: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          aria-label="Remove ingredient"
                          className="flex h-9 w-6 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-1.5 pl-0.5 text-[12px]">
                        {!row.product_name.trim() ? (
                          <span className="text-[#C4C4BE]">—</span>
                        ) : item ? (
                          <span className="of-num text-[#6B6F68]">
                            On hand: {item.on_hand} {item.unit}
                            {canBatches != null ? (
                              <>
                                {' '}·{' '}
                                <span style={{ color: canBatches > 0 ? '#0F6E56' : '#A32D2D' }}>
                                  {canBatches} batch{canBatches === 1 ? '' : 'es'}
                                </span>
                              </>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[#854F0B]">Not linked to stock — won’t affect availability</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Method, yield notes, anything the team should know."
              rows={3}
              className="mt-2 w-full resize-y rounded-[12px] border border-[#E4E9F0] bg-white px-4 py-2.5 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-end gap-3">
            {msg ? (
              <span className={`mr-auto text-[13px] ${msg === 'Saved.' ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}`}>
                {msg}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save recipe'}
            </button>
          </div>
        </div>

        {/* RIGHT — availability + batch plan */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="flex items-center justify-between">
              <div className="of-display text-[16px] font-semibold text-[#171A17]">Can make now</div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: tone.bg, color: tone.fg }}
              >
                {tone.label}
              </span>
            </div>
            <div className="of-num mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">
              {plan.batches == null ? '—' : plan.batches}
              <span className="ml-2 text-[14px] font-normal text-[#8A8E86]">batches</span>
            </div>
            {plan.limiting ? (
              <div className="mt-2 text-[13px] text-[#6B6F68]">
                {plan.readiness === 'blocked' ? 'Short: ' : 'Limited by '}
                <span className="font-medium text-[#171A17]">{plan.limiting.ingredient.product_name}</span>
                {' '}· <span className="of-num">{plan.limiting.onHand}</span> on hand
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-[#8A8E86]">
                Link ingredients to stock to see live availability.
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-[#EEF1F5] pt-3 text-[13px]">
              <span className="text-[#8A8E86]">Stock cost · per batch</span>
              <span className="of-num font-semibold text-[#171A17]">{rand(plan.costPerBatch)}</span>
            </div>
          </div>

          {/* Batch plan */}
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">Batch plan</div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[#6B6F68]">
              <span>Plan</span>
              <input
                value={planN}
                onChange={(e) => setPlanN(sanitizeInt(e.target.value))}
                inputMode="numeric"
                placeholder={plan.batches != null ? String(plan.batches) : '0'}
                className="of-num h-10 w-[72px] rounded-[10px] border border-[#E4E9F0] bg-white px-3 text-right text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
              />
              <span>batches</span>
            </div>

            {planCount > 0 && plan.availabilities.length > 0 ? (
              <div className="mt-3 border-t border-[#EEF1F5] pt-1">
                {plan.availabilities.map((a) => {
                  const required = a.perBatch * planCount;
                  const shortfall = a.linked ? Math.max(0, required - a.onHand) : 0;
                  return (
                    <div
                      key={a.ingredient.id}
                      className="flex items-center justify-between border-t border-[#F4F5F7] py-2 text-[13px] first:border-t-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[#171A17]">{a.ingredient.product_name || '—'}</div>
                        <div className="of-num text-[12px] text-[#A0A49C]">
                          need {required}
                          {a.ingredient.unit ? ` ${a.ingredient.unit}` : ''}
                          {a.linked ? ` · have ${a.onHand}` : ' · not linked'}
                        </div>
                      </div>
                      {a.linked ? (
                        shortfall > 0 ? (
                          <span className="of-num shrink-0 rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[11px] font-medium text-[#A32D2D]">
                            short {shortfall}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] font-medium text-[#0F6E56]">
                            ok
                          </span>
                        )
                      ) : (
                        <span className="shrink-0 text-[11px] text-[#8A8E86]">—</span>
                      )}
                    </div>
                  );
                })}
                <div className="mt-2 flex items-center justify-between border-t border-[#EEF1F5] pt-2.5 text-[13px]">
                  <span className="text-[#8A8E86]">Stock cost · {planCount} batch{planCount === 1 ? '' : 'es'}</span>
                  <span className="of-num font-semibold text-[#171A17]">{rand(plan.costPerBatch * planCount)}</span>
                </div>
                {plan.availabilities.some((a) => a.linked && a.perBatch * planCount - a.onHand > 0) ? (
                  <Link
                    href="/app/procurepulse/reorder"
                    className="mt-3 inline-flex h-[42px] w-full items-center justify-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#1F5FA8] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
                  >
                    Reorder what&apos;s short
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[#8A8E86]">
                Enter a batch count to see the stock each run needs and any shortfalls.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
