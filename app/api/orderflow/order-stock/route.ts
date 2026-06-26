import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

type DB = Awaited<ReturnType<typeof createServerSupabase>>;

/** Apply a signed on-hand delta per item (next = max(0, on_hand + delta)). */
async function adjustOnHand(db: DB, deltaByItem: Map<string, number>) {
  const ids = [...deltaByItem.keys()];
  if (ids.length === 0) return;
  const { data } = await db.from('pp_stock_items').select('id, on_hand').in('id', ids);
  for (const row of (data ?? []) as { id: string; on_hand: number }[]) {
    const next = Math.max(0, Number(row.on_hand) + (deltaByItem.get(row.id) ?? 0));
    await db.from('pp_stock_items').update({ on_hand: next }).eq('id', row.id);
  }
}

/**
 * Reflect an OrderFlow sale in ProcurePulse stock. Body: { orderId, action }.
 *  - apply   → one negative `sale` movement per order line + decrement on_hand.
 *  - reverse → restore on_hand and remove the order's movements (on delete).
 *
 * pp_movements.source_document_id is FK'd to documents, so we link the movement
 * to its order via a dedicated `order_id` column (migration pp-movement-order-id).
 * The route degrades gracefully if that column / the 'sale' reason aren't present
 * yet: the movement still records (so the sale shows), just without order-keyed
 * idempotency/reversal until the migrations land.
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;

  const body = (await req.json().catch(() => ({}))) as { orderId?: string; action?: string };
  const orderId = body.orderId;
  const action = body.action === 'reverse' ? 'reverse' : 'apply';
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();

  // This order's existing stock movements (tolerant of the order_id column missing).
  const { data: existing, error: exErr } = await db
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('org_id', orgId)
    .eq('order_id', orderId);
  const existingMoves = exErr ? [] : ((existing ?? []) as { stock_item_id: string; change: number }[]);

  if (action === 'reverse') {
    if (exErr || existingMoves.length === 0) {
      return NextResponse.json({ ok: true, reversed: 0 }, { headers: AI_CORS_HEADERS });
    }
    const restore = new Map<string, number>();
    for (const m of existingMoves) {
      restore.set(m.stock_item_id, (restore.get(m.stock_item_id) ?? 0) - Number(m.change));
    }
    await adjustOnHand(db, restore);
    await db.from('pp_movements').delete().eq('org_id', orgId).eq('order_id', orderId);
    return NextResponse.json({ ok: true, reversed: existingMoves.length }, { headers: AI_CORS_HEADERS });
  }

  // apply — idempotent when the order_id column exists.
  if (existingMoves.length > 0) {
    return NextResponse.json({ ok: true, applied: 0, reason: 'already-applied' }, { headers: AI_CORS_HEADERS });
  }
  const { data: order } = await db
    .from('of_orders')
    .select('id, invoice_number')
    .eq('id', orderId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: AI_CORS_HEADERS });
  }
  const { data: itemRows } = await db
    .from('of_order_items')
    .select('stock_item_id, qty')
    .eq('order_id', orderId);
  const lines = ((itemRows ?? []) as { stock_item_id: string | null; qty: number }[]).filter(
    (l) => l.stock_item_id && Number(l.qty) > 0,
  );
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, applied: 0 }, { headers: AI_CORS_HEADERS });
  }

  const invoice = (order as { invoice_number: string | null }).invoice_number;
  const label = invoice ? `Sold · ${invoice}` : 'Sold to customer';
  const now = new Date().toISOString();
  const base = (reason: string) =>
    lines.map((l) => ({
      org_id: orgId,
      stock_item_id: l.stock_item_id,
      change: -(Number(l.qty) || 0),
      reason,
      source_label: label,
      occurred_at: now,
    }));
  const withOrder = (reason: string) => base(reason).map((r) => ({ ...r, order_id: orderId }));

  // Record the stock-out FIRST; only decrement on_hand if it lands. Try the
  // richest row first (order_id + 'sale'), then degrade: drop order_id if the
  // column is missing, drop to the legacy 'used' reason if the CHECK rejects 'sale'.
  const attempts = [withOrder('sale'), base('sale'), withOrder('used'), base('used')];
  let moveErr: { message?: string } | null = { message: 'init' };
  for (const rows of attempts) {
    ({ error: moveErr } = await db.from('pp_movements').insert(rows));
    if (!moveErr) break;
  }
  if (moveErr) {
    return NextResponse.json({ error: moveErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  const dec = new Map<string, number>();
  for (const l of lines) {
    dec.set(l.stock_item_id as string, (dec.get(l.stock_item_id as string) ?? 0) - (Number(l.qty) || 0));
  }
  await adjustOnHand(db, dec);

  return NextResponse.json({ ok: true, applied: lines.length }, { headers: AI_CORS_HEADERS });
}
