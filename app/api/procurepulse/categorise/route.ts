import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { categoriseProducts, aiConfigured } from '@/lib/ai/anthropic';

// Categorising a full catalogue runs several Haiku batches — give it room.
export const maxDuration = 60;

// Products per Claude call. Kept modest so each batch returns reliable JSON.
const BATCH = 120;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Auto-categorise ProcurePulse stock items with Claude (Haiku). By default only
 * items with no category are touched; `{ all: true }` re-categorises everything.
 * RLS scopes every read/write to the caller's org.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as { all?: boolean };
  const recategoriseAll = body.all === true;

  const { data, error } = await supabase.from('pp_stock_items').select('id, name, category');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  const rows = (data ?? []) as { id: string; name: string; category: string | null }[];
  const targets = rows.filter((r) => recategoriseAll || !r.category || !r.category.trim());
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, reason: 'nothing-to-categorise' }, { headers: AI_CORS_HEADERS });
  }

  // Chunk into batches and categorise them in parallel.
  const batches: { id: string; name: string }[][] = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

  let mapping: Record<string, string> = {};
  try {
    const results = await Promise.all(batches.map((b) => categoriseProducts(b)));
    for (const r of results) mapping = { ...mapping, ...r };
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Categorisation failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }

  // Persist — group ids by category so it's a handful of UPDATEs, not one per row.
  const byCategory = new Map<string, string[]>();
  for (const [id, cat] of Object.entries(mapping)) {
    const arr = byCategory.get(cat) ?? [];
    arr.push(id);
    byCategory.set(cat, arr);
  }

  let updated = 0;
  const errors: unknown[] = [];
  for (const [cat, ids] of byCategory) {
    const { error: e } = await supabase.from('pp_stock_items').update({ category: cat }).in('id', ids);
    if (e) errors.push(e);
    else updated += ids.length;
  }

  if (errors.length) {
    return NextResponse.json({ ok: false, updated, error: 'Some products could not be updated.' }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true, updated, total: targets.length }, { headers: AI_CORS_HEADERS });
}
