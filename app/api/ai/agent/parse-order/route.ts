import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';
import { extractOrderDocument, aiConfigured } from '@/lib/ai/anthropic';

// Reading an order document (PDF/photo) can take a few seconds.
export const maxDuration = 45;

// ~13 MB decoded. base64 is ~4/3 the byte size.
const MAX_BASE64_CHARS = 18_000_000;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Vyso AI — parse an uploaded order document into structured line items (Haiku),
 * for the "read an order in chat → paste into a new order" flow. Read-only: this
 * does NOT upload or create anything. Gated by the VYSO_AI_ENABLED kill switch.
 * Body: { base64, mediaType, filename }.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  if (!isVysoAiAllowed(auth.email)) {
    return NextResponse.json({ error: 'Vyso AI is not enabled for your account.' }, { status: 403, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    base64?: unknown;
    mediaType?: unknown;
    filename?: unknown;
    note?: unknown;
  };
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  if (!base64) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400, headers: AI_CORS_HEADERS });
  }
  if (base64.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: 'That file is too large (max ~13MB).' }, { status: 413, headers: AI_CORS_HEADERS });
  }
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : 'application/octet-stream';
  const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : 'order';
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined;

  // Give the order reader the org's product catalogue so it resolves
  // abbreviations/varieties to exact product names (best-effort).
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null }>();
  const orgId = profile?.org_id ?? null;
  let products: string[] = [];
  if (orgId) {
    const { data } = await auth.supabase.from('pp_stock_items').select('name').eq('org_id', orgId).order('name');
    products = ((data ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean);
  }

  try {
    const result = await extractOrderDocument({ base64, mediaType, filename, products, note });
    return NextResponse.json({ ok: true, ...result }, { headers: AI_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read this order.' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
}
