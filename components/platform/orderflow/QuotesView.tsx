'use client';

/**
 * Quotes list — KPIs (open value, awaiting decision, accepted this month),
 * search + status filter, table with the derived quote status and per-row
 * actions (view / convert to order / convert to invoice / mark sent / download).
 * All writes go straight to Supabase (of_quotes / of_quote_items via the shared
 * builder helpers); the effective status is DERIVED for display.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  docTotals,
  effectiveQuoteStatus,
  isoDatePlusDays,
  zar,
  zar2,
  QUOTE_STATUS_STYLE,
  type OfCustomer,
  type OfQuote,
  type OfQuoteItem,
  type QuoteStatus,
} from '@/lib/platform/orderflow';
import type { OfSettings } from '@/lib/platform/orderflow';
import { createOrder, createInvoice, type BuilderLine } from './builder';
import { Kpi, RowActionsMenu, useToast } from './ui';
import { EmptyState, Pill, SearchInput } from '@/components/platform/coredata/ui';

const QUOTE_STATUSES: readonly QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** BuilderLine[] rebuilt from stored quote items — the create helpers take these. */
function linesFromItems(items: OfQuoteItem[]): BuilderLine[] {
  return items
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it, i) => ({
      key: `q${it.id}_${i}`,
      stock_item_id: it.stock_item_id,
      name: it.name,
      qty: Number(it.qty) || 0,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
      source: 'none',
      override_note: it.override_note ?? null,
    }));
}

