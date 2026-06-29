import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { extractDocument, extractOrderDocument, aiConfigured } from '@/lib/ai/anthropic';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
import type { Document } from '@/lib/platform/types';

// Multi-page statements with many line items can take a while to parse.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/** Build initials for a supplier name ("Bacca Valley (Pty) Ltd" → "BV"). */
function supplierInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || name.slice(0, 2).toUpperCase();
}

/**
 * Resolve an extracted supplier name to a suppliers row id for the org, creating
 * the row when it's new. Matches case-insensitively on the trading name so the
 * same counterparty across documents reuses one supplier. Returns the id.
 */
async function resolveSupplierId(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({ org_id: orgId, name: trimmed, initials: supplierInitials(trimmed) })
    .select('id')
    .single();
  if (error || !created) throw error ?? new Error('Could not create supplier');
  return (created as { id: string }).id;
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

  // ORDER documents (uploaded customer orders — WhatsApp/email/handwritten) use a
  // different reader and build an OrderFlow order instead of feeding stock.
  if (doc.document_type === 'order') {
    let order;
    try {
      order = await extractOrderDocument({ base64, mediaType, filename: doc.filename });
    } catch (err) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Extraction failed' },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }

    // A model/JSON failure reads as empty — surface it (error + retry in the inbox)
    // rather than silently filing a blank order. Mirrors the non-order path.
    if (!order.customer_name && order.line_items.length === 0) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: 'Could not read an order from this document.' },
        { status: 422, headers: AI_CORS_HEADERS },
      );
    }

    const { error: updErr } = await supabase
      .from('documents')
      .update({
        status: 'extracted',
        confidence: order.overall_confidence,
        document_type: 'order',
        extracted_data: {
          fields: [],
          line_items: order.line_items,
          customer_name: order.customer_name,
          customer_confidence: order.customer_confidence,
        },
      })
      .eq('id', doc.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500, headers: AI_CORS_HEADERS });
    }

    // Build the OrderFlow order — auto-invoices when the customer is confidently
    // matched, else holds as a draft for review (best-effort; never fail extraction).
    let orderSync = null;
    try {
      orderSync = await syncOrderFromDocument(supabase, { documentId: doc.id, orgId: doc.org_id });
    } catch {
      /* swallow — extraction already succeeded */
    }
    return NextResponse.json({ ok: true, order, orderSync }, { headers: AI_CORS_HEADERS });
  }

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

  // Resolve (or create) the extracted supplier into a suppliers row and link the
  // document, so the inbox, supplier intel and the ProcurePulse feed all see a
  // real counterparty. Best-effort — never block extraction on this.
  let supplierId = doc.supplier_id;
  if (result.supplier) {
    try {
      supplierId = await resolveSupplierId(supabase, doc.org_id, result.supplier);
    } catch {
      /* keep the existing supplier_id */
    }
  }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: result.overall_confidence,
      extracted_data: {
        fields: result.fields,
        line_items: result.line_items,
        summary: result.summary,
        supplier: result.supplier,
      },
      document_type: documentType,
      ...(supplierId && supplierId !== doc.supplier_id ? { supplier_id: supplierId } : {}),
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
        supplier_id: supplierId,
        extracted_data: {
          fields: result.fields,
          line_items: result.line_items,
          supplier: result.supplier,
        },
      });
    }
  } catch {
    /* swallow — extraction already succeeded */
  }

  return NextResponse.json({ ok: true, result, feed }, { headers: AI_CORS_HEADERS });
}
