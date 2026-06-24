import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { extractDocument, aiConfigured } from '@/lib/ai/anthropic';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import type { Document } from '@/lib/platform/types';

// Multi-page statements with many line items can take a while to parse.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Parse an uploaded document with Claude and write the structured fields back.
 * Auth via cookie (web) or Bearer token (mobile); RLS scopes all access to the
 * caller's org. Body: { documentId: string }.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

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
    .select('*')
    .eq('id', body.documentId)
    .maybeSingle<Document>();
  if (!doc || !doc.storage_path) {
    return NextResponse.json({ error: 'Document not found or has no file' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  const { data: file, error: dlErr } = await supabase.storage.from('documents').download(doc.storage_path);
  if (dlErr || !file) {
    return NextResponse.json({ error: 'Could not download the document' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const mediaType = file.type || (doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

  let result;
  try {
    result = await extractDocument({ base64, mediaType, filename: doc.filename });
  } catch (err) {
    // Don't leave the document stuck on "pending" — mark it errored so the
    // inbox shows a failure the user can retry rather than an endless spinner.
    await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }

  const documentType = doc.document_type ?? result.document_type;
  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: result.overall_confidence,
      extracted_data: { fields: result.fields, line_items: result.line_items },
      document_type: documentType,
    })
    .eq('id', doc.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  // Auto-feed the extracted lines into ProcurePulse (best-effort — a feed
  // failure must never fail extraction). Gated on the org having the feature.
  let feed = null;
  try {
    if (await orgHasProcurePulse(supabase, doc.org_id)) {
      feed = await feedDocumentToProcurePulse(supabase, {
        id: doc.id,
        org_id: doc.org_id,
        filename: doc.filename,
        document_type: documentType,
        supplier_id: doc.supplier_id,
        extracted_data: { fields: result.fields, line_items: result.line_items },
      });
    }
  } catch {
    /* swallow — extraction already succeeded */
  }

  return NextResponse.json({ ok: true, result, feed }, { headers: AI_CORS_HEADERS });
}
