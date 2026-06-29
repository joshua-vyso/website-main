import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';

// Matching + pricing + stock touch a handful of rows — give it room.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Build (or re-sync) an OrderFlow order from an uploaded order document.
 * Body: { documentId, customerId?, finalize? }.
 *  - customerId: a customer the user picked in Doc-U review (overrides auto-match).
 *  - finalize: force the order to 'invoiced' (review "confirm"); otherwise the
 *    order auto-invoices only when the customer is confidently matched.
 * Auth via cookie (web) or Bearer (mobile); RLS scopes to the caller's org.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as {
    documentId?: string;
    customerId?: string | null;
    finalize?: boolean;
  };
  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  // The document row carries org_id; resolve it through RLS.
  const { data: doc } = await supabase.from('documents').select('org_id').eq('id', body.documentId).maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404, headers: AI_CORS_HEADERS });
  }
  const orgId = (doc as { org_id: string }).org_id;

  // A supplied customerId must belong to this document's org (the query is RLS-scoped,
  // so a foreign id resolves to null) — never stamp a foreign customer onto the order.
  if (body.customerId) {
    const { data: cust } = await supabase
      .from('of_customers')
      .select('id')
      .eq('id', body.customerId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!cust) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: AI_CORS_HEADERS });
    }
  }

  try {
    const result = await syncOrderFromDocument(supabase, {
      documentId: body.documentId,
      orgId,
      customerId: body.customerId ?? null,
      finalize: body.finalize === true,
    });
    if (!result.ok) {
      const msg =
        result.reason === 'migration-needed'
          ? 'Order documents need a one-time database update — run the of-order-source-doc migration in Supabase.'
          : result.reason ?? 'Could not build the order.';
      return NextResponse.json({ error: msg }, { status: 500, headers: AI_CORS_HEADERS });
    }
    return NextResponse.json(result, { headers: AI_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Order sync failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
}
