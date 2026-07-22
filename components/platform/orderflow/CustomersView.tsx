'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  ACCOUNT_STATUS_STYLE,
  CUSTOMER_TYPES,
  docTotals,
  paymentsTotal,
  balanceDue,
  zar,
  zar2,
  type AccountStatus,
  type CustomerType,
  type OfCustomer,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
} from '@/lib/platform/orderflow';
import type { CdPaymentTerm } from '@/lib/platform/coredata';
import { Kpi, RowActionsMenu, useToast } from './ui';
import {
  Field,
  Modal,
  Pill,
  PrimaryBtn,
  SecondaryBtn,
  SearchInput,
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

const filterSel =
  'h-9 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#6B6F68] outline-none focus:border-[#3E7BC4]';

const TERM_OPTIONS = [0, 7, 14, 30, 45, 60];

interface Row {
  c: OfCustomer;
  outstanding: number;
  overdue: boolean;
  lastInvoice: string | null;
  status: AccountStatus;
  termsDays: number | null;
}

interface Draft {
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
}

const EMPTY_DRAFT: Draft = {
  name: '',
  trading_name: '',
  email: '',
  phone: '',
  vat_number: '',
  registration_number: '',
  account_status: 'active',
  customer_type: 'other',
  payment_terms_days: '',
  credit_limit: '',
  billing_address: '',
  tags: '',
  notes: '',
};

export function CustomersView({
  customers,
  invoices,
  invoiceItems,
  payments,
  paymentTerms,
}: {
  customers: OfCustomer[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  paymentTerms: CdPaymentTerm[];
}) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [termsFilter, setTermsFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const defaultTerms = useMemo(
    () => paymentTerms.find((t) => t.is_default)?.days ?? 30,
    [paymentTerms],
  );

  // Aggregate per-customer outstanding balance from real invoices, line items
  // and payments — exactly per contract rule 10 (docTotals + paymentsTotal).
  const rows: Row[] = useMemo(() => {
    const itemsByInvoice = new Map<string, OfInvoiceItem[]>();
    for (const it of invoiceItems) {
      const arr = itemsByInvoice.get(it.invoice_id) ?? [];
      arr.push(it);
      itemsByInvoice.set(it.invoice_id, arr);
    }
    const payByInvoice = new Map<string, OfPayment[]>();
    for (const p of payments) {
      const arr = payByInvoice.get(p.invoice_id) ?? [];
      arr.push(p);
      payByInvoice.set(p.invoice_id, arr);
    }

    return customers.map((c) => {
      const custInvoices = invoices.filter((i) => i.customer_id === c.id);
      let outstanding = 0;
      let overdue = false;
      let lastInvoice: string | null = null;
      for (const inv of custInvoices) {
        if (!lastInvoice || (inv.issue_date && inv.issue_date > lastInvoice)) lastInvoice = inv.issue_date;
        // Draft/cancelled/credited invoices don't count toward outstanding.
        if (inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'credited') continue;
        const total = docTotals(itemsByInvoice.get(inv.id) ?? [], inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
        const paid = paymentsTotal(payByInvoice.get(inv.id) ?? []);
        const bal = balanceDue(total, paid);
        outstanding += bal;
        if (bal > 0.005 && inv.due_date) {
          const due = new Date(`${inv.due_date}T23:59:59`);
          if (now > due) overdue = true;
        }
      }
      return {
        c,
        outstanding: Math.round(outstanding * 100) / 100,
        overdue,
        lastInvoice,
        status: (c.account_status ?? 'active') as AccountStatus,
        termsDays: c.payment_terms_days ?? null,
      };
    });
  }, [customers, invoices, invoiceItems, payments, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && (r.c.customer_type ?? 'other') !== typeFilter) return false;
      if (termsFilter !== 'all' && String(r.termsDays ?? '') !== termsFilter) return false;
      if (overdueOnly && !r.overdue) return false;
      if (q) {
        const hay = `${r.c.name} ${r.c.trading_name ?? ''} ${r.c.email ?? ''} ${r.c.phone ?? ''} ${(r.c.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, typeFilter, termsFilter, overdueOnly]);

  // KPI strip.
  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'active').length;
    const onHold = rows.filter((r) => r.status === 'on_hold').length;
    const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
    return { total, active, onHold, outstanding };
  }, [rows]);

  function openAdd() {
    setDraft({ ...EMPTY_DRAFT, payment_terms_days: String(defaultTerms) });
    setError(null);
    setAdding(true);
  }

  async function saveNew() {
    const name = draft.name.trim();
    if (!name || busy) return;
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const tags = draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      org_id: org.id,
      name,
      trading_name: draft.trading_name.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      vat_number: draft.vat_number.trim() || null,
      registration_number: draft.registration_number.trim() || null,
      account_status: draft.account_status,
      customer_type: draft.customer_type,
      payment_terms_days: draft.payment_terms_days.trim() === '' ? null : Number(draft.payment_terms_days),
      credit_limit: draft.credit_limit.trim() === '' ? null : Number(draft.credit_limit),
      billing_address: draft.billing_address.trim() || null,
      tags,
      notes: draft.notes.trim() || null,
    };
    const { data, error: insErr } = await supabase.from('of_customers').insert(payload).select('id').single();
    if (insErr || !data) {
      setBusy(false);
      setError(
        isUniqueViolation(insErr)
          ? 'A customer with that name already exists.'
          : insErr?.message ?? 'Could not add the customer.',
      );
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'customer',
      entityId: data.id,
      customerId: data.id,
      event: 'customer_created',
      description: name,
    });
    setBusy(false);
    setAdding(false);
    toast('Customer added');
    router.refresh();
    router.push(`/app/orderflow/customers/${data.id}`);
  }

  return (
    <div>
      {toastNode}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#171A17]">Customers</h1>
          <p className="mt-0.5 text-[13px] text-[#6B6F68]">Your customer book — terms, balances and account status</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/docu/databases/customers"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#171A17] transition-colors hover:bg-[#EEF1F5]"
          >
            Import
          </Link>
          <PrimaryBtn onClick={openAdd}>+ Add customer</PrimaryBtn>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Customers" value={String(kpis.total)} />
        <Kpi label="Active" value={String(kpis.active)} accent="#0F6E56" />
        <Kpi label="On hold" value={String(kpis.onHold)} accent={kpis.onHold > 0 ? '#A32D2D' : undefined} />
        <Kpi label="Total outstanding" value={zar(kpis.outstanding)} accent={kpis.outstanding > 0 ? '#A32D2D' : undefined} />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSel}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_hold">On hold</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={filterSel}>
          <option value="all">All types</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={termsFilter} onChange={(e) => setTermsFilter(e.target.value)} className={filterSel}>
          <option value="all">All terms</option>
          {TERM_OPTIONS.map((t) => (
            <option key={t} value={String(t)}>
              {t === 0 ? 'COD' : `${t} days`}
            </option>
          ))}
        </select>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E6EC] bg-white px-3 text-[13px] text-[#6B6F68]">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="accent-[#3E7BC4]" />
          Has overdue
        </label>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-wide text-[#8A8E86]">
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-left font-medium">Type</th>
                <th className="px-2 py-2.5 text-left font-medium">Terms</th>
                <th className="px-2 py-2.5 text-right font-medium">Outstanding</th>
                <th className="px-2 py-2.5 text-left font-medium">Last invoice</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">
                    {customers.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-[15px] font-medium text-[#171A17]">No customers yet</p>
                        <p className="text-[13px] text-[#6B6F68]">Add your first customer, or import an existing book from Core Data.</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <PrimaryBtn onClick={openAdd}>+ Add customer</PrimaryBtn>
                          <Link
                            href="/app/docu/databases/customers"
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#171A17] transition-colors hover:bg-[#EEF1F5]"
                          >
                            Import
                          </Link>
                        </div>
                      </div>
                    ) : (
                      'No customers match these filters.'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const typeLabel = CUSTOMER_TYPES.find((t) => t.value === (r.c.customer_type ?? 'other'))?.label ?? 'Other';
                  const statusStyle = ACCOUNT_STATUS_STYLE[r.status];
                  return (
                    <tr
                      key={r.c.id}
                      onClick={() => router.push(`/app/orderflow/customers/${r.c.id}`)}
                      className="cursor-pointer border-b border-[#F5F9FE] last:border-0 hover:bg-[#F5F9FE]"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#171A17]">{r.c.name}</div>
                        {r.c.trading_name ? <div className="mt-0.5 text-[12px] text-[#8A8E86]">t/a {r.c.trading_name}</div> : null}
                      </td>
                      <td className="px-2 py-3 text-[#6B6F68]">{typeLabel}</td>
                      <td className="px-2 py-3 text-[#6B6F68]">{r.termsDays == null ? '—' : r.termsDays === 0 ? 'COD' : `${r.termsDays}d`}</td>
                      <td className="px-2 py-3 text-right tabular-nums" style={{ color: r.outstanding > 0 ? '#A32D2D' : '#8A8E86' }}>
                        {r.outstanding > 0 ? zar2(r.outstanding) : '—'}
                        {r.overdue ? <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#A32D2D]">overdue</span> : null}
                      </td>
                      <td className="px-2 py-3 text-[#6B6F68]">{fmtDate(r.lastInvoice)}</td>
                      <td className="px-2 py-3">
                        <Pill label={statusStyle.label} bg={statusStyle.bg} fg={statusStyle.fg} />
                      </td>
                      <td className="px-2 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <RowActionsMenu
                          actions={[
                            { label: 'Open profile', onClick: () => router.push(`/app/orderflow/customers/${r.c.id}`) },
                            { label: 'New quote', onClick: () => router.push(`/app/orderflow/quotes/new?customer=${r.c.id}`) },
                            { label: 'New invoice', onClick: () => router.push(`/app/orderflow/invoices/new?customer=${r.c.id}`) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add customer modal */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add customer"
        subtitle="Written to Core Data — available across every module."
        width={640}
        footer={
          <>
            <SecondaryBtn onClick={() => setAdding(false)}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={() => void saveNew()} disabled={busy || !draft.name.trim()}>
              {busy ? 'Saving…' : 'Add customer'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer name">
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Legal / account name" />
          </Field>
          <Field label="Trading name" hint="optional">
            <input className={inputClass} value={draft.trading_name} onChange={(e) => setDraft({ ...draft, trading_name: e.target.value })} placeholder="Trading as…" />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="accounts@…" />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="0…" />
          </Field>
          <Field label="Customer type">
            <select className={inputClass} value={draft.customer_type} onChange={(e) => setDraft({ ...draft, customer_type: e.target.value as CustomerType })}>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account status">
            <select className={inputClass} value={draft.account_status} onChange={(e) => setDraft({ ...draft, account_status: e.target.value as AccountStatus })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_hold">On hold</option>
            </select>
          </Field>
          <Field label="Payment terms" hint="days (0 = COD)">
            <input className={inputClass} type="number" value={draft.payment_terms_days} onChange={(e) => setDraft({ ...draft, payment_terms_days: e.target.value })} placeholder="30" />
          </Field>
          <Field label="Credit limit" hint="rands, optional">
            <input className={inputClass} type="number" value={draft.credit_limit} onChange={(e) => setDraft({ ...draft, credit_limit: e.target.value })} placeholder="0" />
          </Field>
          <Field label="VAT number" hint="optional">
            <input className={inputClass} value={draft.vat_number} onChange={(e) => setDraft({ ...draft, vat_number: e.target.value })} />
          </Field>
          <Field label="Registration number" hint="optional">
            <input className={inputClass} value={draft.registration_number} onChange={(e) => setDraft({ ...draft, registration_number: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Billing address" hint="optional">
              <textarea
                className={`${inputClass} h-auto py-2`}
                rows={2}
                value={draft.billing_address}
                onChange={(e) => setDraft({ ...draft, billing_address: e.target.value })}
                placeholder="Street, suburb, city, postal code"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tags" hint="comma-separated, optional">
              <input className={inputClass} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="key-account, weekly" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes" hint="optional">
              <textarea
                className={`${inputClass} h-auto py-2`}
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Anything the team should know"
              />
            </Field>
          </div>
        </div>
        {error ? <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div> : null}
      </Modal>
    </div>
  );
}
