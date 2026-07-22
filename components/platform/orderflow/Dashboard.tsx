'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { PublishOrderButton } from '@/components/platform/orderflow/PublishOrderButton';
import { ActivityFeed } from '@/components/platform/orderflow/ActivityFeed';
import { GlobalSearch, type SearchIndexItem } from '@/components/platform/orderflow/GlobalSearch';
import { useIsAdmin } from '@/components/platform/RoleGate';

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

  // Presentation-only derivations off the same invoiceRows the KPIs use: a
  // revenue sparkline, the month-on-month delta beside it, and the ageing split
  // that colours the outstanding bar. No extra data is fetched for any of them.
  const visuals = useMemo(() => {
    const now = new Date();

    // Last 7 months of issued revenue, oldest → newest.
    const buckets = new Map<string, number>();
    const keys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      buckets.set(key, 0);
    }
    for (const r of invoiceRows) {
      if (r.status === 'draft' || r.status === 'cancelled') continue;
      const key = (r.inv.issue_date ?? '').slice(0, 7);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.total);
    }
    const series = keys.map((k) => buckets.get(k) ?? 0);
    // Drop the leading months that pre-date the org's first invoice. Without
    // this, a business that started billing in June gets a "trend" that is
    // five flat months of zero and then a cliff — noise, not a trend.
    const firstReal = series.findIndex((v) => v > 0);
    const trend = firstReal === -1 ? [] : series.slice(firstReal);

    // Month-on-month compares like for like — this month to date against the
    // same span of days last month. Measuring a part-month against a whole one
    // would report a steep "decline" every month until the last day of it.
    const dayOfMonth = now.getDate();
    const curKey = keys[keys.length - 1];
    const prevKey = keys[keys.length - 2];
    let mtd = 0;
    let prevMtd = 0;
    for (const r of invoiceRows) {
      if (r.status === 'draft' || r.status === 'cancelled') continue;
      const issue = (r.inv.issue_date ?? '').slice(0, 10);
      if (!issue || Number(issue.slice(8, 10)) > dayOfMonth) continue;
      const key = issue.slice(0, 7);
      if (key === curKey) mtd += r.total;
      else if (key === prevKey) prevMtd += r.total;
    }
    const momPct = prevMtd > 0 ? Math.round(((mtd - prevMtd) / prevMtd) * 100) : null;

    // Outstanding split by how far past due each open balance is.
    const today = todayIso();
    const ageing = [0, 0, 0, 0]; // current · 1–30 · 31–60 · 60+
    for (const r of invoiceRows) {
      const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited' && r.status !== 'draft';
      if (!open || r.balance <= 0) continue;
      const due = (r.inv.due_date ?? '').slice(0, 10);
      if (!due || due >= today) {
        ageing[0] += r.balance;
        continue;
      }
      const days = Math.floor((Date.parse(today) - Date.parse(due)) / 86_400_000);
      if (days <= 30) ageing[1] += r.balance;
      else if (days <= 60) ageing[2] += r.balance;
      else ageing[3] += r.balance;
    }

    return { trend, momPct, ageing };
  }, [invoiceRows]);

  const newRequests = quoteRequestsNew;

  // Rendered after mount so the server and client don't disagree on the clock.
  const [todayLabel, setTodayLabel] = useState('');
  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    );
  }, []);

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
    <div className="space-y-[22px]">
      {/* Heading + search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">
            {orgName ? (
              <>
                {orgName} <span className="font-normal text-[#B9BEC5]">·</span>{' '}
                <span className="text-[#E5651F]">OrderFlow</span>
              </>
            ) : (
              <span className="text-[#E5651F]">OrderFlow</span>
            )}
          </h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">
            {email ? `Signed in as ${email}` : 'Invoicing, quotes, orders and payments in one place.'}
          </p>
        </div>
        <span className="shrink-0 rounded-[10px] border border-[#E4E9F0] bg-white px-[15px] py-2.5 text-[13px] text-[#5C6470]">
          {todayLabel ? `${todayLabel} · This month` : 'This month'}
        </span>
      </div>

      <GlobalSearch items={searchIndex} />

      {/* Hero KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Money tiles are admin-only. The blur is decoration, not the gate — the
            real figure must never reach the DOM, so members get dummy children. */}
        <HeroCard label="Revenue this month" locked={!isAdmin}>
          {isAdmin ? (
            <>
              <div className="flex min-w-0 items-end justify-between gap-3">
                <HeroValue>{zar(kpis.revenueMonth)}</HeroValue>
                <Sparkline points={visuals.trend} />
              </div>
              <HeroSub>
                {zar(kpis.revenueToday)} today
                {visuals.momPct != null ? (
                  <>
                    {' · '}
                    <span
                      className={
                        visuals.momPct >= 0 ? 'font-semibold text-[#1F5FA8]' : 'font-semibold text-[#C2571E]'
                      }
                      title="This month to date vs the same days last month"
                    >
                      {visuals.momPct >= 0 ? '+' : ''}
                      {visuals.momPct}% MoM
                    </span>
                  </>
                ) : null}
              </HeroSub>
            </>
          ) : (
            <RedactedFigures />
          )}
        </HeroCard>

        <HeroCard label="Invoices today">
          <HeroValue>{String(kpis.invoicesCreatedToday)}</HeroValue>
          <HeroSub>created today</HeroSub>
        </HeroCard>

        <HeroCard label="Outstanding · owed to you" tone="warm" locked={!isAdmin}>
          {isAdmin ? (
            <>
              <HeroValue tone="warm">{zar(kpis.outstanding)}</HeroValue>
              <AgeingBar buckets={visuals.ageing} />
              <HeroSub>
                {kpis.unpaid} unpaid ·{' '}
                <span className={kpis.overdue > 0 ? 'font-semibold text-[#C2571E]' : 'font-semibold text-[#2E6B4B]'}>
                  {kpis.overdue === 0 ? 'R 0 overdue' : `${kpis.overdue} overdue`}
                </span>
              </HeroSub>
            </>
          ) : (
            <RedactedFigures tone="warm" />
          )}
        </HeroCard>

        <HeroCard label="Overdue">
          <HeroValue tone={kpis.overdue > 0 ? 'alert' : undefined}>{String(kpis.overdue)}</HeroValue>
          {kpis.overdue === 0 ? (
            <HeroSub className="font-medium text-[#2E6B4B]">✓ nothing past due</HeroSub>
          ) : (
            <HeroSub>{kpis.overdue === 1 ? 'invoice past due' : 'invoices past due'}</HeroSub>
          )}
        </HeroCard>
      </div>

      {/* Secondary KPIs: pipeline.
          "Quote requests" and "Quotes awaiting approval" are deliberately separate
          tiles that point in opposite directions: a request is one YOU owe them, a
          quote awaiting approval is one THEY owe you. One number for both would mean
          two different things at once. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Chip
          label="Quote requests"
          value={String(newRequests)}
          tone={newRequests > 0 ? 'warm' : undefined}
          sub={
            newRequests > 0 ? (
              <Link href="/app/orderflow/quotes" className="font-medium text-[#C2571E] hover:underline">
                needs a quote →
              </Link>
            ) : (
              'from the website'
            )
          }
        />
        <Chip label="Quotes awaiting" value={String(kpis.quotesAwaiting)} sub="sent, not yet decided" />
        <Chip
          label="Orders to invoice"
          value={String(kpis.ordersAwaiting)}
          tone={kpis.ordersAwaiting > 0 ? 'warm' : undefined}
          sub={
            kpis.ordersAwaiting > 0 ? (
              <Link href="/app/orderflow/orders" className="font-medium text-[#C2571E] hover:underline">
                invoice now →
              </Link>
            ) : (
              'confirmed → delivered'
            )
          }
        />
        <Chip label="Customers" value={String(customers.length)} sub="on file" />
        <Chip label="Open invoices" value={String(kpis.unpaid)} sub="unpaid & not cancelled" />
      </div>

      {/* Quick actions */}
      <Card className="px-6 py-5">
        <div className="mb-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A8E86]">Quick actions</div>
        <div className="flex flex-wrap items-center gap-3">
          <QuickAction href="/app/orderflow/invoices/new" label="+ New invoice" primary />
          <QuickAction href="/app/orderflow/quotes/new" label="New quote" />
          <QuickAction href="/app/orderflow/orders/new" label="New order" />
          {/* Upload a customer order (WhatsApp/email/handwritten) → Doc-U extraction
              → auto-built OrderFlow order, creating any new customer/products. */}
          <PublishOrderButton />
          <QuickAction href="/app/orderflow/customers" label="Add customer" />
          <QuickAction href="/app/docu/databases/products" label="Add product" />
          <QuickAction href="/app/docu/databases/customers" label="Import customers" />
          <QuickAction href="/app/orderflow/pricelists" label="Import price list" />
        </div>
      </Card>

      {!hasAnything ? (
        <EmptyDashboard />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]">
          {/* Recent invoices */}
          <Card className="overflow-hidden px-6 py-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Recent invoices</h2>
              <Link href="/app/orderflow/invoices" className="text-[13px] font-semibold text-[#1F5FA8] hover:underline">
                View all →
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-[#A0A49C]">
                No invoices yet.{' '}
                <Link href="/app/orderflow/invoices/new" className="font-medium text-[#C2571E] hover:underline">
                  Create your first invoice
                </Link>
                .
              </div>
            ) : (
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="border-b border-[#EEF0F3] text-left text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                      <th className="pb-2.5 font-medium">Invoice</th>
                      <th className="pb-2.5 font-medium">Customer</th>
                      <th className="pb-2.5 font-medium">Status</th>
                      {/* Balance is money — render the column only for admins, so it isn't
                          shipped in the RSC/DOM payload to a member whose KPIs are redacted. */}
                      {isAdmin ? <th className="pb-2.5 text-right font-medium">Balance</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((r) => (
                      <tr key={r.inv.id} className="group border-b border-[#F4F5F7] last:border-0">
                        <td className="py-3.5 pr-4">
                          <Link
                            href={`/app/orderflow/invoices/${r.inv.id}`}
                            className="of-num text-[14px] font-semibold text-[#171A17] group-hover:text-[#C2571E]"
                          >
                            {r.inv.invoice_number}
                          </Link>
                          <div className="mt-0.5 text-[12px] text-[#A0A49C]">
                            {(r.inv.issue_date ?? '').slice(0, 10) || '—'}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 text-[#2C333B]">
                          {(r.inv.customer_id && customerName.get(r.inv.customer_id)) || 'No customer'}
                        </td>
                        <td className="py-3.5 pr-4">
                          <StatusPill status={r.status} />
                        </td>
                        {isAdmin ? (
                          <td className="of-num py-3.5 text-right font-semibold text-[#171A17]">{zar2(r.balance)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Recent activity */}
          <Card className="px-6 py-5">
            <h2 className="of-display mb-4 text-[16px] font-semibold text-[#171A17]">Recent activity</h2>
            <ActivityFeed events={activity} emptyLabel="No activity yet. It appears here as you create quotes, orders and invoices." />
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentation primitives — local to the dashboard on purpose. The shared
// `Kpi`/`LockedTile` are used by a dozen other modules on the platform's blue
// palette; OrderFlow's own look lives here so restyling it can't reach them.
// ---------------------------------------------------------------------------

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)] ${className}`}>
      {children}
    </div>
  );
}

function HeroCard({
  label,
  tone,
  locked,
  children,
}: {
  label: string;
  tone?: 'warm';
  locked?: boolean;
  children: ReactNode;
}) {
  const warm = tone === 'warm';
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-6 py-[22px] shadow-[0_1px_2px_rgba(20,24,20,0.03)] ${
        warm ? 'border-[#F3DCC7] bg-gradient-to-b from-[#FFF8F2] to-white' : 'border-[#EAEDF2] bg-white'
      }`}
    >
      <div
        className={`text-[12px] uppercase tracking-[0.05em] ${
          warm ? 'font-semibold text-[#C2571E]' : 'font-medium text-[#8A8E86]'
        }`}
      >
        {label}
      </div>
      {/* Members don't see money. Blur the real figures and cover them rather
          than rendering a differently-shaped tile that breaks the row. */}
      <div className={locked ? 'select-none blur-[7px]' : undefined} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked ? (
        <div className="absolute inset-x-0 bottom-3 top-11 flex items-center justify-center px-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-[#5C6470] ring-1 ring-[#E4E9F0] backdrop-blur-[2px]">
            <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
              <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" />
            </svg>
            Contact an admin to see this tile
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Stand-in figures for a member-role user. Deliberately fake: the blur on a
 * locked HeroCard is decoration, and this is what actually keeps the real
 * numbers out of the markup — same guarantee the shared LockedTile gives.
 */
function RedactedFigures({ tone }: { tone?: 'warm' }) {
  return (
    <>
      <HeroValue tone={tone}>R 000 000</HeroValue>
      <HeroSub>•••••••••</HeroSub>
    </>
  );
}

function HeroValue({ tone, children }: { tone?: 'warm' | 'alert'; children: ReactNode }) {
  const color = tone === 'warm' ? 'text-[#D2611C]' : tone === 'alert' ? 'text-[#A32D2D]' : 'text-[#171A17]';
  return (
    <div className={`of-num mt-2 whitespace-nowrap text-[30px] font-semibold tracking-[-0.02em] ${color}`}>
      {children}
    </div>
  );
}

function HeroSub({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`mt-1 text-[13px] text-[#6B6F68] ${className}`}>{children}</div>;
}

/**
 * Monthly revenue trend. Needs at least three months to say anything — two
 * points are just a diagonal — so it renders nothing below that and the card
 * simply shows the figure. Scales down with the card rather than overflowing it.
 */
function Sparkline({ points }: { points: number[] }) {
  const w = 88;
  const h = 34;
  const pad = 3;
  if (points.length < 3) return null;
  const max = Math.max(...points);
  if (max <= 0) return null;
  const step = w / (points.length - 1);
  // Baselined at zero rather than at the series minimum: for revenue the
  // distance from nothing is the story, and a min-baseline turns a merely
  // quieter month into a cliff down to the floor.
  const coords = points.map((v, i) => [i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const pts = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
  const area = `M${pts.join(' L')} L${w},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      className="mb-1.5 h-[34px] w-full min-w-[40px] max-w-[88px] shrink"
    >
      <defs>
        <linearGradient id="of-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4C86D4" stopOpacity="0.22" />
          <stop offset="1" stopColor="#4C86D4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#of-spark-fill)" />
      {/* Squashing the viewBox would thin the stroke unevenly — pin it. */}
      <polyline
        points={pts.join(' ')}
        stroke="#3E7BC4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Outstanding split by age: current · 1–30 · 31–60 · 60+ days past due. */
function AgeingBar({ buckets }: { buckets: number[] }) {
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  // Intensity climbs with age. The mock ran dark→light left to right, but the
  // left-most bucket is the healthy one — painting money that isn't even due
  // yet in the loudest orange, and 60-day-old debt in the palest, would read
  // exactly backwards.
  const colors = ['#F0C89B', '#EDA267', '#E5651F', '#C2571E'];
  const labels = ['Not yet due', '1–30 days overdue', '31–60 days overdue', '60+ days overdue'];
  return (
    <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-[5px]">
      {buckets.map((v, i) =>
        v > 0 ? <div key={i} style={{ flex: v, background: colors[i] }} title={labels[i]} /> : null,
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'warm';
  sub?: ReactNode;
}) {
  const warm = tone === 'warm';
  return (
    <div
      className={`rounded-[14px] border px-5 py-4 ${
        warm ? 'border-[#F3DCC7] bg-gradient-to-b from-[#FFF8F2] to-white' : 'border-[#EEF1F5] bg-white'
      }`}
    >
      <div className={`text-[12px] ${warm ? 'font-semibold text-[#C2571E]' : 'text-[#8A8E86]'}`}>{label}</div>
      <div className={`of-num mt-1 text-[22px] font-semibold ${warm ? 'text-[#D2611C]' : 'text-[#171A17]'}`}>
        {value}
      </div>
      {sub != null ? <div className="mt-0.5 text-[12px] text-[#A8ACB2]">{sub}</div> : null}
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
          ? 'inline-flex h-[42px] items-center rounded-[11px] border border-[#F0C89B] bg-white px-[18px] text-[14px] font-semibold text-[#C2571E] transition-all hover:border-transparent hover:bg-gradient-to-br hover:from-[#E5651F] hover:to-[#D2611C] hover:text-white hover:shadow-[0_6px_16px_-4px_rgba(229,101,31,0.5)]'
          : 'inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
      }
    >
      {label}
    </Link>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
      <h2 className="of-display text-[18px] font-semibold text-[#171A17]">Welcome to OrderFlow</h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">
        Add a customer, import your price list, then raise your first quote or invoice. Everything you create shows up
        here with live revenue, outstanding balances and activity.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <QuickAction href="/app/orderflow/customers" label="Add customer" primary />
        <QuickAction href="/app/orderflow/invoices/new" label="New invoice" />
      </div>
    </div>
  );
}
