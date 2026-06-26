import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document, ExtractedLineItem } from './types';

/**
 * Doc-U → ProcurePulse feed.
 *
 * Turns a document's extracted product lines into live ProcurePulse stock:
 * for each line it matches-or-creates a stock item by name, records a received
 * movement, and updates the on-hand level, latest price and cheapest supplier.
 *
 * It is IDEMPOTENT per document: every movement carries `source_document_id`,
 * so re-feeding the same document first removes that document's prior
 * contribution and re-applies the current line items — correcting an extraction
 * and re-syncing never double-counts stock.
 *
 * All writes go through the caller's RLS-scoped client, so they only succeed
 * for the caller's own org with the `procurepulse` feature enabled.
 */

/** Document types whose lines represent stock received into inventory. */
const FEED_TYPES = new Set(['invoice', 'statement', 'delivery_note']);

export interface FeedResult {
  fed: boolean;
  reason?: string;
  itemsAffected: number;
  movementsWritten: number;
}

/**
 * Parse a loose numeric string ("1 240.50", "R78", "12") to a number, or null.
 * Uses Number() (not parseFloat) so malformed values like "5-", "1-2", "1.2.3"
 * reject to null instead of silently truncating — matching parseAmount in
 * lib/platform/docu/extract.ts.
 */
function parseNum(s: string | undefined | null): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Positive price, or null — never let a negative/zero price reach pricing. */
function parsePrice(s: string | undefined | null): number | null {
  const n = parseNum(s);
  return n != null && n > 0 ? n : null;
}

/** Escape LIKE wildcards so a product name is matched literally (case-insensitively). */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Build a "300g · 12/box"-style pack label from extracted weight (kg) + units. */
function buildPack(weight: string | undefined, unitsPerBox: string | undefined): string | null {
  const w = parseNum(weight);
  const weightLabel = w != null && w > 0 ? (w < 1 ? `${Math.round(w * 1000)}g` : `${w}kg`) : null;
  const upb = (unitsPerBox ?? '').trim();
  if (weightLabel && upb) return `${weightLabel} · ${upb}/box`;
  if (weightLabel) return weightLabel;
  if (upb) return `${upb}/box`;
  return null;
}

/**
 * Recompute the weighted-average kilograms-per-unit for a set of stock items from
 * ALL of their CURRENT feeding documents (read after movements have been applied/
 * reversed, so it reflects the live source set — fixing stale kg after a doc is
 * removed or a later weightless doc arrives). Batched: two reads total regardless
 * of item count. Returns id → kg/unit (or null when no usable weight data remains).
 */
