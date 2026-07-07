/**
 * Read-only OrderFlow data access for Vyso AI's tools. Every query runs through
 * the caller's RLS-scoped Supabase client (so the agent can only ever read the
 * caller's own org), and the money maths mirrors the OrderFlow Dashboard exactly
 * (docTotals / paymentsTotal / balanceDue / effectiveInvoiceStatus) so the
 * agent's numbers match what the user sees on screen.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  docTotals,
  paymentsTotal,
  balanceDue,
  effectiveInvoiceStatus,
  zar,
  zar2,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfCustomer,
  type OfOrder,
  type OfOrderItem,
  type InvoiceStatus,
} from '@/lib/platform/orderflow';

interface InvoiceRow {
  inv: OfInvoice;
  total: number;
  paid: number;
  status: InvoiceStatus;
  balance: number;
}

/**
 * Unwrap a Supabase result, throwing (with the table label) on a query error so
 * the tool surfaces WHY it failed instead of silently returning an empty list.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`Could not read ${label}: ${res.error.message}`);
  return (res.data ?? ([] as unknown as T)) as T;
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

function group<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return m;
}

/**
 * Load every invoice for the org (optionally only for certain customers) with
 * its derived total / paid / effective status / balance — the same figures the
 * Dashboard computes.
 */
async function loadInvoiceRows(
  supabase: SupabaseClient,
  orgId: string,
  opts: { customerIds?: string[] } = {},
): Promise<InvoiceRow[]> {
  let invQuery = supabase.from('of_invoices').select('*').eq('org_id', orgId);
  if (opts.customerIds) {
    if (opts.customerIds.length === 0) return [];
    invQuery = invQuery.in('customer_id', opts.customerIds);
  }
  const invoices = must<OfInvoice[]>(await invQuery, 'invoices');
  if (invoices.length === 0) return [];
  const invIds = invoices.map((i) => i.id);

  const [itemsRes, paysRes, cnRes, settingsRes] = await Promise.all([
    supabase.from('of_invoice_items').select('*').in('invoice_id', invIds),
    supabase.from('of_payments').select('*').in('invoice_id', invIds),
    supabase.from('of_credit_notes').select('*').eq('org_id', orgId),
    // Settings is optional — a missing/duplicate row falls back to 15% VAT.
    supabase.from('of_settings').select('default_vat_rate').eq('org_id', orgId).maybeSingle(),
  ]);
  const items = must<OfInvoiceItem[]>(itemsRes, 'invoice items');
  const payments = must<OfPayment[]>(paysRes, 'payments');
  const creditNotes = must<OfCreditNote[]>(cnRes, 'credit notes').filter(
    (c) => c.invoice_id && invIds.includes(c.invoice_id),
  );
  const vatRate = Number((settingsRes.data as { default_vat_rate?: number } | null)?.default_vat_rate ?? 15);

  // Credit-note totals per invoice.
  const creditedByInvoice = new Map<string, number>();
  if (creditNotes.length) {
    const cnIds = creditNotes.map((c) => c.id);
    const cnItemsByNote = group(
      must<OfCreditNoteItem[]>(
        await supabase.from('of_credit_note_items').select('*').in('credit_note_id', cnIds),
        'credit note items',
      ),
      (ci) => ci.credit_note_id,
    );
    for (const cn of creditNotes) {
      const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      creditedByInvoice.set(cn.invoice_id!, (creditedByInvoice.get(cn.invoice_id!) ?? 0) + cnTotal);
    }
  }

  const itemsByInvoice = group(items, (it) => it.invoice_id);
  const paymentsByInvoice = group(payments, (p) => p.invoice_id);

  return invoices.map((inv) => {
    const total = docTotals(
      itemsByInvoice.get(inv.id) ?? [],
      Number(inv.vat_rate ?? vatRate),
      Number(inv.discount ?? 0),
      Number(inv.rebate_pct ?? 0),
    ).total;
    const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
    const credited = creditedByInvoice.get(inv.id) ?? 0;
    const status = effectiveInvoiceStatus(inv, paid, total);
    const balance = status === 'cancelled' || status === 'credited' ? 0 : balanceDue(total, paid, credited);
    return { inv, total, paid, status, balance };
  });
}

function todayIso(): string {
  // Match the Dashboard's local-day boundary.
  return new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd
}

// ---------------------------------------------------------------------------
// Public read helpers (one per tool)
// ---------------------------------------------------------------------------

/**
 * Headline OrderFlow numbers, mirroring the Dashboard. When `includeMoney` is
 * false (member role), the revenue/outstanding figures are withheld.
 */