export function QuotesView({
  quotes,
  items,
  customers,
  settings,
}: {
  quotes: OfQuote[];
  items: OfQuoteItem[];
  customers: OfCustomer[];
  settings: OfSettings;
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const itemsByQuote = useMemo(() => {
    const m = new Map<string, OfQuoteItem[]>();
    for (const it of items) {
      const arr = m.get(it.quote_id);
      if (arr) arr.push(it);
      else m.set(it.quote_id, [it]);
    }
    return m;
  }, [items]);

  // Enrich each quote with its total + effective status once.
  const enriched = useMemo(
    () =>
      quotes.map((q) => {
        const its = itemsByQuote.get(q.id) ?? [];
        const total = docTotals(its, q.vat_rate).total;
        const eff = effectiveQuoteStatus(q);
        const customerName = (q.customer_id && customerById.get(q.customer_id)?.name) || 'No customer';
        return { quote: q, items: its, total, eff, customerName };
      }),
    [quotes, itemsByQuote, customerById],
  );

  // ---- KPIs ----
  const kpi = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let openValue = 0;
    let awaiting = 0;
    let acceptedThisMonth = 0;
    for (const e of enriched) {
      if (e.eff === 'draft' || e.eff === 'sent') {
        openValue += e.total;
        awaiting += 1;
      }
      if (e.eff === 'accepted' && (e.quote.updated_at || e.quote.created_at || '').slice(0, 7) === monthKey) {
        acceptedThisMonth += e.total;
      }
    }
    return { openValue, awaiting, acceptedThisMonth };
  }, [enriched]);

  // ---- Filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((e) => {
      if (statusFilter !== 'all' && e.eff !== statusFilter) return false;
      if (!q) return true;
      return (
        e.quote.quote_number.toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q) ||
        (e.quote.customer_po ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, search, statusFilter]);

  // ---- Actions ----
  async function markSent(quoteId: string) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusyId(quoteId);
    const { error } = await supabase
      .from('of_quotes')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', quoteId);
    setBusyId(null);
    if (error) {
      toast(`Couldn't update: ${error.message}`);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'quote',
      entityId: quoteId,
      customerId: enriched.find((e) => e.quote.id === quoteId)?.quote.customer_id ?? null,
      event: 'quote_sent',
      description: 'Quote marked as sent',
    });
    toast('Quote marked as sent');
    router.refresh();
  }

  async function convertToOrder(quoteId: string) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const row = enriched.find((e) => e.quote.id === quoteId);
    if (!row) return;
    setBusyId(quoteId);
    try {
      const res = await createOrder(supabase, {
        orgId: org.id,
        actorEmail: email,
        customerId: row.quote.customer_id,
        lines: linesFromItems(row.items),
        notes: row.quote.notes ?? null,
        deliveryAddress: row.quote.delivery_address ?? null,
        customerPo: row.quote.customer_po ?? null,
        quoteId: row.quote.id,
      });
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'quote',
        entityId: row.quote.id,
        customerId: row.quote.customer_id,
        event: 'quote_converted',
        description: `Converted to order ${res.number}`,
      });
      toast(`Order ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/orders/${res.id}`);
    } catch (e) {
      setBusyId(null);
      toast(e instanceof Error ? e.message : 'Could not convert the quote.');
    }
  }

  async function convertToInvoice(quoteId: string) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const row = enriched.find((e) => e.quote.id === quoteId);
    if (!row) return;
    const customer = row.quote.customer_id ? customerById.get(row.quote.customer_id) ?? null : null;
    const today = new Date().toISOString().slice(0, 10);
    const termDays = customer?.payment_terms_days ?? settings.default_payment_terms_days;
    setBusyId(quoteId);
    try {
      const res = await createInvoice(supabase, {
        orgId: org.id,
        actorEmail: email,
        customer,
        customerId: row.quote.customer_id,
        lines: linesFromItems(row.items),
        vatRate: row.quote.vat_rate,
        issueDate: today,
        dueDate: termDays != null ? isoDatePlusDays(today, termDays) : null,
        customerPo: row.quote.customer_po ?? null,
        deliveryAddress: row.quote.delivery_address ?? null,
        notes: row.quote.notes ?? null,
        quoteId: row.quote.id,
      });
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'quote',
        entityId: row.quote.id,
        customerId: row.quote.customer_id,
        event: 'quote_converted',
        description: `Converted to invoice ${res.number}`,
      });
      toast(`Invoice ${res.number} created`);
      router.refresh();
      router.push(`/app/orderflow/invoices/${res.id}`);
    } catch (e) {
      setBusyId(null);
      toast(e instanceof Error ? e.message : 'Could not convert the quote.');
    }
  }

  const filterSel =
    'h-9 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#6B6F68] outline-none focus:border-[#3E7BC4]';

  return (
    <div>
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#171A17]">Quotes</h1>
          <p className="mt-1 text-[14px] text-[#6B6F68]">Send priced quotes and convert accepted ones to orders or invoices</p>
        </div>
        <Link
          href="/app/orderflow/quotes/new"
          className="inline-flex h-10 items-center rounded-xl bg-[#1F5FA8] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#174C87]"
        >
          + New quote
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Open quote value" value={zar(kpi.openValue)} accent={kpi.openValue > 0 ? '#3E7BC4' : undefined} sub="Draft + sent" />
        <Kpi label="Awaiting decision" value={String(kpi.awaiting)} accent={kpi.awaiting > 0 ? '#854F0B' : undefined} />
        <Kpi label="Accepted this month" value={zar(kpi.acceptedThisMonth)} accent={kpi.acceptedThisMonth > 0 ? '#0F6E56' : undefined} />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search quote #, customer, or PO…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | QuoteStatus)} className={filterSel}>
          <option value="all">All statuses</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_STYLE[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-wide text-[#8A8E86]">
                <th className="px-4 py-2.5 text-left font-medium">Quote #</th>
                <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-left font-medium">Issued</th>
                <th className="px-2 py-2.5 text-left font-medium">Valid until</th>
                <th className="px-2 py-2.5 text-right font-medium">Total</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="px-4 py-8">
                      <EmptyState
                        title="No quotes yet"
                        body="Create a priced quote for a customer — accepted quotes convert straight to an order or invoice."
                        action={
                          <Link
                            href="/app/orderflow/quotes/new"
                            className="inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
                          >
                            + New quote
                          </Link>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
                    No quotes match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const s = QUOTE_STATUS_STYLE[e.eff];
                  const converted = !!(e.quote.converted_order_id || e.quote.converted_invoice_id);
                  const actions = [
                    { label: 'View quote', onClick: () => router.push(`/app/orderflow/quotes/${e.quote.id}`) },
                    ...(e.eff === 'draft'
                      ? [{ label: 'Mark sent', onClick: () => void markSent(e.quote.id) }]
                      : []),
                    ...(!converted
                      ? [
                          { label: 'Convert to order', onClick: () => void convertToOrder(e.quote.id) },
                          { label: 'Convert to invoice', onClick: () => void convertToInvoice(e.quote.id) },
                        ]
                      : []),
                    {
                      label: 'Download PDF',
                      onClick: () => router.push(`/app/orderflow/quotes/${e.quote.id}?print=1`),
                    },
                  ];
                  return (
                    <tr
                      key={e.quote.id}
                      onClick={() => router.push(`/app/orderflow/quotes/${e.quote.id}`)}
                      className={`cursor-pointer border-b border-[#F5F9FE] last:border-0 hover:bg-[#F5F9FE] ${
                        busyId === e.quote.id ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#171A17]">
                        {e.quote.quote_number}
                        {converted ? <span className="ml-2 text-[11px] font-normal text-[#8A8E86]">converted</span> : null}
                      </td>
                      <td className="px-2 py-3 text-[#171A17]">{e.customerName}</td>
                      <td className="px-2 py-3 text-[#6B6F68]">{fmtDate(e.quote.issue_date)}</td>
                      <td className="px-2 py-3 text-[#6B6F68]">{fmtDate(e.quote.valid_until)}</td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#171A17]">{zar2(e.total)}</td>
                      <td className="px-2 py-3">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
                      </td>
                      <td className="px-2 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <RowActionsMenu actions={actions} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
