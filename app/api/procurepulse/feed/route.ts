import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import type { Document } from '@/lib/platform/types';

// A feed touches a handful of stock rows per line item; give it room.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Manually (re-)sync a document's extracted lines into ProcurePulse stock.
 * Idempotent — safe to call repeatedly and after editing line items.
 * Auth via cookie (web) or Bearer (mobile); RLS scopes to the caller's org.
 * Body: { documentId: string }.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as { documentId?: string };
  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, org_id, filename, document_type, supplier_id, extracted_data')
    .eq('id', body.documentId)
    .maybeSingle<Document>();
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  if (!(await orgHasProcurePulse(supabase, doc.org_id))) {
    return NextResponse.json(
      { error: 'ProcurePulse is not enabled for this org' },
      { status: 409, headers: AI_CORS_HEADERS },
    );
  }

  try {
    const feed = await feedDocumentToProcurePulse(supabase, doc);
    return NextResponse.json({ feed }, { headers: AI_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Feed failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
}
