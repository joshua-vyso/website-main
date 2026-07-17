'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  docTotals,
  paymentsTotal,
  balanceDue,
  effectiveInvoiceStatus,
  effectiveQuoteStatus,
  zar,
  zar2,
  INVOICE_STATUS_STYLE,
  type OfCustomer,
  type OfOrder,
  type OfQuote,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfActivityEvent,
  type OfSettings,
  type InvoiceStatus,
} from '@/lib/platform/orderflow';
import { Kpi } from '@/components/platform/orderflow/ui';
import { PublishOrderButton } from '@/components/platform/orderflow/PublishOrderButton';
import { ActivityFeed } from '@/components/platform/orderflow/ActivityFeed';
import { GlobalSearch, type SearchIndexItem } from '@/components/platform/orderflow/GlobalSearch';
import { useIsAdmin, LockedTile } from '@/components/platform/RoleGate';

// ---------------------------------------------------------------------------
// Props — the OrderFlowSnapshot spread + orgName/email (see page.tsx).
// ---------------------------------------------------------------------------

interface DashboardProps {
  customers: OfCustomer[];
  orders: OfOrder[];
  quotes: OfQuote[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  activity: OfActivityEvent[];
  settings: OfSettings;
  /** How many website enquiries still need a quote. */
  quoteRequestsNew: number;
  orgName: string | null;
  email: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Orders that have shipped/confirmed but not yet been invoiced.
const AWAITING_INVOICE_STATUSES = new Set(['confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered']);

export function Dashboard({
  customers,
  orders,
  quotes,
  invoices,
  invoiceItems,
  payments,
  creditNotes,
  creditNoteItems,
  activity,
  settings,
  quoteRequestsNew,
  orgName,
  email,
}: DashboardProps) {
  const vatRate = Number(settings?.default_vat_rate ?? 15);
  // Members don't see money figures — revenue/outstanding tiles are locked.
  const isAdmin = useIsAdmin();

  // Group invoice items + payments by invoice, and credit-note totals per
  // invoice, once for all downstream maths.
  const { itemsByInvoice, paymentsByInvoice, creditedByInvoice } = useMemo(() => {
    const items = new Map<string, OfInvoiceItem[]>();
    for (const it of invoiceItems) {
      const arr = items.get(it.invoice_id) ?? [];
      arr.push(it);
      items.set(it.invoice_id, arr);
    }
    const pays = new Map<string, OfPayment[]>();
    for (const p of payments) {
      const arr = pays.get(p.invoice_id) ?? [];
      arr.push(p);
      pays.set(p.invoice_id, arr);
    }
    const cnItemsByNote = new Map<string, OfCreditNoteItem[]>();
    for (const ci of creditNoteItems) {
      const arr = cnItemsByNote.get(ci.credit_note_id) ?? [];
      arr.push(ci);
      cnItemsByNote.set(ci.credit_note_id, arr);
    }
    const credited = new Map<string, number>();
    for (const cn of creditNotes) {
      if (!cn.invoice_id) continue;
      const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      credited.set(cn.invoice_id, (credited.get(cn.invoice_id) ?? 0) + cnTotal);
    }
    return { itemsByInvoice: items, paymentsByInvoice: pays, creditedByInvoice: credited };
  }, [invoiceItems, payments, creditNotes, creditNoteItems]);

  // Per-invoice derived figures: total, paid, effective status, balance.
  const invoiceRows = useMemo(() => {
    return invoices.map((inv) => {
      const items = itemsByInvoice.get(inv.id) ?? [];
      const total = docTotals(items, Number(inv.vat_rate ?? vatRate), Number(inv.discount ?? 0), Number(inv.rebate_pct ?? 0)).total;
      const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
      const credited = creditedByInvoice.get(inv.id) ?? 0;
      const status = effectiveInvoiceStatus(inv, paid, total);
      const balance = status === 'cancelled' || status === 'credited' ? 0 : balanceDue(total, paid, credited);
      return { inv, total, paid, status, balance };
    });
  }, [invoices, itemsByInvoice, paymentsByInvoice, creditedByInvoice, vatRate]);

  const kpis = useMemo(() => {
    const today = todayIso();
    const now = new Date();
    const monthPrefix = today.slice(0, 7); // yyyy-mm

    let revenueMonth = 0;
    let revenueToday = 0;
    let invoicesCreatedToday = 0;
    let unpaid = 0;
    let overdue = 0;
    let outstanding = 0;

    for (const r of invoiceRows) {
      const issue = (r.inv.issue_date ?? '').slice(0, 10);
      const created = (r.inv.created_at ?? '').slice(0, 10);
      const counts = r.status !== 'draft' && r.status !== 'cancelled';

      if (counts && issue) {
        if (issue.startsWith(monthPrefix)) revenueMonth += r.total;
        if (issue === today) revenueToday += r.total;
      }
      if (created === today) invoicesCreatedToday += 1;

      const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited';
      if (open && r.status !== 'draft') {
        unpaid += 1;
        outstanding += r.balance;
      }
      if (r.status === 'overdue') overdue += 1;
    }

    const quotesAwaiting = quotes.filter((q) => effectiveQuoteStatus(q, now) === 'sent').length;
    const ordersAwaiting = orders.filter(
      (o) => !o.invoice_id && AWAITING_INVOICE_STATUSES.has(o.status),
    ).length;

    return {
      revenueMonth,
      revenueToday,
      invoicesCreatedToday,
      unpaid,
      overdue,
      outstanding,
      quotesAwaiting,
      ordersAwaiting,
    };
  }, [invoiceRows, quotes, orders]);

  const newRequests = quoteRequestsNew;

  // Search index across the four core entity types.
  const searchIndex = useMemo<SearchIndexItem[]>(() => {
    const customerName = new Map(customers.map((c) => [c.id, c.name]));
    const idx: SearchIndexItem[] = [];
    for (const c of customers) {
      idx.push({
        type: 'customer',
        id: c.id,
        title: c.name,
        sub: [c.trading_name, c.email, c.phone].filter(Boolean).join(' · '),
        href: `/app/orderflow/customers/${c.id}`,
      });
    }
    for (const q of quotes) {
      idx.push({
        type: 'quote',
        id: q.id,
        title: q.quote_number,
        sub: (q.customer_id && customerName.get(q.customer_id)) || 'No customer',
        href: `/app/orderflow/quotes/${q.id}`,
      });
    }
    for (const o of orders) {
      idx.push({
        type: 'order',
        id: o.id,
        title: o.order_number || o.invoice_number || `Order ${o.id.slice(0, 8)}`,
        sub: (o.customer_id && customerName.get(o.customer_id)) || 'No customer',
        href: `/app/orderflow/orders/${o.id}`,
      });
    }
    for (const i of invoices) {
      idx.push({
        type: 'invoice',
        id: i.id,
        title: i.invoice_number,
        sub: (i.customer_id && customerName.get(i.customer_id)) || 'No customer',
        href: `/app/orderflow/invoices/${i.id}`,
      });
    }
    return idx;
  }, [customers, quotes, orders, invoices]);

  const recentInvoices = useMemo(() => invoiceRows.slice(0, 8), [invoiceRows]);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const hasAnything =
    customers.length > 0 || invoices.length > 0 || quotes.length > 0 || orders.length > 0;

  return (
    <div className="space-y-6">
      {/* Heading + search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight text-[#1A1C1E]">
            {orgName ? `${orgName} · OrderFlow` : 'OrderFlow'}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#5F6368]">
            {email ? `Signed in as ${email}` : 'Invoicing, quotes, orders and payments in one place.'}
          </p>
        </div>
      </div>

      <GlobalSearch items={searchIndex} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {isAdmin ? (
          <Kpi
            label="Revenue this month"
            value={zar(kpis.revenueMonth)}
            accent="#0F6E56"
            sub={`${zar(kpis.revenueToday)} today`}
          />
        ) : (
          <LockedTile label="Revenue this month" />
        )}
        <Kpi label="Invoices today" value={String(kpis.invoicesCreatedToday)} sub="created today" />
        {isAdmin ? (
          <Kpi
            label="Outstanding"
            value={zar(kpis.outstanding)}
            accent={kpis.outstanding > 0 ? '#854F0B' : undefined}
            sub={`${kpis.unpaid} unpaid invoice${kpis.unpaid === 1 ? '' : 's'}`}
          />
        ) : (
          <LockedTile label="Outstanding" />
        )}
        <Kpi
          label="Overdue"
          value={String(kpis.overdue)}
          accent={kpis.overdue > 0 ? '#A32D2D' : undefined}
          sub={kpis.overdue === 1 ? 'invoice past due' : 'invoices past due'}
        />
      </div>

      {/* Secondary KPIs: pipeline.
          "Quote requests" and "Quotes awaiting approval" are deliberately separate
          tiles that point in opposite directions: a request is one YOU owe them, a
          quote awaiting approval is one THEY owe you. One number for both would mean
          two different things at once. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label="Quote requests"
          value={String(newRequests)}
          accent={newRequests > 0 ? '#854F0B' : undefined}
          sub={
            newRequests > 0 ? (
              <Link href="/app/orderflow/quotes" className="font-medium text-[#1E5E54] hover:underline">
                needs a quote →
              </Link>
            ) : (
              'from the website'
            )
          }
        />
        <Kpi label="Quotes awaiting approval" value={String(kpis.quotesAwaiting)} sub="sent, not yet decided" />
        <Kpi label="Orders to invoice" value={String(kpis.ordersAwaiting)} sub="confirmed → delivered" />
        <Kpi label="Customers" value={String(customers.length)} sub="on file" />
        <Kpi label="Open invoices" value={String(kpis.unpaid)} sub="unpaid & not cancelled" />
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#9A9DA1]">Quick actions</div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload a customer order (WhatsApp/email/handwritten) → Doc-U extraction
              → auto-built OrderFlow order, creating any new customer/products. */}
          <PublishOrderButton />
          <QuickAction href="/app/orderflow/invoices/new" label="New invoice" primary />
          <QuickAction href="/app/orderflow/quotes/new" label="New quote" />
          <QuickAction href="/app/orderflow/orders/new" label="New order" />
          <QuickAction href="/app/orderflow/customers" label="Add customer" />
          <QuickAction href="/app/docu/databases/products" label="Add product" />
          <QuickAction href="/app/docu/databases/customers" label="Import customers" />
          <QuickAction href="/app/orderflow/pricelists" label="Import price list" />
        </div>
      </div>

      {!hasAnything ? (
        <EmptyDashboard />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent invoices */}
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
            <div className="flex items-center justify-between border-b border-[#F0F0EC] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-[#1A1C1E]">Recent invoices</h2>
              <Link href="/app/orderflow/invoices" className="text-[13px] font-medium text-[#1E5E54] hover:underline">
                View all
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-[#9A9DA1]">
                No invoices yet.{' '}
                <Link href="/app/orderflow/invoices/new" className="font-medium text-[#1E5E54] hover:underline">
                  Create your first invoice
                </Link>
                .
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#F0F0EC] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                    <th className="px-5 py-2.5 font-medium">Invoice</th>
                    <th className="px-5 py-2.5 font-medium">Customer</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    {/* Balance is money — render the column only for admins, so it isn't
                        shipped in the RSC/DOM payload to a member whose KPIs are redacted. */}
                    {isAdmin ? <th className="px-5 py-2.5 text-right font-medium">Balance</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((r) => (
                    <tr key={r.inv.id} className="group border-b border-[#F5F5F1] last:border-0 hover:bg-[#FAFAF8]">
                      <td className="px-5 py-2.5">
                        <Link href={`/app/orderflow/invoices/${r.inv.id}`} className="font-medium text-[#1A1C1E] group-hover:text-[#1E5E54]">
                          {r.inv.invoice_number}
                        </Link>
                        <div className="text-[11px] text-[#9A9DA1]">{(r.inv.issue_date ?? '').slice(0, 10) || '—'}</div>
                      </td>
                      <td className="px-5 py-2.5 text-[#5F6368]">
                        {(r.inv.customer_id && customerName.get(r.inv.customer_id)) || 'No customer'}
                      </td>
                      <td className="px-5 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      {isAdmin ? (
                        <td className="px-5 py-2.5 text-right tabular-nums text-[#1A1C1E]">{zar2(r.balance)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
            <h2 className="mb-4 text-[14px] font-semibold text-[#1A1C1E]">Recent activity</h2>
            <ActivityFeed events={activity} emptyLabel="No activity yet. It appears here as you create quotes, orders and invoices." />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function QuickAction({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex h-9 items-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]'
          : 'inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#FAFAF8]'
      }
    >
      {label}
    </Link>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-white px-6 py-12 text-center">
      <h2 className="text-[16px] font-semibold text-[#1A1C1E]">Welcome to OrderFlow</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#5F6368]">
        Add a customer, import your price list, then raise your first quote or invoice. Everything you create shows up
        here with live revenue, outstanding balances and activity.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <QuickAction href="/app/orderflow/customers" label="Add customer" primary />
        <QuickAction href="/app/orderflow/invoices/new" label="New invoice" />
      </div>
    </div>
  );
}