export async function businessSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  includeMoney: boolean,
): Promise<Record<string, string | number>> {
  const rows = await loadInvoiceRows(supabase, orgId);
  const today = todayIso();
  const monthPrefix = today.slice(0, 7);

  let revenueMonth = 0;
  let revenueToday = 0;
  let outstanding = 0;
  let overdue = 0;
  let unpaid = 0;
  for (const r of rows) {
    const issue = (r.inv.issue_date ?? '').slice(0, 10);
    const counts = r.status !== 'draft' && r.status !== 'cancelled';
    if (counts && issue) {
      if (issue.startsWith(monthPrefix)) revenueMonth += r.total;
      if (issue === today) revenueToday += r.total;
    }
    const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited';
    if (open && r.status !== 'draft') {
      unpaid += 1;
      outstanding += r.balance;
    }
    if (r.status === 'overdue') overdue += 1;
  }

  const [{ count: customerCount }, { count: orderCount }] = await Promise.all([
    supabase.from('of_customers').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('of_orders').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);

  const base: Record<string, string | number> = {
    invoices_total: rows.length,
    unpaid_invoices: unpaid,
    overdue_invoices: overdue,
    customers: customerCount ?? 0,
    orders: orderCount ?? 0,
  };
  if (includeMoney) {
    base.revenue_this_month = zar(revenueMonth);
    base.revenue_today = zar(revenueToday);
    base.outstanding = zar(outstanding);
  } else {
    base.money_figures = 'restricted — only admins can see revenue and outstanding balances';
  }
  return base;
}

/** The most recent invoices, newest first. */
export async function recentInvoices(
  supabase: SupabaseClient,
  orgId: string,
  limit: number,
): Promise<Array<Record<string, string>>> {
  const rows = await loadInvoiceRows(supabase, orgId);
  const customers = byId(
    must<Pick<OfCustomer, 'id' | 'name'>[]>(
      await supabase.from('of_customers').select('id, name').eq('org_id', orgId),
      'customers',
    ),
  );

  return rows
    .sort((a, b) => (b.inv.issue_date ?? '').localeCompare(a.inv.issue_date ?? ''))
    .slice(0, limit)
    .map((r) => ({
      invoice: r.inv.invoice_number,
      customer: (r.inv.customer_id && customers.get(r.inv.customer_id)?.name) || 'Unknown',
      date: (r.inv.issue_date ?? '').slice(0, 10),
      total: zar2(r.total),
      balance: zar2(r.balance),
      status: r.status,
    }));
}

/** The most recent orders, newest first. */
export async function recentOrders(
  supabase: SupabaseClient,
  orgId: string,
  limit: number,
): Promise<Array<Record<string, string | boolean>>> {
  const orders = must<OfOrder[]>(
    await supabase.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit),
    'orders',
  );
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [itemsRes, custRes] = await Promise.all([
    supabase.from('of_order_items').select('*').in('order_id', orderIds),
    supabase.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);
  const itemsByOrder = group(must<OfOrderItem[]>(itemsRes, 'order items'), (it) => it.order_id);
  const customers = byId(must<Pick<OfCustomer, 'id' | 'name'>[]>(custRes, 'customers'));

  return orders.map((o) => {
    const subtotal = (itemsByOrder.get(o.id) ?? []).reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
      0,
    );
    return {
      order: o.order_number || o.invoice_number || o.id.slice(0, 8),
      customer: (o.customer_id && customers.get(o.customer_id)?.name) || 'Unknown',
      status: o.status,
      subtotal_ex_vat: zar2(subtotal),
      invoiced: !!o.invoice_id,
      date: (o.created_at ?? '').slice(0, 10),
    };
  });
}

/** Find customers by (partial, case-insensitive) name, with their outstanding balance. */
export async function findCustomers(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
  includeMoney: boolean,
  limit = 5,
): Promise<Array<Record<string, string | number>>> {
  const q = query.trim();
  if (!q) return [];
  // Escape PostgREST filter meta-characters so a name can't break the OR filter.
  const safe = q.replace(/[,()%*\\]/g, ' ').trim();
  if (!safe) return [];
  const customers = must<OfCustomer[]>(
    await supabase
      .from('of_customers')
      .select('*')
      .eq('org_id', orgId)
      .or(`name.ilike.%${safe}%,trading_name.ilike.%${safe}%`)
      .limit(limit),
    'customers',
  );
  if (customers.length === 0) return [];

  // Outstanding per matched customer (only if the caller may see money).
  const outstandingByCustomer = new Map<string, number>();
  const openByCustomer = new Map<string, number>();
  if (includeMoney) {
    const rows = await loadInvoiceRows(supabase, orgId, { customerIds: customers.map((c) => c.id) });
    for (const r of rows) {
      const cid = r.inv.customer_id;
      if (!cid) continue;
      const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited' && r.status !== 'draft';
      if (open) {
        outstandingByCustomer.set(cid, (outstandingByCustomer.get(cid) ?? 0) + r.balance);
        openByCustomer.set(cid, (openByCustomer.get(cid) ?? 0) + 1);
      }
    }
  }

  return customers.map((c) => {
    const row: Record<string, string | number> = {
      name: c.name,
      trading_name: c.trading_name ?? '',
      account_status: c.account_status ?? 'active',
      rebate_pct: Number(c.rebate_pct) > 0 ? `${Number(c.rebate_pct)}%` : 'none',
      payment_terms_days: c.payment_terms_days ?? '—',
    };
    if (includeMoney) {
      row.outstanding = zar2(outstandingByCustomer.get(c.id) ?? 0);
      row.open_invoices = openByCustomer.get(c.id) ?? 0;
    }
    return row;
  });
}
