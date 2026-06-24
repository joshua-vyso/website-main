import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { summariseDocument, aiConfigured } from '@/lib/ai/anthropic';
import type { Document } from '@/lib/platform/types';

// One opus call; cached after the first generation.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Cached AI operational summary for a document (feature 1). Returns the cached
 * `documents.ai_summary` when present unless `regenerate` is set; otherwise
 * generates with Claude, writes the cache, and returns it.
 * Auth via cookie (web) or Bearer (mobile); RLS scopes to the caller's org.
 * Body: { documentId: string, regenerate?: boolean }.
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

  const body = (await req.json().catch(() => ({}))) as { documentId?: string; regenerate?: boolean };
  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', body.documentId)
    .maybeSingle<Document>();
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  // Serve the cache unless a regenerate was requested.
  if (doc.ai_summary && !body.regenerate) {
    return NextResponse.json({ summary: doc.ai_summary, cached: true }, { headers: AI_CORS_HEADERS });
  }

  // Thin projection of the org's other documents for context (RLS-scoped).
  const { data: siblings } = await supabase
    .from('documents')
    .select('filename, document_type, supplier:suppliers(name)')
    .neq('id', doc.id)
    .order('created_at', { ascending: false })
    .limit(10);

  let summary;
  try {
    summary = await summariseDocument({
      filename: doc.filename,
      documentType: doc.document_type,
      extracted: doc.extracted_data,
      siblings: (siblings ?? []).map((s) => ({
        filename: s.filename as string,
        document_type: (s.document_type as string | null) ?? null,
        supplier: (s.supplier as { name?: string } | null)?.name ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Summary failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({ ai_summary: summary })
    .eq('id', doc.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  return NextResponse.json({ summary, cached: false }, { headers: AI_CORS_HEADERS });
}
