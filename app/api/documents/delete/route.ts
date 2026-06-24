import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { orgHasProcurePulse, unfeedDocumentFromProcurePulse } from '@/lib/platform/procurepulse-feed';
import type { Document } from '@/lib/platform/types';

export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Delete one or more documents. For each, first reverses its ProcurePulse
 * contribution (deletes its stock movements + subtracts from on-hand), then
 * removes the storage object and the documents row. RLS scopes everything to
 * the caller's org. Body: { documentIds: string[] }.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as { documentIds?: string[] };
  const ids = Array.isArray(body.documentIds) ? body.documentIds.filter((x) => typeof x === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'documentIds is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  // Only documents the caller can see (RLS already scopes to their org).
  const { data: docs } = await supabase
    .from('documents')
    .select('id, org_id, storage_path')
    .in('id', ids);
  const rows = (docs as Pick<Document, 'id' | 'org_id' | 'storage_path'>[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ deleted: 0 }, { headers: AI_CORS_HEADERS });
  }

  const orgId = rows[0].org_id;
  const hasPP = orgId ? await orgHasProcurePulse(supabase, orgId) : false;

  // Reverse ProcurePulse contribution before the rows go (best-effort).
  if (hasPP) {
    for (const r of rows) {
      try {
        await unfeedDocumentFromProcurePulse(supabase, r.id);
      } catch {
        /* never block deletion on an unfeed hiccup */
      }
    }
  }

  // Remove storage objects (batch), then the rows.
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from('documents').remove(paths);
  }

  const idsToDelete = rows.map((r) => r.id);
  const { error: delErr } = await supabase.from('documents').delete().in('id', idsToDelete);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  return NextResponse.json({ deleted: idsToDelete.length }, { headers: AI_CORS_HEADERS });
}
