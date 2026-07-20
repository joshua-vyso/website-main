import type { SupabaseClient } from '@supabase/supabase-js';
import { docTotal } from '@/lib/platform/docu/extract';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import type { DocumentType, ExtractedData } from '@/lib/platform/types';

/**
 * SupplySync feed — the write path that keeps a supplier's SupplySync profile
 * in step with the documents Doc-U files against it (see
 * docs/plans/docu-supplysync-invoice-linking.md).
 *
 * Identity model: the core `suppliers` row is canonical (documents, ProcurePulse
 * and OrderFlow key on it); `ss_suppliers.supplier_id` bridges it to the
 * SupplySync profile, which this module creates on first contact.
 *
 * Everything here is derived intelligence, recomputed from `documents` on every
 * feed — so a missed run heals itself on the next commit for the same supplier,
 * and re-running (review-queue retries are part of the commit contract) never
 * double-counts. History events are deduped per (document_id, event_type) by a
 * unique index.
 */

/** Lookup key for supplier names: lowercased, punctuation collapsed, common
 *  legal suffixes dropped ("Bacca Valley (Pty) Ltd" → "bacca valley"). */
export function normalizeSupplierName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\b(pty|ltd|cc|inc|bpk|edms|limited|proprietary)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Neutralise wildcards so an extracted (attacker-controlled) supplier name is
 * matched LITERALLY by a PostgREST `.ilike()`. Without this a name containing a
 * wildcard is a pattern — "%" or "*" matches every supplier, mislinking a
 * document and poisoning a real supplier's rollups.
 *
 * Two wildcard layers must be closed:
 *   - PostgREST aliases `*` → `%` in like/ilike (before SQL sees it), so fold
 *     `*` to `%` first, leaving NO bare `*` for PostgREST to re-expand.
 *   - SQL LIKE then treats `%`, `_` and the escape char `\` specially, so
 *     backslash-escape those. `\` is escaped in the same pass (single regex over
 *     original positions), so nothing is double-escaped.
 * A literal `*` therefore ends up matching a literal `%` (a harmless miss that
 * just creates a fresh supplier) — real produce names carry none of these.
 */
export function escapeLike(s: string): string {
  return s.replace(/\*/g, '%').replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The org's confirmed/dismissed ruling for an extracted supplier name, if any. */
export async function lookupSupplierAlias(
  supabase: SupabaseClient,
  orgId: string,
  rawName: string,
): Promise<{ supplierId: string | null; status: 'confirmed' | 'dismissed' } | null> {
  const normalized = normalizeSupplierName(rawName);
  if (!normalized) return null;
  const { data } = await supabase
    .from('supplier_aliases')
    .select('supplier_id, status')
    .eq('org_id', orgId)
    .eq('normalized_name', normalized)
    .maybeSingle<{ supplier_id: string | null; status: string }>();
  if (!data) return null;
  return {
    supplierId: data.supplier_id,
    status: data.status === 'dismissed' ? 'dismissed' : 'confirmed',
  };
}

/**
 * Ensure a SupplySync profile exists for a core supplier and return its ss id.
 * Adopts an unbridged same-name profile (seeded rows) before creating a minimal
 * one. Race-safe the same way resolveSupplierId is: losing the insert race to
 * the (org_id, supplier_id) unique index re-selects the winner.
 */
export async function ensureSupplySyncProfile(
  supabase: SupabaseClient,
  orgId: string,
  supplierId: string,
  name: string,
): Promise<string | null> {
  const findBridged = async () => {
    const { data } = await supabase
      .from('ss_suppliers')
      .select('id')
      .eq('org_id', orgId)
      .eq('supplier_id', supplierId)
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };

  const bridged = await findBridged();
  if (bridged) return bridged;

  // Adopt a seeded/unbridged profile with the same name rather than duplicating it.
  // escapeLike: the name is extracted from document content, so treat wildcards
  // (% _) as literals, not patterns.
  const { data: unbridged } = await supabase
    .from('ss_suppliers')
    .select('id')
    .eq('org_id', orgId)
    .is('supplier_id', null)
    .ilike('name', escapeLike(name.trim()))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const adoptId = (unbridged as { id: string } | null)?.id ?? null;
  if (adoptId) {
    const { data: adopted } = await supabase
      .from('ss_suppliers')
      .update({ supplier_id: supplierId })
      .eq('id', adoptId)
      .eq('org_id', orgId)
      .is('supplier_id', null) // only claim it if still free
      .select('id')
      .maybeSingle();
    if (adopted) return adoptId;
    return await findBridged(); // someone else bridged meanwhile
  }

  const { data: created, error } = await supabase
    .from('ss_suppliers')
    .insert({ org_id: orgId, supplier_id: supplierId, name: name.trim(), category: 'General' })
    .select('id')
    .single();
  if (created) return (created as { id: string }).id;
  if (isUniqueViolation(error)) return await findBridged();
  throw error ?? new Error('Could not create the SupplySync profile');
}

const HISTORY_EVENT_BY_TYPE: Partial<Record<Exclude<DocumentType, null>, string>> = {
  invoice: 'invoice_received',
  statement: 'statement_received',
  delivery_note: 'delivery_note_received',
  price_list: 'price_list_received',
};

const DOC_LABEL: Partial<Record<Exclude<DocumentType, null>, string>> = {
  invoice: 'Invoice',
  statement: 'Statement',
  delivery_note: 'Delivery note',
  price_list: 'Price list',
};

/** Document types that represent an actual billed amount (used for spend
 *  rollups). Excludes price_list (no purchase) and delivery_note (duplicates an
 *  invoice's amounts). A supplier bills via invoice OR statement, not both. */
const SPEND_DOC_TYPES = ['invoice', 'statement'] as const;

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });

/**
 * Whether the org has the SupplySync ('suppliers') module available.
 *
 * The app forces every feature ON in getPlatformSession and gates modules ONLY
 * through `organisations.locked_modules` — `org_features.enabled` is NOT the
 * source of truth (most orgs, e.g. Turn 'n Slice, have no enabled 'suppliers'
 * row at all). So "has SupplySync" means: not explicitly locked. This mirrors
 * how the sidebar and route guards decide access.
 */
export async function orgHasSupplySync(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organisations')
    .select('locked_modules')
    .eq('id', orgId)
    .maybeSingle<{ locked_modules: string[] | null }>();
  return !(data?.locked_modules ?? []).includes('suppliers');
}

/**
 * Feed one committed document into SupplySync: ensure the profile, add the
 * timeline event (deduped per document), and recompute the spend rollups from
 * the org's documents. Orders are OrderFlow's business and are skipped.
 *
 * Idempotent per document; a real DB error throws and the CALLER decides how
 * fatal that is (the ingest pipeline treats it as best-effort — supplier
 * intelligence must never block the money path).
 */
export async function feedDocumentToSupplySync(
  supabase: SupabaseClient,
  doc: {
    id: string;
    org_id: string;
    document_type: DocumentType | null;
    filename: string;
    supplier_id: string | null;
    extracted_data: ExtractedData | null;
    created_at?: string | null;
  },
): Promise<{ fed: boolean; reason?: string }> {
  if (doc.document_type === 'order') return { fed: false, reason: 'orders-route-to-orderflow' };
  if (!doc.supplier_id) return { fed: false, reason: 'no-supplier' };

  const { data: sup } = await supabase
    .from('suppliers')
    .select('name')
    .eq('id', doc.supplier_id)
    .eq('org_id', doc.org_id)
    .maybeSingle<{ name: string }>();
  if (!sup?.name) return { fed: false, reason: 'supplier-not-found' };

  const ssId = await ensureSupplySyncProfile(supabase, doc.org_id, doc.supplier_id, sup.name);
  if (!ssId) return { fed: false, reason: 'no-profile' };

  // Timeline event — one per (document, event type), enforced by the unique index.
  const eventType = (doc.document_type && HISTORY_EVENT_BY_TYPE[doc.document_type]) ?? 'document_received';
  const label = (doc.document_type && DOC_LABEL[doc.document_type]) ?? 'Document';
  const total = docTotal(doc);
  const eventDate = (doc.created_at ?? new Date().toISOString()).slice(0, 10);
  const { error: histErr } = await supabase.from('ss_supplier_history').upsert(
    {
      org_id: doc.org_id,
      supplier_id: ssId,
      document_id: doc.id,
      event_type: eventType,
      summary: `${label} "${doc.filename}" filed via Doc-U${total != null ? ` — ${zar.format(total)}` : ''}`,
      event_date: eventDate,
    },
    { onConflict: 'document_id,event_type', ignoreDuplicates: true },
  );
  if (histErr) throw histErr;

  // Rollups — recomputed from the document base, never incremented. SPEND counts
  // only billed documents (invoice/statement): a price_list carries per-item
  // prices but zero purchase, and delivery notes duplicate an invoice's amounts —
  // counting either would inflate the figures docTotal derives from line amounts.
  const { data: docRows, error: docsErr } = await supabase
    .from('documents')
    .select('created_at, extracted_data')
    .eq('org_id', doc.org_id)
    .eq('supplier_id', doc.supplier_id)
    .in('document_type', SPEND_DOC_TYPES)
    .not('status', 'in', '(rejected,archived,error)');
  if (docsErr) throw docsErr;

  const rows = (docRows ?? []) as { created_at: string | null; extracted_data: ExtractedData | null }[];
  const thisMonth = new Date().toISOString().slice(0, 7);
  let spendMtd = 0;
  let totalSpend = 0;
  const months = new Set<string>();
  let lastOrder: string | null = null;
  for (const r of rows) {
    const amount = docTotal(r) ?? 0;
    totalSpend += amount;
    const day = (r.created_at ?? '').slice(0, 10);
    if (day) {
      months.add(day.slice(0, 7));
      if (day.slice(0, 7) === thisMonth) spendMtd += amount;
      if (!lastOrder || day > lastOrder) lastOrder = day;
    }
  }
  const avgMonthly = months.size > 0 ? Math.round(totalSpend / months.size) : 0;

  const { error: rollErr } = await supabase
    .from('ss_suppliers')
    .update({
      spend_mtd: Math.round(spendMtd),
      avg_monthly_spend: avgMonthly,
      ...(lastOrder ? { last_order: lastOrder } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ssId)
    .eq('org_id', doc.org_id);
  if (rollErr) throw rollErr;

  return { fed: true };
}
