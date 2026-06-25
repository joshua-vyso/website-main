import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { unfeedDocumentFromProcurePulse } from '@/lib/platform/procurepulse-feed';
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

  // Reverse each document's ProcurePulse contribution before the rows go
  // (movements are FK'd to the document, so this must run first). Each call
  // no-ops cheaply when the doc fed no stock or the org lacks ProcurePulse (RLS
  // returns no movements), so the old separate feature-flag check is gone.
  //
  // These run SEQUENTIALLY on purpose: two documents in one bulk delete can feed
  // the same surviving stock item, and unfeed does a non-atomic read-modify-write
  // of on_hand. Running them concurrently would let both read the same level and
  // lose one subtraction (under-reversing stock). Each unfeed is now set-based
  // and index-served, so sequential is still fast.
  for (const id of ids) {
    try {
      await unfeedDocumentFromProcurePulse(supabase, id);
    } catch {
      /* never block deletion on an unfeed hiccup */
    }
  }

  // Delete the rows and read back their storage paths in ONE round-trip
  // (RETURNING), replacing the old up-front SELECT. RLS scopes this to the
  // caller's org, so unknown/foreign ids simply return nothing.
  const { data: deleted, error: delErr } = await supabase
    .from('documents')
    .delete()
    .in('id', ids)
    .select('storage_path');
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }
  const rows = (deleted as Pick<Document, 'storage_path'>[] | null) ?? [];

  // Storage objects can't be removed from SQL — clean them up after the rows.
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from('documents').remove(paths);
  }

  return NextResponse.json({ deleted: rows.length }, { headers: AI_CORS_HEADERS });
}
