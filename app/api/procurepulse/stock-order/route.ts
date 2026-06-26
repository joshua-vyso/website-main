import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_stock_order/.test(msg) && /exist/i.test(msg))) {
    return 'Stock orders aren’t set up yet — run the pp-stock-orders migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

interface LineIn {
  stock_item_id?: string | null;
  product_name?: string;
  qty?: number;
  unit?: string | null;
  unit_price?: number | null;
  line_total?: number | null;
}

/**
 * Create a stock order from the Reordering page ("Send to team"). Body:
 * { supplier?, lines: LineIn[] }. Records a header + its lines so the page can
 * show order history by week.
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;

  const body = (await req.json().catch(() => ({}))) as { supplier?: string; lines?: LineIn[] };
  const lines = (body.lines ?? []).filter((l) => (l.product_name ?? '').trim());
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Nothing to order.' }, { status: 400, headers: AI_CORS_HEADERS });
  }
  const total = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);

  const db = await createServerSupabase();
  const { data: order, error: orderErr } = await db
    .from('pp_stock_orders')
    .insert({
      org_id: orgId,
      supplier: body.supplier?.trim() || null,
      status: 'sent',
      total,
      item_count: lines.length,
      created_by: session.userId,
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: friendly(orderErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  const orderId = (order as { id: string }).id;
  const { error: itemsErr } = await db.from('pp_stock_order_items').insert(
    lines.map((l) => ({
      org_id: orgId,
      order_id: orderId,
      stock_item_id: l.stock_item_id || null,
      product_name: (l.product_name ?? '').trim(),
      qty: Number(l.qty) || 0,
      unit: l.unit?.trim() || null,
      unit_price: Number(l.unit_price) || null,
      line_total: Number(l.line_total) || null,
    })),
  );
  if (itemsErr) {
    // Roll back the header so we don't leave an empty order.
    await db.from('pp_stock_orders').delete().eq('id', orderId);
    return NextResponse.json({ error: friendly(itemsErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  return NextResponse.json({ ok: true, orderId, total, items: lines.length }, { headers: AI_CORS_HEADERS });
}
