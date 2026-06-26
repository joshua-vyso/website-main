import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';
import { computeKgPerUnit } from '@/lib/platform/procurepulse-feed';
import { normalizeName } from '@/lib/platform/procurepulse/matching';

export const maxDuration = 30;

type Lite = { id: string; name: string; on_hand: number };

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/** Escape LIKE wildcards so a name is matched literally (case-insensitively). */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A "relation does not exist" error — an optional table (OrderFlow/PricePilot) isn't enabled. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message ?? '');
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_name_aliases/.test(msg) && /exist/i.test(msg))) {
    return 'Product matching isn’t set up yet — run the pp-name-aliases migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

/**
 * Confirm a product-name match. Body: { itemId, name } where `name` is the chosen
 * canonical name (the suggestion or the user's custom override).
 *  - If another catalogue item already has that name → MERGE the discovered item
 *    into it (re-point movements/orders/requests, drop its prices/overrides, fold
 *    on_hand, recompute kg, delete it).
 *  - Otherwise → RENAME the discovered item to the canonical name.
 * Either way a confirmed pp_name_aliases row is recorded so future Doc-U feeds map
 * the raw description straight to the right stock item.
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const db = await createServerSupabase();

  const body = (await req.json().catch(() => ({}))) as {
    itemId?: string;
    targetItemId?: string;
    name?: string;
  };
  const itemId = body.itemId;
  const finalName = (body.name ?? '').trim();
  if (!itemId || !finalName) {
    return NextResponse.json({ error: 'itemId and name are required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  // The discovered item being reconciled (explicit org filter + RLS).
  const { data: discoveredRow } = await db
    .from('pp_stock_items')
    .select('id, name, on_hand')
    .eq('id', itemId)
    .eq('org_id', orgId)
    .maybeSingle();
  const discovered = discoveredRow as unknown as Lite | null;
  if (!discovered) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: AI_CORS_HEADERS });
  }
  const rawName = discovered.name.trim();

  // Resolve the merge target: the candidate's explicit targetItemId if valid,
  // else any DIFFERENT existing item already named finalName.
  let target: Lite | null = null;
  if (body.targetItemId && body.targetItemId !== itemId) {
    const { data } = await db
      .from('pp_stock_items')
      .select('id, name, on_hand')
      .eq('id', body.targetItemId)
      .eq('org_id', orgId)
      .maybeSingle();
    target = (data as unknown as Lite | null) ?? null;
  }
  if (!target) {
    const { data: targetRows } = await db
      .from('pp_stock_items')
      .select('id, name, on_hand')
      .eq('org_id', orgId)
      .neq('id', itemId)
      .ilike('name', likeEscape(finalName))
      .limit(1);
    target = (((targetRows ?? [])[0] as unknown as Lite | undefined) ?? null);
  }

  let linkedItemId = itemId;

  if (target) {
    // MERGE discovered → target. Every re-point/delete is error-checked, and the
    // discovered row is deleted LAST — so a mid-way failure leaves it intact and
    // recoverable (no orphaned children, no silent inventory loss). Missing
    // optional tables (OrderFlow / PricePilot not enabled) are tolerated.
    const stepErrors = [
      (await db.from('pp_movements').update({ stock_item_id: target.id }).eq('stock_item_id', itemId)).error,
      (await db.from('of_order_items').update({ stock_item_id: target.id }).eq('stock_item_id', itemId)).error,
      (await db.from('pp_reorder_requests').update({ stock_item_id: target.id }).eq('stock_item_id', itemId)).error,
      // Drop discovered's prices/overrides — the survivor keeps its own (avoids
      // the pl_overrides unique(price_list_id, stock_item_id) clash on re-point).
      (await db.from('pp_item_suppliers').delete().eq('stock_item_id', itemId)).error,
      (await db.from('pl_overrides').delete().eq('stock_item_id', itemId)).error,
    ];
    for (const error of stepErrors) {
      if (error && !isMissingTable(error)) {
        return NextResponse.json(
          { error: `Could not merge — ${error.message}. Nothing was deleted.` },
          { status: 500, headers: AI_CORS_HEADERS },
        );
      }
    }

    // Fold on_hand; recompute kg from the survivor's (now larger) feeding set,
    // only overwriting kg with a real value (never nulling a good one).
    const sumOnHand = Math.max(0, Number(target.on_hand) + Number(discovered.on_hand));
    const kgMap = await computeKgPerUnit(db, [{ id: target.id, name: target.name }]);
    const kg = kgMap.get(target.id);
    const patch: Record<string, unknown> = { on_hand: sumOnHand };
    if (kg != null && kg > 0) patch.kg_per_unit = kg;
    let { error: upErr } = await db.from('pp_stock_items').update(patch).eq('id', target.id);
    if (upErr && 'kg_per_unit' in patch && /kg_per_unit/i.test(upErr.message ?? '')) {
      ({ error: upErr } = await db.from('pp_stock_items').update({ on_hand: sumOnHand }).eq('id', target.id));
    }
    if (upErr) {
      return NextResponse.json(
        { error: `Could not update the surviving product — ${upErr.message}. Nothing was deleted.` },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }

    // Apply the chosen canonical name to the survivor (so a cleaned custom name sticks).
    if (finalName.toLowerCase() !== target.name.trim().toLowerCase()) {
      await db.from('pp_stock_items').update({ name: finalName }).eq('id', target.id);
    }

    // Safe to remove the now-empty discovered item.
    const { error: delErr } = await db.from('pp_stock_items').delete().eq('id', itemId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500, headers: AI_CORS_HEADERS });
    }
    linkedItemId = target.id;
  } else if (finalName.toLowerCase() !== rawName.toLowerCase()) {
    // No duplicate — just RENAME the discovered item to the canonical name.
    const { error: renameErr } = await db.from('pp_stock_items').update({ name: finalName }).eq('id', itemId);
    if (renameErr) {
      return NextResponse.json({ error: renameErr.message }, { status: 500, headers: AI_CORS_HEADERS });
    }
  }

  // Record the confirmed alias (raw → canonical) so future feeds skip the dupe.
  const { error: aliasErr } = await db.from('pp_name_aliases').upsert(
    {
      org_id: orgId,
      raw_name: rawName,
      normalized_name: normalizeName(rawName),
      suggested_name: finalName,
      custom_name: finalName,
      stock_item_id: linkedItemId,
      status: 'confirmed',
      created_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,raw_name' },
  );
  if (aliasErr) {
    return NextResponse.json({ error: friendly(aliasErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  return NextResponse.json({ ok: true, merged: Boolean(target), linkedItemId }, { headers: AI_CORS_HEADERS });
}

/**
 * Dismiss a suggested match. Body: { itemId?, rawName }. Records a `dismissed`
 * alias so the pair never resurfaces in the review list.
 */
export async function DELETE(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const body = (await req.json().catch(() => ({}))) as { itemId?: string; rawName?: string };
  const rawName = (body.rawName ?? '').trim();
  if (!rawName) {
    return NextResponse.json({ error: 'rawName is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();
  const { error } = await db.from('pp_name_aliases').upsert(
    {
      org_id: session.org.id,
      raw_name: rawName,
      normalized_name: normalizeName(rawName),
      stock_item_id: body.itemId || null,
      status: 'dismissed',
      created_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,raw_name' },
  );
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: AI_CORS_HEADERS });
}
