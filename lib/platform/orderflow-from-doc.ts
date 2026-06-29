/**
 * Turn an uploaded customer ORDER document (Doc-U, document_type='order') into a
 * real OrderFlow order: match the customer, price each line (document price first,
 * else the customer's price list), upsert one order per source document, and —
 * when the customer is known — finalise it to 'invoiced' (so PricePilot sees the
 * sale) and decrement stock. Idempotent: re-running re-prices + re-applies stock.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedData } from './types';
import { invoiceNumber } from './orderflow';

export interface CustomerLite {
  id: string;
  name: string;
}

/** Match confidence (0–100) at/above which we auto-link + auto-invoice. */
export const CUSTOMER_CONFIDENT = 80;

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Best-effort match of an extracted customer name to an existing customer. */
export function matchCustomer(
  name: string | null | undefined,
  customers: CustomerLite[],
): { customerId: string | null; confidence: number } {
  const n = normName((name ?? '').trim());
  if (!n) return { customerId: null, confidence: 0 };
  for (const c of customers) if (normName(c.name) === n) return { customerId: c.id, confidence: 100 };
  for (const c of customers) {
    const cn = normName(c.name);
    if (!cn || !(cn.includes(n) || n.includes(cn))) continue;
    // Only treat containment as confident when the names are close in length — so
    // "abc" doesn't auto-link "abc wholesale", but "abc wholesale" ≈ "abc wholesale ltd" does.
    const ratio = Math.min(n.length, cn.length) / Math.max(n.length, cn.length);
    if (ratio >= 0.6) return { customerId: c.id, confidence: 85 };
  }
  const tokens = new Set(n.split(' ').filter(Boolean));
  let best: { id: string; score: number } | null = null;
  for (const c of customers) {
    const ct = normName(c.name).split(' ').filter(Boolean);
    if (!ct.length) continue;
    const overlap = ct.filter((t) => tokens.has(t)).length;
    const score = overlap / Math.max(ct.length, 1);
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  if (best && best.score >= 0.5) return { customerId: best.id, confidence: Math.round(55 + best.score * 25) };
  return { customerId: null, confidence: 0 };
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const likeEscape = (s: string): string => s.replace(/[%_\\]/g, (m) => `\\${m}`);

export interface SyncResult {
  ok: boolean;
  orderId?: string;
  status?: string;
  invoice_number?: string | null;
  customerId?: string | null;
  matchConfidence?: number;
  /** True when the order was held (not invoiced) — uncertain customer or unpriced lines. */
  needsCustomerReview?: boolean;
  /** Lines with no document price and no resolvable price-list/base price. */
  unpricedLines?: number;
  itemCount?: number;
  reason?: string;
}

type DB = SupabaseClient;

async function adjustOnHand(db: DB, deltaByItem: Map<string, number>) {
  const ids = [...deltaByItem.keys()];
  if (!ids.length) return;
  const { data } = await db.from('pp_stock_items').select('id, on_hand').in('id', ids);
  for (const row of (data ?? []) as { id: string; on_hand: number }[]) {
    await db
      .from('pp_stock_items')
      .update({ on_hand: Math.max(0, Number(row.on_hand) + (deltaByItem.get(row.id) ?? 0)) })
      .eq('id', row.id);
  }
}

/** Reverse this order's prior stock movements, then apply fresh ones if invoiced. */
async function syncStock(db: DB, orgId: string, orderId: string, invoiced: boolean, invoice: string | null) {
  const { data: existing, error } = await db
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('org_id', orgId)
    .eq('order_id', orderId);
  if (!error && existing && existing.length) {
    const restore = new Map<string, number>();
    for (const m of existing as { stock_item_id: string; change: number }[]) {
      restore.set(m.stock_item_id, (restore.get(m.stock_item_id) ?? 0) - Number(m.change));
    }
    await adjustOnHand(db, restore);
    await db.from('pp_movements').delete().eq('org_id', orgId).eq('order_id', orderId);
  }
  if (!invoiced) return;

  const { data: itemRows } = await db.from('of_order_items').select('stock_item_id, qty').eq('order_id', orderId);
  const lines = ((itemRows ?? []) as { stock_item_id: string | null; qty: number }[]).filter(
    (l) => l.stock_item_id && Number(l.qty) > 0,
  );
  if (!lines.length) return;

  const label = invoice ? `Sold · ${invoice}` : 'Sold to customer';
  const now = new Date().toISOString();
  const base = (reason: string) =>
    lines.map((l) => ({
      org_id: orgId,
      stock_item_id: l.stock_item_id,
      change: -(Number(l.qty) || 0),
      reason,
      source_label: label,
      occurred_at: now,
    }));
  const withOrder = (reason: string) => base(reason).map((r) => ({ ...r, order_id: orderId }));
  const attempts = [withOrder('sale'), base('sale'), withOrder('used'), base('used')];
  let moveErr: { message?: string } | null = { message: 'init' };
  for (const rows of attempts) {
    ({ error: moveErr } = await db.from('pp_movements').insert(rows));
    if (!moveErr) break;
  }
  if (moveErr) return; // best-effort — the order still stands
  const dec = new Map<string, number>();
  for (const l of lines) dec.set(l.stock_item_id as string, (dec.get(l.stock_item_id as string) ?? 0) - (Number(l.qty) || 0));
  await adjustOnHand(db, dec);
}

export async function syncOrderFromDocument(
  db: DB,
  params: { documentId: string; orgId: string; customerId?: string | null; finalize?: boolean },
): Promise<SyncResult> {
  const { documentId, orgId } = params;

  const { data: docRow } = await db
    .from('documents')
    .select('id, extracted_data')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!docRow) return { ok: false, reason: 'doc-not-found' };
  const ed = ((docRow as { extracted_data?: ExtractedData }).extracted_data ?? {}) as ExtractedData;
  const lines = ed.line_items ?? [];

  // Resolve customer — an explicit pick (from review) wins; else fuzzy-match.
  const { data: custRows } = await db.from('of_customers').select('id, name').eq('org_id', orgId);
  const customers = (custRows ?? []) as CustomerLite[];
  let customerId = params.customerId ?? null;
  let matchConfidence = customerId ? 100 : 0;
  if (!customerId) {
    const m = matchCustomer(ed.customer_name, customers);
    customerId = m.customerId;
    matchConfidence = m.confidence;
  }
  const customerKnown = !!customerId && matchConfidence >= CUSTOMER_CONFIDENT;

  // Pricing: document price first; otherwise the customer's price list.
  type PriceListRow = { id: string; default_margin_pct: number };
  let priceList: PriceListRow | null = null;
  const overrideByItem = new Map<string, number>();
  if (customerId) {
    const { data: pls } = await db
      .from('pl_price_lists')
      .select('id, default_margin_pct')
      .eq('org_id', orgId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });
    priceList = ((pls as PriceListRow[] | null)?.[0]) ?? null;
    if (priceList) {
      const { data: ov } = await db.from('pl_overrides').select('stock_item_id, margin_pct').eq('price_list_id', priceList.id);
      for (const o of (ov ?? []) as { stock_item_id: string; margin_pct: number }[]) {
        overrideByItem.set(o.stock_item_id, Number(o.margin_pct));
      }
    }
  }

  const items: { stock_item_id: string | null; name: string; qty: number; unit: string | null; unit_price: number }[] = [];
  let unpricedLines = 0;
  for (const li of lines) {
    const name = (li.description ?? '').trim();
    if (!name) continue;
    const qty = num(li.quantity) ?? 0;
    const { data: stock } = await db
      .from('pp_stock_items')
      .select('id, avg_unit_price, unit')
      .eq('org_id', orgId)
      .ilike('name', likeEscape(name))
      .maybeSingle();
    const s = stock as { id: string; avg_unit_price: number | null; unit: string | null } | null;
    const basePrice = s?.avg_unit_price != null ? Number(s.avg_unit_price) : null;
    let unitPrice = num(li.unit_price);
    let priced = unitPrice != null; // a real price came off the document
    if (unitPrice == null) {
      if (priceList && basePrice != null && s) {
        const margin = overrideByItem.has(s.id) ? overrideByItem.get(s.id)! : Number(priceList.default_margin_pct ?? 0);
        unitPrice = Math.round(basePrice * (1 + margin / 100) * 100) / 100;
        priced = true;
      } else if (basePrice != null) {
        unitPrice = basePrice;
        priced = true;
      } else {
        unitPrice = 0; // no price on the doc, no stock match, no price list — unresolved
      }
    }
    if (!priced) unpricedLines += 1;
    items.push({ stock_item_id: s?.id ?? null, name, qty, unit: (li.unit ?? '').trim() || s?.unit || null, unit_price: unitPrice });
  }

  // Auto-invoice only when the customer is known AND every line has a real price.
  // An explicit "Confirm & invoice" (params.finalize) always wins — the human has
  // seen and can edit the prices. Anything else holds as a draft for review.
  const finalize = params.finalize === true ? true : customerKnown && unpricedLines === 0;

  // Upsert one order per source document.
  const { data: existingOrder, error: lookupErr } = await db
    .from('of_orders')
    .select('id, invoice_number')
    .eq('source_document_id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (lookupErr) {
    // The source_document_id column isn't there yet (of-order-source-doc migration
    // not applied). Without it we can't dedup, and a blind insert would create a
    // duplicate invoiced sale + double stock decrement on the next re-sync — so do
    // nothing here (extraction already succeeded; the order builds once migrated).
    return { ok: false, reason: 'migration-needed' };
  }
  let orderId = (existingOrder as { id: string } | null)?.id ?? null;
  let inv = (existingOrder as { invoice_number: string | null } | null)?.invoice_number ?? null;
  const status = finalize ? 'invoiced' : 'draft';
  if (finalize && !inv) {
    const { count } = await db
      .from('of_orders')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('invoice_number', 'is', null);
    inv = invoiceNumber((count ?? 0) + 1);
  }

  if (orderId) {
    await db.from('of_orders').update({ customer_id: customerId, status, invoice_number: inv }).eq('id', orderId);
    await db.from('of_order_items').delete().eq('order_id', orderId);
  } else {
    const { data: created, error: insErr } = await db
      .from('of_orders')
      .insert({ org_id: orgId, customer_id: customerId, status, invoice_number: inv, source_document_id: documentId })
      .select('id')
      .single();
    if (insErr || !created) return { ok: false, reason: insErr?.message ?? 'order-insert-failed' };
    orderId = (created as { id: string }).id;
  }

  if (items.length > 0) {
    await db.from('of_order_items').insert(
      items.map((i) => ({
        org_id: orgId,
        order_id: orderId,
        stock_item_id: i.stock_item_id,
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        unit_price: i.unit_price,
      })),
    );
  }

  await syncStock(db, orgId, orderId, status === 'invoiced', inv);

  return {
    ok: true,
    orderId,
    status,
    invoice_number: inv,
    customerId,
    matchConfidence,
    // Held (draft) for any reason — uncertain customer or an unpriced line — so the
    // caller routes the user into Doc-U review to confirm/price before invoicing.
    needsCustomerReview: !finalize,
    unpricedLines,
    itemCount: items.length,
  };
}
