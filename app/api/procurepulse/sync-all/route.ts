import { NextResponse } from 'next/server';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AI_CORS_HEADERS } from '@/lib/ai/auth';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import type { Document } from '@/lib/platform/types';

export const maxDuration = 60;

// Doc types whose lines represent stock received (mirrors the feed's FEED_TYPES).
const FEED_TYPES = ['invoice', 'statement', 'delivery_note'];
const MAX_FEED = 40;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Push any extracted Doc-U statements/invoices that haven't fed ProcurePulse yet
 * (no movements for their source_document_id). Called by the Live stock page on
 * load + every 5 min so new documents flow in automatically. Idempotent.
 */
export async function POST() {
  const session = await getPlatformSession();
  if (!session?.org?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const orgId = session.org.id;
  const db = await createServerSupabase();

  if (!(await orgHasProcurePulse(db, orgId))) {
    return NextResponse.json({ ok: true, fed: 0, reason: 'feature-off' }, { headers: AI_CORS_HEADERS });
  }

  const { data: docs } = await db
    .from('documents')
    .select('id, org_id, filename, document_type, supplier_id, extracted_data')
    .eq('org_id', orgId)
    .in('document_type', FEED_TYPES)
    .not('extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(120);
  const list = (docs ?? []) as Pick<
    Document,
    'id' | 'org_id' | 'filename' | 'document_type' | 'supplier_id' | 'extracted_data'
  >[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, fed: 0, scanned: 0 }, { headers: AI_CORS_HEADERS });
  }

  // Which of these already have movements (i.e. already fed)?
  const ids = list.map((d) => d.id);
  const { data: moves } = await db
    .from('pp_movements')
    .select('source_document_id')
    .in('source_document_id', ids);
  const fedSet = new Set(
    ((moves ?? []) as { source_document_id: string | null }[])
      .map((m) => m.source_document_id)
      .filter(Boolean),
  );
  const unfed = list.filter((d) => !fedSet.has(d.id)).slice(0, MAX_FEED);

  let fed = 0;
  for (const d of unfed) {
    try {
      const res = await feedDocumentToProcurePulse(db, d);
      if (res.fed) fed += 1;
    } catch {
      /* best-effort — a single bad doc must not fail the sync */
    }
  }

  return NextResponse.json({ ok: true, fed, scanned: list.length }, { headers: AI_CORS_HEADERS });
}
