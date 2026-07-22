'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  ACCOUNT_STATUS_STYLE,
  CUSTOMER_TYPES,
  ORDER_STATUS_STYLE,
  QUOTE_STATUS_STYLE,
  INVOICE_STATUS_STYLE,
  PAYMENT_METHODS,
  docTotals,
  paymentsTotal,
  balanceDue,
  effectiveInvoiceStatus,
  effectiveQuoteStatus,
  zar,
  zar2,
  type AccountStatus,
  type CustomerType,
  type OfCreditNoteItem,
  type OfInvoiceItem,
  type OfPayment,
} from '@/lib/platform/orderflow';
import { customerPriceList, formatAddress, type CdContact, type CdDeliveryAddress } from '@/lib/platform/coredata';
import type { CustomerProfileData } from '@/lib/platform/orderflow-data';
import { ActivityFeed } from './ActivityFeed';
import { AttachDocuments } from './AttachDocuments';
import { CustomerAiInvoicing } from './CustomerAiInvoicing';
import { useToast } from './ui';
import {
  ConfirmDialog,
  Field,
  Modal,
  Pill,
  PrimaryBtn,
  SecondaryBtn,
  inputClass,
} from '@/components/platform/coredata/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const sectionCls = 'rounded-2xl border border-[#EAEDF2] bg-white p-5';
const sectionTitle = 'text-[13px] font-semibold text-[#171A17]';

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={sectionCls}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit-customer draft
// ---------------------------------------------------------------------------

interface EditDraft {
  name: string;
  trading_name: string;
  email: string;
  phone: string;
  vat_number: string;
  registration_number: string;
  account_status: AccountStatus;
  customer_type: CustomerType;
  payment_terms_days: string;
  credit_limit: string;
  billing_address: string;
  tags: string;
  notes: string;
  // Flat imported fields (import-fields.sql) — editable after import.
  contact_name: string;
  contact_title: string;
  alt_phone: string;
  fax: string;
  delivery_address: string;
  opening_balance: string;
  currency: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomerProfile({ data, orgName }: { data: CustomerProfileData | null; orgName: string | null }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const customer = data?.customer ?? null;

  // Modals / inline edit state.
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmHold, setConfirmHold] = useState(false);

  const now = useMemo(() => new Date(), []);

  // Compute lifetime + outstanding from real invoices/items/payments.
  const finance = useMemo(() => {
    if (!data) return { lifetime: 0, outstanding: 0, lastInvoice: null as string | null };
    const itemsByInvoice = new Map<string, OfInvoiceItem[]>();
    for (const it of data.invoiceItems) {
      const arr = itemsByInvoice.get(it.invoice_id) ?? [];
      arr.push(it);
      itemsByInvoice.set(it.invoice_id, arr);
    }
    const payByInvoice = new Map<string, OfPayment[]>();
    for (const p of data.payments) {
      const arr = payByInvoice.get(p.invoice_id) ?? [];
      arr.push(p);
      payByInvoice.set(p.invoice_id, arr);
    }
    const cnItemsByNote = new Map<string, OfCreditNoteItem[]>();
    for (const ci of data.creditNoteItems) {
      const arr = cnItemsByNote.get(ci.credit_note_id) ?? [];
      arr.push(ci);
      cnItemsByNote.set(ci.credit_note_id, arr);
    }
    const creditedByInvoice = new Map<string, number>();
    for (const cn of data.creditNotes) {
      if (!cn.invoice_id) continue;
      const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      creditedByInvoice.set(cn.invoice_id, (creditedByInvoice.get(cn.invoice_id) ?? 0) + cnTotal);
    }
    let lifetime = 0;
    let outstanding = 0;
    let lastInvoice: string | null = null;
    for (const inv of data.invoices) {
      if (!lastInvoice || (inv.issue_date && inv.issue_date > lastInvoice)) lastInvoice = inv.issue_date;
      if (inv.status === 'cancelled') continue;
      const total = docTotals(itemsByInvoice.get(inv.id) ?? [], inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
      if (inv.status !== 'draft') lifetime += total;
      if (inv.status === 'draft' || inv.status === 'credited') continue;
      const paid = paymentsTotal(payByInvoice.get(inv.id) ?? []);
      const credited = creditedByInvoice.get(inv.id) ?? 0;
      outstanding += balanceDue(total, paid, credited);
    }
    return { lifetime: Math.round(lifetime * 100) / 100, outstanding: Math.round(outstanding * 100) / 100, lastInvoice };
  }, [data]);

  // ---- Not-found / not-connected ----
  if (!customer) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-12 text-center">
        {toastNode}
        <p className="text-[15px] font-medium text-[#171A17]">Customer not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#6B6F68]">
          It may have been deleted, or the Core Data migration has not been run yet.
        </p>
        <Link href="/app/orderflow/customers" className="mt-3 inline-block text-[13px] font-medium text-[#1F5FA8] hover:underline">
          ← Back to customers
        </Link>
      </div>
    );
  }

  const status = (customer.account_status ?? 'active') as AccountStatus;
  const statusStyle = ACCOUNT_STATUS_STYLE[status];
  const typeLabel = CUSTOMER_TYPES.find((t) => t.value === (customer.customer_type ?? 'other'))?.label ?? 'Other';
  const priceList = customerPriceList(customer, data!.priceLists, now);

  // Invoice/payment maps for the tables below.
  const itemsByInvoice = new Map<string, OfInvoiceItem[]>();
  for (const it of data!.invoiceItems) {
    const arr = itemsByInvoice.get(it.invoice_id) ?? [];
    arr.push(it);
    itemsByInvoice.set(it.invoice_id, arr);
  }
  const payByInvoice = new Map<string, OfPayment[]>();
  for (const p of data!.payments) {
    const arr = payByInvoice.get(p.invoice_id) ?? [];
    arr.push(p);
    payByInvoice.set(p.invoice_id, arr);
  }
  const cnItemsByNote = new Map<string, OfCreditNoteItem[]>();
  for (const ci of data!.creditNoteItems) {
    const arr = cnItemsByNote.get(ci.credit_note_id) ?? [];
    arr.push(ci);
    cnItemsByNote.set(ci.credit_note_id, arr);
  }
  const creditedByInvoice = new Map<string, number>();
  for (const cn of data!.creditNotes) {
    if (!cn.invoice_id) continue;
    const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
    creditedByInvoice.set(cn.invoice_id, (creditedByInvoice.get(cn.invoice_id) ?? 0) + cnTotal);
  }
  const invoiceById = new Map(data!.invoices.map((i) => [i.id, i]));

  // ---- Edit customer ----
  function openEdit() {
    if (!customer) return;
    setEditDraft({
      name: customer.name,
      trading_name: customer.trading_name ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      vat_number: customer.vat_number ?? '',
      registration_number: customer.registration_number ?? '',
      account_status: status,
      customer_type: (customer.customer_type ?? 'other') as CustomerType,
      payment_terms_days: customer.payment_terms_days == null ? '' : String(customer.payment_terms_days),
      credit_limit: customer.credit_limit == null ? '' : String(customer.credit_limit),
      billing_address: customer.billing_address ?? '',
      tags: (customer.tags ?? []).join(', '),
      notes: customer.notes ?? '',
      contact_name: customer.contact_name ?? '',
      contact_title: customer.contact_title ?? '',
      alt_phone: customer.alt_phone ?? '',
      fax: customer.fax ?? '',
      delivery_address: customer.delivery_address ?? '',
      opening_balance: customer.opening_balance == null ? '' : String(customer.opening_balance),
      currency: customer.currency ?? '',
    });
    setError(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editDraft || !customer || busy) return;
    const name = editDraft.name.trim();
    if (!name) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const tags = editDraft.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const { error: upErr } = await supabase
      .from('of_customers')
      .update({
        name,
        trading_name: editDraft.trading_name.trim() || null,
        email: editDraft.email.trim() || null,
        phone: editDraft.phone.trim() || null,
        vat_number: editDraft.vat_number.trim() || null,
        registration_number: editDraft.registration_number.trim() || null,
        account_status: editDraft.account_status,
        customer_type: editDraft.customer_type,
        payment_terms_days: editDraft.payment_terms_days.trim() === '' ? null : Number(editDraft.payment_terms_days),
        credit_limit: editDraft.credit_limit.trim() === '' ? null : Number(editDraft.credit_limit),
        billing_address: editDraft.billing_address.trim() || null,
        tags,
        notes: editDraft.notes.trim() || null,
        contact_name: editDraft.contact_name.trim() || null,
        contact_title: editDraft.contact_title.trim() || null,
        alt_phone: editDraft.alt_phone.trim() || null,
        fax: editDraft.fax.trim() || null,
        delivery_address: editDraft.delivery_address.trim() || null,
        opening_balance: editDraft.opening_balance.trim() === '' ? null : Number(editDraft.opening_balance.replace(/[R\s,]/g, '')),
        currency: editDraft.currency.trim().toUpperCase() || null,
      })
      .eq('id', customer.id);
    if (upErr) {
      setBusy(false);
      setError(upErr.message);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customer.id,
      customerId: customer.id,
      event: 'customer_updated',
      description: name,
    });
    setBusy(false);
    setEditing(false);
    toast('Customer updated');
    router.refresh();
  }

  // ---- Place on hold / reactivate ----
  async function toggleHold() {
    if (!customer) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    const next: AccountStatus = status === 'on_hold' ? 'active' : 'on_hold';
    const { error: upErr } = await supabase.from('of_customers').update({ account_status: next }).eq('id', customer.id);
    setConfirmHold(false);
    if (upErr) {
      toast(upErr.message);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customer.id,
      customerId: customer.id,
      event: 'customer_updated',
      description: next === 'on_hold' ? 'Placed on hold' : 'Reactivated',
    });
    toast(next === 'on_hold' ? 'Placed on hold' : 'Reactivated');
    router.refresh();
  }

  // ---- Set default price list ----
  async function setPriceList(listId: string | null) {
    if (!customer) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const { error: upErr } = await supabase
      .from('of_customers')
      .update({ default_price_list_id: listId })
      .eq('id', customer.id);
    if (upErr) {
      toast(upErr.message);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customer.id,
      customerId: customer.id,
      event: 'customer_updated',
      description: 'Default price list changed',
    });
    toast('Price list updated');
    router.refresh();
  }

  const creditLimit = customer.credit_limit ?? null;
  const overLimit = creditLimit != null && creditLimit > 0 && finance.outstanding > creditLimit;

  return (
    <div className="space-y-5">
      {toastNode}

      {/* Back link */}
      <Link href="/app/orderflow/customers" className="inline-flex items-center text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#171A17]">
        ← Customers
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-[#171A17]">{customer.name}</h1>
            <Pill label={statusStyle.label} bg={statusStyle.bg} fg={statusStyle.fg} />
          </div>
          <p className="mt-0.5 text-[13px] text-[#6B6F68]">
            {customer.trading_name ? `t/a ${customer.trading_name} · ` : ''}
            {typeLabel}
            {customer.email ? ` · ${customer.email}` : ''}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </p>
          {customer.contact_name ? (
            <p className="mt-0.5 text-[13px] text-[#6B6F68]">
              Contact: <span className="font-medium text-[#171A17]">{customer.contact_name}</span>
              {customer.contact_title ? ` · ${customer.contact_title}` : ''}
            </p>
          ) : null}
          {(customer.tags ?? []).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(customer.tags ?? []).map((t) => (
                <span key={t} className="rounded-full border border-[#EAEDF2] bg-white px-2.5 py-0.5 text-[11px] text-[#6B6F68]">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryBtn onClick={openEdit}>Edit customer</SecondaryBtn>
          <SecondaryBtn onClick={() => setConfirmHold(true)}>{status === 'on_hold' ? 'Reactivate' : 'Place on hold'}</SecondaryBtn>
          <Link
            href={`/app/orderflow/quotes/new?customer=${customer.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#171A17] transition-colors hover:bg-[#EEF1F5]"
          >
            New quote
          </Link>
          <Link
            href={`/app/orderflow/orders/new?customer=${customer.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#171A17] transition-colors hover:bg-[#EEF1F5]"
          >
            New order
          </Link>
          <Link
            href={`/app/orderflow/invoices/new?customer=${customer.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
          >
            New invoice
          </Link>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OverviewStat label="Lifetime invoiced" value={zar(finance.lifetime)} />
        <OverviewStat label="Outstanding" value={zar2(finance.outstanding)} accent={finance.outstanding > 0 ? '#A32D2D' : undefined} />
        <OverviewStat label="Last invoice" value={fmtDate(finance.lastInvoice)} />
        <OverviewStat
          label="Payment terms"
          value={customer.payment_terms_days == null ? '—' : customer.payment_terms_days === 0 ? 'COD' : `${customer.payment_terms_days} days`}
        />
      </div>

      {creditLimit != null ? (
        <div
          className={`rounded-2xl border p-4 text-[13px] ${overLimit ? 'border-[#F1C8C8] bg-[#FCEBEB]' : 'border-[#EAEDF2] bg-white'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[#6B6F68]">
              Credit limit <span className="font-medium text-[#171A17]">{zar(creditLimit)}</span> · outstanding{' '}
              <span className="font-medium" style={{ color: finance.outstanding > 0 ? '#A32D2D' : '#171A17' }}>
                {zar2(finance.outstanding)}
              </span>
            </span>
            {overLimit ? (
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#A32D2D]">Over credit limit</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left / main column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Quotes */}
          <SectionCard title="Quotes">
            {data!.quotes.length === 0 ? (
              <EmptyRow label="No quotes yet." />
            ) : (
              <MiniTable head={['Number', 'Date', 'Status', 'Total', '']}>
                {data!.quotes.map((q) => {
                  const eff = effectiveQuoteStatus(q, now);
                  const s = QUOTE_STATUS_STYLE[eff];
                  return (
                    <tr key={q.id} className="border-b border-[#F5F9FE] last:border-0">
                      <td className="py-2 pr-2 font-medium text-[#171A17]">{q.quote_number}</td>
                      <td className="px-2 py-2 text-[#6B6F68]">{fmtDate(q.issue_date)}</td>
                      <td className="px-2 py-2">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#171A17]">—</td>
                      <td className="py-2 pl-2 text-right">
                        <Link href={`/app/orderflow/quotes/${q.id}`} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </MiniTable>
            )}
          </SectionCard>

          {/* Orders */}
          <SectionCard title="Orders">
            {data!.orders.length === 0 ? (
              <EmptyRow label="No orders yet." />
            ) : (
              <MiniTable head={['Number', 'Date', 'Status', 'Total', '']}>
                {data!.orders.map((o) => {
                  const s = ORDER_STATUS_STYLE[o.status];
                  return (
                    <tr key={o.id} className="border-b border-[#F5F9FE] last:border-0">
                      <td className="py-2 pr-2 font-medium text-[#171A17]">{o.order_number ?? `#${o.id.slice(0, 6).toUpperCase()}`}</td>
                      <td className="px-2 py-2 text-[#6B6F68]">{fmtDate(o.created_at)}</td>
                      <td className="px-2 py-2">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#171A17]">—</td>
                      <td className="py-2 pl-2 text-right">
                        <Link href={`/app/orderflow/orders/${o.id}`} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </MiniTable>
            )}
          </SectionCard>

          {/* Invoices */}
          <SectionCard title="Invoices">
            {data!.invoices.length === 0 ? (
              <EmptyRow label="No invoices yet." />
            ) : (
              <MiniTable head={['Number', 'Date', 'Status', 'Total', 'Balance', '']}>
                {data!.invoices.map((inv) => {
                  const total = docTotals(itemsByInvoice.get(inv.id) ?? [], inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
                  const paid = paymentsTotal(payByInvoice.get(inv.id) ?? []);
                  const credited = creditedByInvoice.get(inv.id) ?? 0;
                  const eff = effectiveInvoiceStatus(inv, paid, total, now);
                  const s = INVOICE_STATUS_STYLE[eff];
                  const bal = balanceDue(total, paid, credited);
                  return (
                    <tr key={inv.id} className="border-b border-[#F5F9FE] last:border-0">
                      <td className="py-2 pr-2 font-medium text-[#171A17]">{inv.invoice_number}</td>
                      <td className="px-2 py-2 text-[#6B6F68]">{fmtDate(inv.issue_date)}</td>
                      <td className="px-2 py-2">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#171A17]">{zar2(total)}</td>
                      <td className="px-2 py-2 text-right tabular-nums" style={{ color: bal > 0 ? '#A32D2D' : '#0F6E56' }}>
                        {zar2(bal)}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <Link href={`/app/orderflow/invoices/${inv.id}`} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </MiniTable>
            )}
          </SectionCard>

          {/* Payments */}
          <SectionCard title="Payments">
            {data!.payments.length === 0 ? (
              <EmptyRow label="No payments recorded yet." />
            ) : (
              <MiniTable head={['Date', 'Invoice', 'Method', 'Reference', 'Amount']}>
                {data!.payments.map((p) => {
                  const inv = invoiceById.get(p.invoice_id) ?? null;
                  const methodLabel = PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method;
                  return (
                    <tr key={p.id} className="border-b border-[#F5F9FE] last:border-0">
                      <td className="py-2 pr-2 text-[#6B6F68]">{fmtDate(p.paid_on)}</td>
                      <td className="px-2 py-2">
                        {inv ? (
                          <Link href={`/app/orderflow/invoices/${inv.id}`} className="font-medium text-[#1F5FA8] hover:underline">
                            {inv.invoice_number}
                          </Link>
                        ) : (
                          <span className="text-[#8A8E86]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-[#6B6F68]">{methodLabel}</td>
                      <td className="px-2 py-2 text-[#6B6F68]">{p.reference || '—'}</td>
                      <td className="py-2 pl-2 text-right tabular-nums text-[#0F6E56]">{zar2(p.amount)}</td>
                    </tr>
                  );
                })}
              </MiniTable>
            )}
          </SectionCard>

          {/* Documents */}
          <SectionCard title="Documents" action={null}>
            <AttachDocuments
              entityType="customer"
              entityId={customer.id}
              customerId={customer.id}
              documents={data!.documents}
              title="Attached documents"
            />
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Price list */}
          <SectionCard title="Price list">
            <div className="space-y-2">
              <div className="text-[13px] text-[#6B6F68]">
                Currently applied:{' '}
                <span className="font-medium text-[#171A17]">{priceList ? priceList.name : 'Base pricing (no list)'}</span>
              </div>
              <Field label="Default price list" hint="overrides the org default for this customer">
                <select
                  className={inputClass}
                  value={customer.default_price_list_id ?? ''}
                  onChange={(e) => void setPriceList(e.target.value || null)}
                >
                  <option value="">— No override (auto)</option>
                  {data!.priceLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              {data!.priceLists.length === 0 ? (
                <p className="text-[12px] text-[#8A8E86]">No price lists yet — create one in PricePilot or Core Data.</p>
              ) : null}
            </div>
          </SectionCard>

          {/* AI invoicing params + order mappings */}
          <CustomerAiInvoicing customer={customer} products={data!.products} aliases={data!.itemAliases} />

          {/* Contacts */}
          <SectionCard title="Contacts">
            <ContactsEditor customerId={customer.id} contacts={data!.contacts} />
          </SectionCard>

          {/* Billing address */}
          <SectionCard title="Billing address">
            <BillingAddressEditor customerId={customer.id} value={customer.billing_address ?? ''} />
          </SectionCard>

          {/* Delivery addresses */}
          <SectionCard title="Delivery addresses">
            {customer.delivery_address?.trim() ? (
              <div className="mb-3 rounded-xl border border-[#EEF1F5] bg-[#FCFCFB] px-3.5 py-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#8A8E86]">Imported address</div>
                <p className="mt-1 whitespace-pre-line text-[13px] text-[#171A17]">{customer.delivery_address}</p>
                <p className="mt-1 text-[11px] text-[#8A8E86]">Edit via “Edit customer”, or add structured addresses below.</p>
              </div>
            ) : null}
            <DeliveryAddressesEditor customerId={customer.id} addresses={data!.addresses} />
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Timeline">
            <ActivityFeed events={data!.activity} emptyLabel="No activity yet." />
          </SectionCard>
        </div>
      </div>

      {/* Edit customer modal */}
      {editDraft ? (
        <Modal
          open={editing}
          onClose={() => setEditing(false)}
          title="Edit customer"
          subtitle="Written to Core Data — available across every module."
          width={640}
          footer={
            <>
              <SecondaryBtn onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={() => void saveEdit()} disabled={busy || !editDraft.name.trim()}>
                {busy ? 'Saving…' : 'Save changes'}
              </PrimaryBtn>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Customer name">
              <input className={inputClass} value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
            </Field>
            <Field label="Trading name" hint="optional">
              <input className={inputClass} value={editDraft.trading_name} onChange={(e) => setEditDraft({ ...editDraft, trading_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={editDraft.email} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={editDraft.phone} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} />
            </Field>
            <Field label="Customer type">
              <select className={inputClass} value={editDraft.customer_type} onChange={(e) => setEditDraft({ ...editDraft, customer_type: e.target.value as CustomerType })}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select className={inputClass} value={editDraft.account_status} onChange={(e) => setEditDraft({ ...editDraft, account_status: e.target.value as AccountStatus })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_hold">On hold</option>
              </select>
            </Field>
            <Field label="Payment terms" hint="days (0 = COD)">
              <input className={inputClass} type="number" value={editDraft.payment_terms_days} onChange={(e) => setEditDraft({ ...editDraft, payment_terms_days: e.target.value })} />
            </Field>
            <Field label="Credit limit" hint="rands, optional">
              <input className={inputClass} type="number" value={editDraft.credit_limit} onChange={(e) => setEditDraft({ ...editDraft, credit_limit: e.target.value })} />
            </Field>
            <Field label="VAT number" hint="optional">
              <input className={inputClass} value={editDraft.vat_number} onChange={(e) => setEditDraft({ ...editDraft, vat_number: e.target.value })} />
            </Field>
            <Field label="Registration number" hint="optional">
              <input className={inputClass} value={editDraft.registration_number} onChange={(e) => setEditDraft({ ...editDraft, registration_number: e.target.value })} />
            </Field>
            <Field label="Contact person" hint="optional">
              <input className={inputClass} value={editDraft.contact_name} onChange={(e) => setEditDraft({ ...editDraft, contact_name: e.target.value })} placeholder="e.g. Jane Dlamini" />
            </Field>
            <Field label="Contact title" hint="optional">
              <input className={inputClass} value={editDraft.contact_title} onChange={(e) => setEditDraft({ ...editDraft, contact_title: e.target.value })} placeholder="e.g. Buyer, Owner" />
            </Field>
            <Field label="Alternate phone" hint="optional">
              <input className={inputClass} value={editDraft.alt_phone} onChange={(e) => setEditDraft({ ...editDraft, alt_phone: e.target.value })} />
            </Field>
            <Field label="Fax" hint="optional">
              <input className={inputClass} value={editDraft.fax} onChange={(e) => setEditDraft({ ...editDraft, fax: e.target.value })} />
            </Field>
            <Field label="Opening balance" hint="rands, optional">
              <input className={inputClass} type="number" value={editDraft.opening_balance} onChange={(e) => setEditDraft({ ...editDraft, opening_balance: e.target.value })} />
            </Field>
            <Field label="Currency" hint="e.g. ZAR, optional">
              <input className={inputClass} value={editDraft.currency} onChange={(e) => setEditDraft({ ...editDraft, currency: e.target.value })} placeholder="ZAR" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Delivery address" hint="single imported address — manage multiple below">
                <textarea className={`${inputClass} h-auto py-2`} rows={2} value={editDraft.delivery_address} onChange={(e) => setEditDraft({ ...editDraft, delivery_address: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Billing address" hint="optional">
                <textarea className={`${inputClass} h-auto py-2`} rows={2} value={editDraft.billing_address} onChange={(e) => setEditDraft({ ...editDraft, billing_address: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tags" hint="comma-separated, optional">
                <input className={inputClass} value={editDraft.tags} onChange={(e) => setEditDraft({ ...editDraft, tags: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes" hint="optional">
                <textarea className={`${inputClass} h-auto py-2`} rows={2} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
              </Field>
            </div>
          </div>
          {error ? <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}
        </Modal>
      ) : null}

      <ConfirmDialog
        open={confirmHold}
        title={status === 'on_hold' ? 'Reactivate customer?' : 'Place customer on hold?'}
        body={
          status === 'on_hold'
            ? 'They will be able to trade again and appear as active.'
            : 'On-hold customers stay visible but are flagged so new orders and invoices get a second look.'
        }
        confirmLabel={status === 'on_hold' ? 'Reactivate' : 'Place on hold'}
        danger={status !== 'on_hold'}
        onConfirm={() => void toggleHold()}
        onClose={() => setConfirmHold(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview stat
// ---------------------------------------------------------------------------

function OverviewStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4">
      <div className="text-[12px] text-[#8A8E86]">{label}</div>
      <div className="mt-1.5 text-[22px] font-bold leading-none" style={{ color: accent ?? '#171A17' }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini table + empty row
// ---------------------------------------------------------------------------

function MiniTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-wide text-[#8A8E86]">
            {head.map((h, i) => (
              <th key={i} className={`py-1.5 font-medium ${i === 0 ? 'pr-2 text-left' : i === head.length - 1 ? 'pl-2 text-right' : 'px-2 text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="py-4 text-[13px] text-[#8A8E86]">{label}</p>;
}

// ---------------------------------------------------------------------------
// Contacts (CRUD → cd_contacts)
// ---------------------------------------------------------------------------

interface ContactDraft {
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  is_primary: boolean;
}
const EMPTY_CONTACT: ContactDraft = { name: '', role: '', email: '', phone: '', whatsapp: '', is_primary: false };

function ContactsEditor({ customerId, contacts }: { customerId: string; contacts: CdContact[] }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_CONTACT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function startNew() {
    setEditId(null);
    setDraft(EMPTY_CONTACT);
    setError(null);
    setOpen(true);
  }
  function startEdit(c: CdContact) {
    setEditId(c.id);
    setDraft({ name: c.name, role: c.role ?? '', email: c.email ?? '', phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', is_primary: c.is_primary });
    setError(null);
    setOpen(true);
  }

  async function save() {
    const name = draft.name.trim();
    if (!name || busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name,
      role: draft.role.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      whatsapp: draft.whatsapp.trim() || null,
      is_primary: draft.is_primary,
    };
    // Only one primary per customer — demote the others when this one is primary.
    if (draft.is_primary) {
      const { error: demoteErr } = await supabase
        .from('cd_contacts')
        .update({ is_primary: false })
        .eq('org_id', org.id)
        .eq('customer_id', customerId)
        .neq('id', editId ?? '00000000-0000-0000-0000-000000000000');
      if (demoteErr) {
        setBusy(false);
        setError(demoteErr.message);
        return;
      }
    }
    if (editId) {
      const { error: upErr } = await supabase.from('cd_contacts').update(payload).eq('id', editId);
      if (upErr) {
        setBusy(false);
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from('cd_contacts').insert({ org_id: org.id, customer_id: customerId, ...payload });
      if (insErr) {
        setBusy(false);
        setError(insErr.message);
        return;
      }
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'customer',
        entityId: customerId,
        customerId,
        event: 'contact_added',
        description: name,
      });
    }
    setBusy(false);
    setOpen(false);
    toast(editId ? 'Contact updated' : 'Contact added');
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    setConfirmDel(null);
    const { error: delErr } = await supabase.from('cd_contacts').delete().eq('id', id);
    if (delErr) {
      toast(delErr.message);
      return;
    }
    toast('Contact removed');
    router.refresh();
  }

  return (
    <div>
      {toastNode}
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={startNew} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">
          + Add contact
        </button>
      </div>
      {contacts.length === 0 ? (
        <EmptyRow label="No contacts yet." />
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-xl border border-[#EEF1F5] bg-[#FCFCFB] px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-medium text-[#171A17]">{c.name}</span>
                    {c.role ? <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[11px] text-[#6B6F68]">{c.role}</span> : null}
                    {c.is_primary ? <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] text-[#0F6E56]">Primary</span> : null}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#6B6F68]">
                    {[c.email, c.phone, c.whatsapp ? `WA ${c.whatsapp}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => startEdit(c)} className="text-[12px] text-[#6B6F68] hover:text-[#171A17]">
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmDel(c.id)} className="text-[12px] text-[#A32D2D] hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Edit contact' : 'Add contact'}
        width={460}
        footer={
          <>
            <SecondaryBtn onClick={() => setOpen(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy || !draft.name.trim()}>
              {busy ? 'Saving…' : editId ? 'Save' : 'Add contact'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Role" hint="optional">
            <input className={inputClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Buyer, Accounts…" />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp" hint="optional">
            <input className={inputClass} value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-[13px] text-[#6B6F68]">
            <input type="checkbox" checked={draft.is_primary} onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })} className="accent-[#3E7BC4]" />
            Primary contact
          </label>
        </div>
        {error ? <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Remove contact?"
        body="This removes the contact from Core Data."
        confirmLabel="Remove"
        danger
        onConfirm={() => confirmDel && void remove(confirmDel)}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing address (inline edit → of_customers.billing_address)
// ---------------------------------------------------------------------------

function BillingAddressEditor({ customerId, value }: { customerId: string; value: string }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusy(true);
    const { error: upErr } = await supabase.from('of_customers').update({ billing_address: text.trim() || null }).eq('id', customerId);
    setBusy(false);
    if (upErr) {
      toast(upErr.message);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: customerId,
      customerId,
      event: 'customer_updated',
      description: 'Billing address updated',
    });
    setEditing(false);
    toast('Billing address updated');
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        {toastNode}
        {value.trim() ? (
          <p className="whitespace-pre-line text-[13px] text-[#171A17]">{value}</p>
        ) : (
          <p className="text-[13px] text-[#8A8E86]">No billing address set.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
          className="mt-2 text-[12px] font-medium text-[#1F5FA8] hover:underline"
        >
          {value.trim() ? 'Edit' : '+ Add billing address'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {toastNode}
      <textarea className={`${inputClass} h-auto py-2`} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Street, suburb, city, postal code" />
      <div className="mt-2 flex justify-end gap-2">
        <SecondaryBtn onClick={() => setEditing(false)}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery addresses (CRUD → cd_delivery_addresses, default toggle)
// ---------------------------------------------------------------------------

interface AddressDraft {
  nickname: string;
  street: string;
  suburb: string;
  city: string;
  province: string;
  postal_code: string;
  instructions: string;
  is_default: boolean;
}
const EMPTY_ADDRESS: AddressDraft = { nickname: '', street: '', suburb: '', city: '', province: '', postal_code: '', instructions: '', is_default: false };

function DeliveryAddressesEditor({ customerId, addresses }: { customerId: string; addresses: CdDeliveryAddress[] }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function startNew() {
    setEditId(null);
    setDraft({ ...EMPTY_ADDRESS, is_default: addresses.length === 0 });
    setError(null);
    setOpen(true);
  }
  function startEdit(a: CdDeliveryAddress) {
    setEditId(a.id);
    setDraft({
      nickname: a.nickname ?? '',
      street: a.street ?? '',
      suburb: a.suburb ?? '',
      city: a.city ?? '',
      province: a.province ?? '',
      postal_code: a.postal_code ?? '',
      instructions: a.instructions ?? '',
      is_default: a.is_default,
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      nickname: draft.nickname.trim() || null,
      street: draft.street.trim() || null,
      suburb: draft.suburb.trim() || null,
      city: draft.city.trim() || null,
      province: draft.province.trim() || null,
      postal_code: draft.postal_code.trim() || null,
      instructions: draft.instructions.trim() || null,
      is_default: draft.is_default,
    };
    // Only one default per customer: clear others when this one is default.
    if (draft.is_default) {
      await supabase.from('cd_delivery_addresses').update({ is_default: false }).eq('customer_id', customerId);
    }
    if (editId) {
      const { error: upErr } = await supabase.from('cd_delivery_addresses').update(payload).eq('id', editId);
      if (upErr) {
        setBusy(false);
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from('cd_delivery_addresses').insert({ org_id: org.id, customer_id: customerId, ...payload });
      if (insErr) {
        setBusy(false);
        setError(insErr.message);
        return;
      }
      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'customer',
        entityId: customerId,
        customerId,
        event: 'address_added',
        description:
          draft.nickname.trim() ||
          formatAddress({
            street: payload.street,
            suburb: payload.suburb,
            city: payload.city,
            province: payload.province,
            postal_code: payload.postal_code,
          }) ||
          'Delivery address',
      });
    }
    setBusy(false);
    setOpen(false);
    toast(editId ? 'Address updated' : 'Address added');
    router.refresh();
  }

  async function makeDefault(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from('cd_delivery_addresses').update({ is_default: false }).eq('customer_id', customerId);
    const { error: upErr } = await supabase.from('cd_delivery_addresses').update({ is_default: true }).eq('id', id);
    if (upErr) {
      toast(upErr.message);
      return;
    }
    toast('Default delivery address set');
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    setConfirmDel(null);
    const { error: delErr } = await supabase.from('cd_delivery_addresses').delete().eq('id', id);
    if (delErr) {
      toast(delErr.message);
      return;
    }
    toast('Address removed');
    router.refresh();
  }

  return (
    <div>
      {toastNode}
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={startNew} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">
          + Add address
        </button>
      </div>
      {addresses.length === 0 ? (
        <EmptyRow label="No delivery addresses yet." />
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border border-[#EEF1F5] bg-[#FCFCFB] px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-medium text-[#171A17]">{a.nickname || 'Delivery address'}</span>
                    {a.is_default ? <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] text-[#0F6E56]">Default</span> : null}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#6B6F68]">{formatAddress(a) || '—'}</div>
                  {a.instructions ? <div className="mt-0.5 text-[12px] text-[#8A8E86]">{a.instructions}</div> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(a)} className="text-[12px] text-[#6B6F68] hover:text-[#171A17]">
                      Edit
                    </button>
                    <button type="button" onClick={() => setConfirmDel(a.id)} className="text-[12px] text-[#A32D2D] hover:underline">
                      Remove
                    </button>
                  </div>
                  {!a.is_default ? (
                    <button type="button" onClick={() => void makeDefault(a.id)} className="text-[12px] text-[#1F5FA8] hover:underline">
                      Set default
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Edit delivery address' : 'Add delivery address'}
        width={520}
        footer={
          <>
            <SecondaryBtn onClick={() => setOpen(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editId ? 'Save' : 'Add address'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nickname" hint="optional (e.g. Main store)">
              <input className={inputClass} value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Street">
              <input className={inputClass} value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />
            </Field>
          </div>
          <Field label="Suburb">
            <input className={inputClass} value={draft.suburb} onChange={(e) => setDraft({ ...draft, suburb: e.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          </Field>
          <Field label="Province">
            <input className={inputClass} value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })} />
          </Field>
          <Field label="Postal code">
            <input className={inputClass} value={draft.postal_code} onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Delivery instructions" hint="optional">
              <textarea className={`${inputClass} h-auto py-2`} rows={2} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#6B6F68] sm:col-span-2">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} className="accent-[#3E7BC4]" />
            Default delivery address
          </label>
        </div>
        {error ? <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Remove delivery address?"
        body="This removes the address from Core Data."
        confirmLabel="Remove"
        danger
        onConfirm={() => confirmDel && void remove(confirmDel)}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
