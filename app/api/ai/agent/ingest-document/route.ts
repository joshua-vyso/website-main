import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';
import { extractDocument, extractOrderDocument, aiConfigured } from '@/lib/ai/anthropic';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import { isUniqueViolation } from '@/lib/platform/db-errors';

// Classification + extraction + (for orders) invoicing can chain a few calls.
export const maxDuration = 60;

// ~13 MB decoded (base64 is ~4/3 the byte size). Images are downscaled client-side.
const MAX_BASE64_CHARS = 18_000_000;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/** Initials for a supplier name ("Bacca Valley (Pty) Ltd" → "BV"). */
function supplierInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || name.slice(0, 2).toUpperCase();
}

/** Resolve (or create) a suppliers row for the org by name. Mirrors /api/ai/extract. */
async function resolveSupplierId(supabase: SupabaseClient, orgId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  const findExisting = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', trimmed)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({ org_id: orgId, name: trimmed, initials: supplierInitials(trimmed) })
    .select('id')
    .single();
  if (created) return (created as { id: string }).id;
  // Lost a create race against the (org_id, lower(name)) unique index — re-read the winner.
  if (isUniqueViolation(error)) {
    const winner = await findExisting();
    if (winner) return winner;
  }
  throw error ?? new Error('Could not create supplier');
}

/** The org's "Orders" Doc-U folder id (created on first use). Uses limit(1)
 *  rather than maybeSingle() so a pre-existing duplicate folder can't turn the
 *  lookup into a multi-row error that keeps re-creating the folder. */
async function ordersFolderId(supabase: SupabaseClient, orgId: string, userId: string): Promise<string | null> {
  const findExisting = async () => {
    const { data } = await supabase
      .from('document_folders')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', 'Orders')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('document_folders')
    .insert({ org_id: orgId, name: 'Orders', created_by: userId })
    .select('id')
    .maybeSingle();
  if (created) return (created as { id: string }).id;
  // Lost a create race against the unique index — re-read the winning folder.
  if (isUniqueViolation(error)) return await findExisting();
  return null;
}

/**
 * Vyso AI — ingest a document uploaded in the chat: classify it (order / invoice /
 * statement / delivery note / price list), FILE it into Doc-U (upload + a
 * documents row + extracted fields), and — when it's a customer order — build the
 * OrderFlow order, auto-invoicing when the customer is confidently matched and the
 * lines are priced (else holding a draft for review, exactly like the "Upload
 * order" button). Preview-gated to VYSO_AI_EMAILS. All writes run on the caller's
 * RLS-scoped client, so it can only ever touch their own org.
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

  // 1. Classify (+ generic extract). One Haiku call decides the document type.
  let cls;
  try {
    cls = await extractDocument({ base64, mediaType, filename });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read this document.' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
  const documentType = cls.document_type;
  const isOrder = documentType === 'order';

  // 2. Upload the file to the private "documents" bucket (same as Upload order).
  const safeName = filename.replace(/[^\w.\-() ]+/g, '_');
  const storagePath = `${orgId}/${randomUUID()}_${safeName}`;
  const bytes = Buffer.from(base64, 'base64');
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: mediaType || 'application/octet-stream', upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `Could not save the file: ${upErr.message}` }, { status: 500, headers: AI_CORS_HEADERS });
  }

  // 3. Insert the Doc-U documents row (Orders folder for orders).
  const folderId = isOrder ? await ordersFolderId(supabase, orgId, auth.userId) : null;
  const { data: inserted, error: insErr } = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      filename,
      status: 'pending',
      storage_path: storagePath,
      uploaded_by: auth.userId,
      document_type: documentType,
      ...(folderId ? { folder_id: folderId } : {}),
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: `Could not file the document: ${insErr?.message ?? 'unknown error'}` },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
  const documentId = (inserted as { id: string }).id;

  // 4a. ORDER → read with the order reader, then build the OrderFlow order
  //     (auto-invoice when confident, else a draft to review).
  if (isOrder) {
    const { data: catalogueRows } = await supabase
      .from('pp_stock_items')
      .select('name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    const products = ((catalogueRows ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean);

    let order;
    try {
      order = await extractOrderDocument({ base64, mediaType, filename, products, note });
    } catch (err) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not read the order.' },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }
    if (!order.customer_name && order.line_items.length === 0) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return NextResponse.json(
        { error: "I filed the document, but couldn't read an order from it." },
        { status: 422, headers: AI_CORS_HEADERS },
      );
    }
    await supabase
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
      .eq('id', documentId);

    let orderSync = null;
    try {
      orderSync = await syncOrderFromDocument(supabase, { documentId, orgId });
    } catch {
      /* extraction + filing already succeeded — surface a review path below */
    }
    return NextResponse.json(
      {
        ok: true,
        documentId,
        documentType: 'order',
        customerName: order.customer_name,
        itemCount: order.line_items.length,
        orderSync,
      },
      { headers: AI_CORS_HEADERS },
    );
  }

  // 4b. NON-ORDER → store the extracted fields, resolve the supplier, feed
  //     ProcurePulse. Reuses the classification result (no second model call).
  let supplierId: string | null = null;
  if (cls.supplier) {
    try {
      supplierId = await resolveSupplierId(supabase, orgId, cls.supplier);
    } catch {
      /* keep it unlinked */
    }
  }
  await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: cls.overall_confidence,
      document_type: documentType,
      extracted_data: { fields: cls.fields, line_items: cls.line_items, summary: cls.summary, supplier: cls.supplier },
      ...(supplierId ? { supplier_id: supplierId } : {}),
    })
    .eq('id', documentId);

  try {
    if (await orgHasProcurePulse(supabase, orgId)) {
      await feedDocumentToProcurePulse(supabase, {
        id: documentId,
        org_id: orgId,
        filename,
        document_type: documentType,
        supplier_id: supplierId,
        extracted_data: { fields: cls.fields, line_items: cls.line_items, supplier: cls.supplier },
      });
    }
  } catch {
    /* best-effort — filing already succeeded */
  }

  return NextResponse.json(
    { ok: true, documentId, documentType, supplier: cls.supplier ?? null, itemCount: cls.line_items.length },
    { headers: AI_CORS_HEADERS },
  );
}
