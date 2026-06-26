import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';
import { aiConfigured, suggestProductMatches } from '@/lib/ai/anthropic';
import { buildFuzzyTargets, normalizeName } from '@/lib/platform/procurepulse/matching';
import type { ProductAlias, StockItem } from '@/lib/platform/types';

// Several Haiku batches over the unmatched catalogue — give it room.
export const maxDuration = 60;

const BATCH = 25;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42703' || /column .* does not exist/i.test(msg)) {
    return 'AI matching isn’t set up yet — run the pp-name-aliases-phase2 migration in Supabase.';
  }
  if (error?.code === '42P01' || (/pp_name_aliases/.test(msg) && /exist/i.test(msg))) {
    return 'Product matching isn’t set up yet — run the pp-name-aliases migrations in Supabase.';
  }
  return msg || 'Something went wrong.';
}

/**
 * Phase 2 AI matching. For each Doc-U-fed product with no exact match and no
 * existing alias, fuzzy-narrow the canonical candidates and ask Claude (Haiku) to
 * pick the right one (or none). Confident picks are written as `pending` alias
 * rows for the user to confirm/dismiss on the Products page. Never auto-links.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const db = await createServerSupabase();

  const [{ data: itemRows }, { data: aliasRows }] = await Promise.all([
    db.from('pp_stock_items').select('id, name, source_document_id').eq('org_id', orgId),
    db.from('pp_name_aliases').select('raw_name, status, discovered_item_id').eq('org_id', orgId),
  ]);
  const items = ((itemRows ?? []) as Pick<StockItem, 'id' | 'name' | 'source_document_id'>[]).map((i) => ({
    id: i.id,
    name: i.name,
    source_document_id: i.source_document_id,
  }));
  const aliases = (aliasRows ?? []) as Pick<ProductAlias, 'raw_name' | 'status' | 'discovered_item_id'>[];
  // Skip anything already ruled — by name AND by item id (a renamed item must not
  // earn a second alias). protectedNames guards the upsert from ever reverting a
  // confirmed/dismissed row back to pending.
  const exclude = new Set(aliases.map((a) => a.raw_name.trim().toLowerCase()));
  const excludeItemIds = new Set(
    aliases.map((a) => a.discovered_item_id).filter((id): id is string => Boolean(id)),
  );
  const protectedNames = new Set(
    aliases.filter((a) => a.status === 'confirmed' || a.status === 'dismissed').map((a) => a.raw_name.trim().toLowerCase()),
  );

  // Bound the AI spend per scan — surface the cap rather than silently truncating.
  const MAX_SCAN = 400;
  const allTargets = buildFuzzyTargets(items, exclude, excludeItemIds);
  const targets = allTargets.slice(0, MAX_SCAN);
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, suggested: 0, scanned: 0 }, { headers: AI_CORS_HEADERS });
  }

  // Batch the discovered items (each with its candidate list) through Haiku.
  const batches: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

  let suggestions: { id: string; targetId: string | null; confidence: number; reason: string }[] = [];
  try {
    const results = await Promise.all(
      batches.map((b) =>
        suggestProductMatches(
          b.map((t) => ({ id: t.item.id, name: t.item.name, candidates: t.candidates.map((c) => ({ id: c.id, name: c.name })) })),
        ),
      ),
    );
    suggestions = results.flat();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI matching failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }

  // Resolve names for context and write the confident picks as pending rows.
  const targetById = new Map(targets.map((t) => [t.item.id, t]));
  const itemNameById = new Map(items.map((i) => [i.id, i.name]));
  const rows = suggestions
    .filter((s) => s.targetId)
    .map((s) => {
      const t = targetById.get(s.id);
      return {
        org_id: orgId,
        raw_name: (t?.item.name ?? '').trim(),
        normalized_name: normalizeName(t?.item.name ?? ''),
        suggested_name: itemNameById.get(s.targetId as string) ?? null,
        stock_item_id: s.targetId,
        discovered_item_id: s.id,
        method: 'ai',
        confidence: s.confidence,
        ai_rationale: s.reason || null,
        status: 'pending',
        created_by: session.userId,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.raw_name && r.suggested_name)
    // Never write over a row the user already confirmed or dismissed.
    .filter((r) => !protectedNames.has(r.raw_name.trim().toLowerCase()));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, suggested: 0, scanned: targets.length }, { headers: AI_CORS_HEADERS });
  }

  const { error } = await db.from('pp_name_aliases').upsert(rows, { onConflict: 'org_id,raw_name' });
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json(
    { ok: true, suggested: rows.length, scanned: targets.length, capped: allTargets.length > targets.length },
    { headers: AI_CORS_HEADERS },
  );
}
