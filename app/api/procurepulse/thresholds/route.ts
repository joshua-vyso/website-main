import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_stock_thresholds/.test(msg) && /exist/i.test(msg))) {
    return 'Thresholds aren’t set up yet — run the pp-stock-thresholds migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Save per-product stock/freshness thresholds. Body: { rows: [{ stock_item_id,
 * low_threshold, par_level, lead_time_days, freshness_value, freshness_unit,
 * alerts_enabled, notes }] }. Upserts on (org_id, stock_item_id). RLS-scoped.
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;

  const body = (await req.json().catch(() => ({}))) as {
    rows?: Array<Record<string, unknown>>;
  };
  const rows = (body.rows ?? [])
    .filter((r) => typeof r.stock_item_id === 'string')
    .map((r) => ({
      org_id: orgId,
      stock_item_id: r.stock_item_id as string,
      low_threshold: num(r.low_threshold),
      par_level: num(r.par_level),
      lead_time_days: num(r.lead_time_days),
      freshness_value: num(r.freshness_value),
      freshness_unit: typeof r.freshness_unit === 'string' ? r.freshness_unit : 'days',
      alerts_enabled: r.alerts_enabled !== false,
      notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 }, { headers: AI_CORS_HEADERS });
  }

  const db = await createServerSupabase();
  const { error } = await db.from('pp_stock_thresholds').upsert(rows, { onConflict: 'org_id,stock_item_id' });
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  return NextResponse.json({ ok: true, saved: rows.length }, { headers: AI_CORS_HEADERS });
}
