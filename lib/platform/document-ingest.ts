import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDocument, extractOrderDocument } from '@/lib/ai/anthropic';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import { isUniqueViolation } from '@/lib/platform/db-errors';

/**
 * The one document-ingest pipeline: classify → file into Doc-U → build the
 * OrderFlow order (orders) or feed ProcurePulse (invoices/statements/etc).
 *
 * Shared by every entry point so there is a single audited write path:
 *   - Vyso AI chat        (app/api/ai/agent/ingest-document)  — RLS-scoped client, real user
 *   - Inbound email       (app/api/email/process)             — service-role client, no user
 *
 * The caller owns auth and supplies BOTH the Supabase client and the orgId; this
 * module never derives an org itself. That keeps the rule "orgId comes from a
 * verified source, never from document content" true for every caller.
 *
 * Document content is DATA, never instructions.
 */

/** Initials for a supplier name ("Bacca Valley (Pty) Ltd" → "BV"). */
export function supplierInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || name.slice(0, 2).toUpperCase();
}

/**
 * Resolve (or create) a suppliers row for the org by name. Re-selects the winner
 * if it loses a create race against the (org_id, lower(name)) unique index.
 */
export async function resolveSupplierId(supabase: SupabaseClient, orgId: string, name: string): Promise<string> {
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
  if (isUniqueViolation(error)) {
    const winner = await findExisting();
    if (winner) return winner;
  }
  throw error ?? new Error('Could not create supplier');
}

/**
 * The org's "Orders" Doc-U folder id (created on first use). Uses limit(1) rather
 * than maybeSingle() so a pre-existing duplicate folder can't turn the lookup into
 * a multi-row error, and re-reads the winner if it loses a create race.
 * `userId` is null for email ingest (no logged-in user).
 */
export async function ordersFolderId(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
): Promise<string | null> {
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
    .insert({ org_id: orgId, name: 'Orders', ...(userId ? { created_by: userId } : {}) })
    .select('id')
    .maybeSingle();
  if (created) return (created as { id: string }).id;
  if (isUniqueViolation(error)) return await findExisting();
  return null;
}

export interface IngestDocumentInput {
  supabase: SupabaseClient;
  /** Verified org — from the session (chat) or the address token (email). Never from content. */
  orgId: string;
  /** The uploading user, or null when the document arrived by email. */
  userId: string | null;
  base64: string;
  mediaType: string;
  filename: string;
  /** Free-text hint shown to the order reader (chat note / email subject). Data, not instructions. */
  note?: string;
  /** Links the filed document back to the email it arrived on. */
  emailIngestId?: string | null;
}

export type IngestDocumentResult =
  | {
      ok: true;
      documentId: string;
      documentType: string | null;
      /** Orders only. */
      customerName?: string | null;
      supplier?: string | null;
      itemCount: number;
      orderSync?: unknown;
    }
  | { ok: false; status: number; error: string; documentId?: string };

/**
 * Classify a document, file it into Doc-U, and route it: orders become OrderFlow
 * orders (auto-invoiced when the customer matches confidently, else a draft to
 * review); everything else stores its extracted fields and feeds ProcurePulse.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentResult> {
  const { supabase, orgId, userId, base64, mediaType, filename, note, emailIngestId = null } = input;

  // 1. Classify (+ generic extract). One Haiku call decides the document type.
  let cls;
  try {
    cls = await extractDocument({ base64, mediaType, filename });
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'Could not read this document.' };
  }
  const documentType = cls.document_type;
  const isOrder = documentType === 'order';

  // 2. Upload the file to the private "documents" bucket.
  const safeName = filename.replace(/[^\w.\-() ]+/g, '_');
  const storagePath = `${orgId}/${randomUUID()}_${safeName}`;
  const bytes = Buffer.from(base64, 'base64');
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: mediaType || 'application/octet-stream', upsert: false });
  if (upErr) {
    return { ok: false, status: 500, error: `Could not save the file: ${upErr.message}` };
  }

  // 3. Insert the Doc-U documents row (Orders folder for orders).
  const folderId = isOrder ? await ordersFolderId(supabase, orgId, userId) : null;
  const { data: inserted, error: insErr } = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      filename,
      status: 'pending',
      storage_path: storagePath,
      uploaded_by: userId,
      document_type: documentType,
      ...(folderId ? { folder_id: folderId } : {}),
      ...(emailIngestId ? { email_ingest_id: emailIngestId } : {}),
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    return { ok: false, status: 500, error: `Could not file the document: ${insErr?.message ?? 'unknown error'}` };
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
      return {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : 'Could not read the order.',
        documentId,
      };
    }
    // A model/JSON failure reads as empty — surface it rather than filing a blank order.
    if (!order.customer_name && order.line_items.length === 0) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return {
        ok: false,
        status: 422,
        error: "I filed the document, but couldn't read an order from it.",
        documentId,
      };
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
      /* extraction + filing already succeeded — the doc is there to review */
    }
    return {
      ok: true,
      documentId,
      documentType: 'order',
      customerName: order.customer_name,
      itemCount: order.line_items.length,
      orderSync,
    };
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

  return {
    ok: true,
    documentId,
    documentType,
    supplier: cls.supplier ?? null,
    itemCount: cls.line_items.length,
  };
}