async function computeKgPerUnit(
  supabase: SupabaseClient,
  items: { id: string; name: string }[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (items.length === 0) return result;
  const ids = items.map((i) => i.id);

  const { data: moves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, source_document_id')
    .in('stock_item_id', ids);

  const docIdsByItem = new Map<string, Set<string>>();
  const allDocIds = new Set<string>();
  for (const m of (moves ?? []) as { stock_item_id: string; source_document_id: string | null }[]) {
    if (!m.source_document_id) continue;
    let set = docIdsByItem.get(m.stock_item_id);
    if (!set) {
      set = new Set();
      docIdsByItem.set(m.stock_item_id, set);
    }
    set.add(m.source_document_id);
    allDocIds.add(m.source_document_id);
  }

  const linesByDoc = new Map<string, ExtractedLineItem[]>();
  if (allDocIds.size > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, extracted_data')
      .in('id', [...allDocIds]);
    for (const d of (docs ?? []) as {
      id: string;
      extracted_data: { line_items?: ExtractedLineItem[] } | null;
    }[]) {
      linesByDoc.set(d.id, d.extracted_data?.line_items ?? []);
    }
  }

  for (const it of items) {
    const docSet = docIdsByItem.get(it.id);
    const target = it.name.trim().toLowerCase();
    let totalQty = 0;
    let totalKg = 0;
    if (docSet) {
      for (const docId of docSet) {
        for (const li of linesByDoc.get(docId) ?? []) {
          if ((li.description ?? '').trim().toLowerCase() !== target) continue;
          const q = parseNum(li.quantity);
          if (q == null || q <= 0) continue;
          const w = parseNum(li.weight);
          const tkg = parseNum(li.total_kg);
          // Prefer the canonical per-pack weight (× qty); fall back to total_kg.
          const kg = w != null && w > 0 ? q * w : tkg != null && tkg > 0 ? tkg : null;
          if (kg != null && kg > 0) {
            totalQty += q;
            totalKg += kg;
          }
        }
      }
    }
    result.set(it.id, totalQty > 0 ? totalKg / totalQty : null);
  }
  return result;
}

/**
 * Update a stock item, tolerating the kg_per_unit column not existing yet (the
 * add-kg-per-unit.sql migration may not be applied). If — and only if — the write
 * fails specifically because of that column, retry without it so the core
 * on_hand/price write still lands and self-heals once the migration is applied.
 */
async function applyStockPatch(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('pp_stock_items').update(patch).eq('id', id);
  if (error && 'kg_per_unit' in patch && /kg_per_unit/i.test(error.message ?? '')) {
    const { kg_per_unit: _omit, ...rest } = patch;
    void _omit;
    await supabase.from('pp_stock_items').update(rest).eq('id', id);
  }
}

/** Is the ProcurePulse feature enabled for this org? (cheap pre-check) */
export async function orgHasProcurePulse(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from('org_features')
    .select('enabled')
    .eq('org_id', orgId)
    .eq('feature_key', 'procurepulse')
    .maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

/**
 * Reverse a document's contribution to ProcurePulse — used when the document is
 * deleted. Removes its stock movements and subtracts their net effect from the
 * affected items' on-hand (clamped at 0). Supplier prices have no per-document
 * link, so they are left as-is. Safe to call for docs that never fed stock.
 */
export async function unfeedDocumentFromProcurePulse(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ itemsReversed: number }> {
  const { data: moves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('source_document_id', documentId);
  if (!moves || moves.length === 0) return { itemsReversed: 0 };

  const byItem = new Map<string, number>();
  for (const m of moves as { stock_item_id: string; change: number }[]) {
    byItem.set(m.stock_item_id, (byItem.get(m.stock_item_id) ?? 0) + Number(m.change));
  }
  const itemIds = [...byItem.keys()];

  // Drop this document's movements first…
  await supabase.from('pp_movements').delete().eq('source_document_id', documentId);

  // …then, in ONE query, find which touched items still have movements from
  // other documents. Items absent from that set are now orphaned. (Replaces the
  // old per-item "any movements left?" probe — 1 round-trip instead of M.)
  const { data: survivorRows } = await supabase
    .from('pp_movements')
    .select('stock_item_id')
    .in('stock_item_id', itemIds);
  const survivors = new Set((survivorRows ?? []).map((r) => (r as { stock_item_id: string }).stock_item_id));

  // Orphaned items have no source anymore — remove them in one bulk delete
  // (cascades their supplier prices) so the last feeding document leaves no
  // zombie zero-stock item behind.
  const orphanIds = itemIds.filter((id) => !survivors.has(id));
  if (orphanIds.length > 0) {
    await supabase.from('pp_stock_items').delete().in('id', orphanIds);
  }

  // Survivors are still fed by other documents — reverse their on_hand and
  // recompute kg/unit from their REMAINING feeding docs (this doc's movements are
  // already gone, so a stale kg from the removed doc gets corrected/cleared).
  const survivorIds = itemIds.filter((id) => survivors.has(id));
  if (survivorIds.length > 0) {
    const { data: cur } = await supabase
      .from('pp_stock_items')
      .select('id, name, on_hand')
      .in('id', survivorIds);
    const rows = (cur ?? []) as { id: string; name: string; on_hand: number }[];
    const kgById = await computeKgPerUnit(
      supabase,
      rows.map((r) => ({ id: r.id, name: r.name })),
    );
    await Promise.all(
      rows.map((row) => {
        const next = Math.max(0, Number(row.on_hand) - (byItem.get(row.id) ?? 0));
        return applyStockPatch(supabase, row.id, { on_hand: next, kg_per_unit: kgById.get(row.id) ?? null });
      }),
    );
  }

  return { itemsReversed: byItem.size };
}

type FedDoc = Pick<
  Document,
  'id' | 'org_id' | 'filename' | 'document_type' | 'supplier_id' | 'extracted_data'
>;

export async function feedDocumentToProcurePulse(
  supabase: SupabaseClient,
  doc: FedDoc,
): Promise<FeedResult> {
  const base: FeedResult = { fed: false, itemsAffected: 0, movementsWritten: 0 };

  if (!doc.document_type || !FEED_TYPES.has(doc.document_type)) {
    return { ...base, reason: 'type-not-routed-to-stock' };
  }
  const lineItems: ExtractedLineItem[] = doc.extracted_data?.line_items ?? [];
  if (lineItems.length === 0) {
    return { ...base, reason: 'no-line-items' };
  }

  // Supplier name (for price provenance + movement label).
  let supplierName: string | null = null;
  if (doc.supplier_id) {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', doc.supplier_id)
      .maybeSingle();
    supplierName = (sup as { name?: string } | null)?.name ?? null;
  }

  // 1. This document's PRIOR contribution (from a previous feed), to undo it.
  const { data: priorMoves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('source_document_id', doc.id);
  const priorByItem = new Map<string, number>();
  for (const m of (priorMoves ?? []) as { stock_item_id: string; change: number }[]) {
    priorByItem.set(m.stock_item_id, (priorByItem.get(m.stock_item_id) ?? 0) + Number(m.change));
  }
  if (priorMoves && priorMoves.length > 0) {
    await supabase.from('pp_movements').delete().eq('source_document_id', doc.id);
  }

  // 2. Apply the current line items.
  const newByItem = new Map<string, number>();
  const priceByItem = new Map<string, number>();
  let itemsAffected = 0;
  let movementsWritten = 0;

  for (const li of lineItems) {
    const name = (li.description ?? '').trim();
    if (!name) continue;

    const price = parsePrice(li.unit_price);

    // Match an existing item by name (case-insensitive, literal) within the org,
    // else create. likeEscape stops "%"/"_" in a name acting as LIKE wildcards.
    const { data: existing } = await supabase
      .from('pp_stock_items')
      .select('id')
      .eq('org_id', doc.org_id)
      .ilike('name', likeEscape(name))
      .maybeSingle();

    let itemId = (existing as { id?: string } | null)?.id ?? null;
    if (!itemId) {
      const { data: created, error: createErr } = await supabase
        .from('pp_stock_items')
        .insert({
          org_id: doc.org_id,
          name,
          pack: buildPack(li.weight, li.units_per_box),
          unit: 'boxes',
          on_hand: 0,
          low_threshold: 0,
          avg_unit_price: price,
          currency: 'ZAR',
          source_document_id: doc.id,
        })
        .select('id')
        .single();
      if (createErr || !created) continue; // RLS/feature-gate or bad row — skip
      itemId = (created as { id: string }).id;
    }

    const qty = parseNum(li.quantity) ?? 0;
    if (qty > 0) {
      const { error: moveErr } = await supabase.from('pp_movements').insert({
        org_id: doc.org_id,
        stock_item_id: itemId,
        change: qty,
        reason: 'received',
        source_label: supplierName ?? doc.filename,
        source_document_id: doc.id,
      });
      if (!moveErr) {
        newByItem.set(itemId, (newByItem.get(itemId) ?? 0) + qty);
        movementsWritten += 1;
      }
    }

    if (price != null) priceByItem.set(itemId, price);
    itemsAffected += 1;
  }

  // 3. Reconcile each touched item: on_hand += (new − prior), price, kg, supplier.
  const touched = new Set<string>([...priorByItem.keys(), ...newByItem.keys(), ...priceByItem.keys()]);
  const touchedIds = [...touched];

  // Batch-read the touched items' current level + name in one query (replaces the
  // old per-item on_hand probe), then recompute kg/unit across ALL their feeding
  // docs — movements now reflect this feed, so the average is current, not stale.
  const { data: touchedRows } = touchedIds.length
    ? await supabase.from('pp_stock_items').select('id, name, on_hand').in('id', touchedIds)
    : { data: [] };
  const rowById = new Map(
    ((touchedRows ?? []) as { id: string; name: string; on_hand: number }[]).map((r) => [r.id, r]),
  );
  const kgById = await computeKgPerUnit(
    supabase,
    [...rowById.values()].map((r) => ({ id: r.id, name: r.name })),
  );

  for (const id of touched) {
    const delta = (newByItem.get(id) ?? 0) - (priorByItem.get(id) ?? 0);
    const row = rowById.get(id);

    const patch: Record<string, unknown> = { source_document_id: doc.id };
    // Clamp to >= 0 — stock should never read negative even if data drifts.
    if (row) patch.on_hand = Math.max(0, Number(row.on_hand) + delta);
    if (priceByItem.has(id)) patch.avg_unit_price = priceByItem.get(id);
    // kg/unit recomputed from all current feeding docs (value, or null when no
    // weight data remains — which correctly clears a stale figure).
    if (kgById.has(id)) patch.kg_per_unit = kgById.get(id);

    await applyStockPatch(supabase, id, patch);

    // Supplier price: upsert this supplier's latest price, then recompute cheapest.
    if (supplierName && priceByItem.has(id)) {
      const price = priceByItem.get(id)!;
      const { data: existingSup } = await supabase
        .from('pp_item_suppliers')
        .select('id')
        .eq('stock_item_id', id)
        .eq('supplier_name', supplierName)
        .maybeSingle();
      if (existingSup) {
        await supabase.from('pp_item_suppliers').update({ price }).eq('id', (existingSup as { id: string }).id);
      } else {
        await supabase
          .from('pp_item_suppliers')
          .insert({ org_id: doc.org_id, stock_item_id: id, supplier_name: supplierName, price });
      }
      const { data: cheapest } = await supabase
        .from('pp_item_suppliers')
        .select('supplier_name')
        .eq('stock_item_id', id)
        .order('price', { ascending: true })
        .limit(1);
      const top = (cheapest as { supplier_name: string }[] | null)?.[0];
      if (top) await supabase.from('pp_stock_items').update({ cheapest_supplier: top.supplier_name }).eq('id', id);
    }
  }

  // 4. Notify ProcurePulse that a document was synced.
  if (itemsAffected > 0) {
    const kind = doc.document_type === 'statement' ? 'new_market_statement' : 'new_direct_doc';
    await supabase.from('pp_notifications').insert({
      org_id: doc.org_id,
      kind,
      title: `${itemsAffected} item${itemsAffected === 1 ? '' : 's'} updated from ${doc.filename}`,
      body: supplierName ? `Synced from ${supplierName} via Doc-U` : 'Synced from Doc-U',
      document_id: doc.id,
      read: false,
    });
  }

  return { fed: true, itemsAffected, movementsWritten };
}
