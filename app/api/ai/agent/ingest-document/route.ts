import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';
import { aiConfigured } from '@/lib/ai/anthropic';
import { ingestDocument } from '@/lib/platform/document-ingest';

// Classification + extraction + (for orders) invoicing can chain a few calls.
export const maxDuration = 60;

// ~13 MB decoded (base64 is ~4/3 the byte size). Images are downscaled client-side.
const MAX_BASE64_CHARS = 18_000_000;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Vyso AI — ingest a document uploaded in the chat: classify it (order / invoice /
 * statement / delivery note / price list), FILE it into Doc-U, and — when it's a
 * customer order — build the OrderFlow order, auto-invoicing when the customer is
 * confidently matched (else holding a draft for review, exactly like the "Upload
 * order" button). Preview-gated to VYSO_AI_EMAILS.
 *
 * The pipeline itself lives in lib/platform/document-ingest so the chat and the
 * inbound-email worker share ONE audited write path. This route owns auth: all
 * writes run on the caller's RLS-scoped client and the orgId comes from their
 * verified profiles row, so it can only ever touch their own org.
 * Body: { base64, mediaType, filename, note? }.
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
  const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : 'document';
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined;

  const supabase = auth.supabase;
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null }>();
  const orgId = profile?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation for your account.' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const result = await ingestDocument({
    supabase,
    orgId,
    userId: auth.userId,
    base64,
    mediaType,
    filename,
    note,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.documentId ? { documentId: result.documentId } : {}) },
      { status: result.status, headers: AI_CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      documentId: result.documentId,
      documentType: result.documentType,
      ...(result.documentType === 'order'
        ? {
            customerName: result.customerName,
            itemCount: result.itemCount,
            orderSync: result.orderSync,
          }
        : { supplier: result.supplier ?? null, itemCount: result.itemCount }),
    },
    { headers: AI_CORS_HEADERS },
  );
}
