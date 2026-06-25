import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { unitDimension, kgTo } from '@/lib/platform/procurepulse/units';
import type { ExtractedLineItem, StockItem } from '@/lib/platform/types';

export const maxDuration = 30;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/** Loose numeric parse ("10", "1 240.50", "R78") → number | null. */
function parseNum(s: string | undefined | null): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Convert a product's on_hand between a COUNT unit (boxes/bags…) and a WEIGHT
 * unit (kg/g) using the per-document weights Doc-U extracted. The weighted
 * average weight-per-unit is computed across every feeding line:
 *   avgKgPerUnit = Σ(quantity × weight) / Σ(quantity)
 * then on_hand is scaled by it. Both unit + on_hand are persisted. If no source
 * document with weights remains, returns ok:false and changes nothing.
 *
 * Body: { stockItemId: string, fromUnit: string, toUnit: string }
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as {
    stockItemId?: string;
    fromUnit?: string;
    toUnit?: string;
  };
  const { stockItemId, fromUnit, toUnit } = body;
  if (!stockItemId || !fromUnit || !toUnit) {
    return NextResponse.json({ error: 'stockItemId, fromUnit, toUnit required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const { data: itemRow } = await supabase
    .from('pp_stock_items')
    .select('id, name, on_hand, unit')
    .eq('id', stockItemId)
    .maybeSingle();
  const item = itemRow as Pick<StockItem, 'id' | 'name' | 'on_hand' | 'unit'> | null;
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: AI_CORS_HEADERS });

  const fromDim = unitDimension(fromUnit);
  const toDim = unitDimension(toUnit);

  // Same dimension (e.g. boxes → bags): nothing to recompute, just relabel.
  if (fromDim === toDim) {
    await supabase.from('pp_stock_items').update({ unit: toUnit }).eq('id', stockItemId);
    return NextResponse.json(
      { ok: true, recalculated: false, newOnHand: item.on_hand, reason: 'same-dimension' },
      { headers: AI_CORS_HEADERS },
    );
  }

  // Gather the item's feeding documents (via its movements) and their weights.
  const { data: moves } = await supabase
    .from('pp_movements')
    .select('source_document_id')
    .eq('stock_item_id', stockItemId);
  const docIds = [
    ...new Set(
      ((moves ?? []) as { source_document_id: string | null }[])
        .map((m) => m.source_document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let totalQty = 0;
  let totalKg = 0;
  let docsUsed = 0;
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, extracted_data')
      .in('id', docIds);
    const target = item.name.trim().toLowerCase();
    for (const d of (docs ?? []) as { id: string; extracted_data: { line_items?: ExtractedLineItem[] } | null }[]) {
      const lines = d.extracted_data?.line_items ?? [];
      let used = false;
      for (const li of lines) {
        if ((li.description ?? '').trim().toLowerCase() !== target) continue;
        const q = parseNum(li.quantity);
        const w = parseNum(li.weight);
        if (q != null && q > 0 && w != null && w > 0) {
          totalQty += q;
          totalKg += q * w;
          used = true;
        }
      }
      if (used) docsUsed += 1;
    }
  }

  const avgKgPerUnit = totalQty > 0 ? totalKg / totalQty : null;
  if (avgKgPerUnit == null || avgKgPerUnit <= 0) {
    return NextResponse.json(
      { ok: false, reason: 'no-weight-data' },
      { headers: AI_CORS_HEADERS },
    );
  }

  // count → weight: on_hand(count) × avgKgPerUnit → kg → target weight unit.
  // weight → count: on_hand(weight) → kg → ÷ avgKgPerUnit → count.
  const onHand = Number(item.on_hand) || 0;
  let newOnHand: number;
  if (fromDim === 'count') {
    newOnHand = round2(onHand * avgKgPerUnit * kgTo(toUnit));
  } else {
    const onHandKg = onHand / kgTo(fromUnit);
    newOnHand = round2(onHandKg / avgKgPerUnit);
  }

  await supabase.from('pp_stock_items').update({ unit: toUnit, on_hand: newOnHand }).eq('id', stockItemId);

  return NextResponse.json(
    { ok: true, recalculated: true, newOnHand, avgKgPerUnit: round2(avgKgPerUnit), docsUsed },
    { headers: AI_CORS_HEADERS },
  );
}
