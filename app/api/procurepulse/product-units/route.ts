import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_product_units/.test(msg) && /exist/i.test(msg))) {
    return 'Units aren’t set up yet — run the pp-product-units migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const posNum = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Save per-product unit setup. Body: { rows: [{ stock_item_id, purchase_unit,
 * stock_unit, recipe_unit, conversion_factor }] }. Conversion factor must be
 * numeric + positive (else stored null). Upserts on (org_id, stock_item_id).
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;

  const body = (await req.json().catch(() => ({}))) as { rows?: Array<Record<string, unknown>> };
  const rows = (body.rows ?? [])
    .filter((r) => typeof r.stock_item_id === 'string')
    .map((r) => ({
      org_id: orgId,
      stock_item_id: r.stock_item_id as string,
      purchase_unit: str(r.purchase_unit),
      stock_unit: str(r.stock_unit),
      recipe_unit: str(r.recipe_unit),
      conversion_factor: posNum(r.conversion_factor),
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 }, { headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();
  const { error } = await db.from('pp_product_units').upsert(rows, { onConflict: 'org_id,stock_item_id' });
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  // The stock unit is the product's canonical unit module-wide — mirror it onto
  // pp_stock_items.unit so Live stock, Reordering, recipes etc. all read one value.
  const byUnit = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.stock_unit) continue;
    const arr = byUnit.get(r.stock_unit) ?? [];
    arr.push(r.stock_item_id);
    byUnit.set(r.stock_unit, arr);
  }
  for (const [unit, ids] of byUnit) {
    await db.from('pp_stock_items').update({ unit }).in('id', ids);
  }

  return NextResponse.json({ ok: true, saved: rows.length }, { headers: AI_CORS_HEADERS });
}
