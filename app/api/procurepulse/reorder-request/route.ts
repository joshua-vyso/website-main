import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

const VALID_STATUSES = new Set(['open', 'ordered', 'fulfilled', 'cancelled']);

/** Turn a raw DB error into a user-facing message — friendly for the migration gap. */
function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_reorder_requests/.test(msg) && /exist/i.test(msg))) {
    return 'Reorder requests aren’t set up yet — run the pp-reorder-requests migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

/**
 * Manual reorder requests on the Reordering page.
 *  POST  — create a request { product_name, stock_item_id?, qty, unit?, supplier?, note? }
 *  PATCH — update one { id, status? | qty? | supplier? | note? } (resolve/cancel/edit)
 * Org scope is enforced by RLS on pp_reorder_requests; we also stamp org_id +
 * created_by from the session so the WITH CHECK passes.
 */
interface BatchLine {
  product_name?: string;
  stock_item_id?: string | null;
  qty?: number | string;
  unit?: string | null;
  supplier?: string | null;
}

/** Dedupe key for an open request: the stock item if linked, else the lowercased name. */
function reqKey(stockItemId: string | null, name: string): string {
  return stockItemId ? `id:${stockItemId}` : `name:${name.toLowerCase()}`;
}

/**
 * Create many open reorder requests at once, skipping items that already have an
 * open request (so "Send to team" is idempotent across repeated clicks).
 */
async function batchCreate(orgId: string, userId: string, lines: BatchLine[]): Promise<Response> {
  const clean = lines
    .map((l) => ({
      stock_item_id: (l.stock_item_id ?? null) || null,
      product_name: (l.product_name ?? '').trim(),
      qty: Number(l.qty),
      unit: l.unit?.trim() || null,
      supplier: l.supplier?.trim() || null,
    }))
    .filter((l) => l.product_name);
  if (clean.length === 0) {
    return NextResponse.json({ ok: true, created: 0 }, { headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();

  // What's already open, so we don't duplicate.
  const { data: openRows, error: readErr } = await db
    .from('pp_reorder_requests')
    .select('stock_item_id, product_name')
    .eq('org_id', orgId)
    .eq('status', 'open');
  if (readErr) {
    return NextResponse.json({ error: friendly(readErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  const seen = new Set(
    ((openRows ?? []) as { stock_item_id: string | null; product_name: string }[]).map((r) =>
      reqKey(r.stock_item_id, r.product_name),
    ),
  );

  const rows: Record<string, unknown>[] = [];
  for (const l of clean) {
    const key = reqKey(l.stock_item_id, l.product_name);
    if (seen.has(key)) continue; // already an open request for this item
    seen.add(key); // also de-dupe within this batch
    rows.push({
      org_id: orgId,
      stock_item_id: l.stock_item_id,
      product_name: l.product_name,
      qty: Number.isFinite(l.qty) && l.qty > 0 ? l.qty : 0,
      unit: l.unit,
      supplier: l.supplier,
      status: 'open',
      created_by: userId,
    });
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, created: 0 }, { headers: AI_CORS_HEADERS });
  }

  const { error } = await db.from('pp_reorder_requests').insert(rows);
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true, created: rows.length }, { headers: AI_CORS_HEADERS });
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    product_name?: string;
    stock_item_id?: string | null;
    qty?: number | string;
    unit?: string | null;
    supplier?: string | null;
    note?: string | null;
    lines?: BatchLine[];
  };

  // Batch mode — used by "Send to team" to drop the basket into the team's
  // open reorder requests. Skips anything already open for the same item/name
  // so repeated sends don't pile up duplicates.
  if (Array.isArray(body.lines)) {
    return batchCreate(session.org.id, session.userId, body.lines);
  }

  const name = (body.product_name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'product_name is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }
  const qty = Number(body.qty);

  const db = await createServerSupabase();

  // Only honour a stock_item_id that belongs to the caller's org — RLS scopes the
  // lookup, so a foreign/unknown id simply resolves to a free-text request.
  let stockItemId: string | null = body.stock_item_id || null;
  if (stockItemId) {
    const { data: item } = await db.from('pp_stock_items').select('id').eq('id', stockItemId).maybeSingle();
    if (!item) stockItemId = null;
  }

  const { data, error } = await db
    .from('pp_reorder_requests')
    .insert({
      org_id: session.org.id,
      stock_item_id: stockItemId,
      product_name: name,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
      unit: body.unit?.trim() || null,
      supplier: body.supplier?.trim() || null,
      note: body.note?.trim() || null,
      status: 'open',
      created_by: session.userId,
    })
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true, request: data }, { headers: AI_CORS_HEADERS });
}

export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    qty?: number | string;
    supplier?: string | null;
    note?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === 'string') {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: AI_CORS_HEADERS });
    }
    patch.status = body.status;
  }
  if (body.qty != null) {
    const q = Number(body.qty);
    if (Number.isFinite(q) && q > 0) patch.qty = q;
  }
  if (body.supplier !== undefined) patch.supplier = (body.supplier ?? '').trim() || null;
  if (body.note !== undefined) patch.note = (body.note ?? '').trim() || null;

  const db = await createServerSupabase();
  // RLS scopes the update to the caller's org; id alone is enough to target the row.
  const { error } = await db.from('pp_reorder_requests').update(patch).eq('id', body.id);
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: AI_CORS_HEADERS });
}
