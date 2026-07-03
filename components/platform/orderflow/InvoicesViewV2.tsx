'use client';

/**
 * Invoices list — the heart of OrderFlow. KPI health row, status tabs on the
 * EFFECTIVE status (derived from payments + due date, credits subtracted from
 * the balance), search, CSV export and per-row actions (send, record payment,
 * duplicate, credit note, cancel draft). All writes hit Supabase directly and
 * log activity.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  INVOICE_STATUS_STYLE,
  balanceDue,
  docTotals,
  effectiveInvoiceStatus,
  paymentsTotal,
  zar,
  zar2,
  type InvoiceStatus,
  type OfInvoice,
} from '@/lib/platform/orderflow';
import type { InvoicesData } from '@/lib/platform/orderflow-data';
import { downloadCsv } from '@/lib/platform/csv';
import { ConfirmDialog, EmptyState, SearchInput, SecondaryBtn } from '@/components/platform/coredata/ui';
import { Kpi, RowActionsMenu, useToast, type RowAction } from './ui';
import { RecordPaymentModal } from './PaymentModal';

interface Row {
  inv: OfInvoice;
  customerName: string;
  total: number;
  paid: number;
  credited: number;
  balance: number;
  eff: InvoiceStatus;
}

type TabKey = 'all' | 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credited';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'partially_paid', label: 'Part-paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'credited', label: 'Credited' },
];

/** 'viewed' rolls up under the Sent tab — it's a sent invoice the customer opened. */
function inTab(eff: InvoiceStatus, tab: TabKey): boolean {
  if (tab === 'all') return true;
  if (tab === 'sent') return eff === 'sent' || eff === 'viewed';
  return eff === tab;
}

const OPEN_STATUSES: InvoiceStatus[] = ['sent', 'viewed', 'partially_paid', 'overdue'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function friendlyError(message: string | undefined): string {
  if (!message) return 'Something went wrong.';
  if (/does not exist|schema cache/i.test(message)) return 'Run supabase/core-data.sql to enable invoices.';
  return message;
}

export function InvoicesViewV2({ data }: { data: InvoicesData }) {
  const router = useRouter();
  const { org, email } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [payRow, setPayRow] = useState<Row | null>(null);
  const [cancelRow, setCancelRow] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const custName = useMemo(() => new Map(data.customers.map((c) => [c.id, c.name])), [data.customers]);

  const rows = useMemo<Row[]>(() => {
    const itemsByInvoice = new Map<string, typeof data.items>();
    for (const it of data.items) {
      const list = itemsByInvoice.get(it.invoice_id) ?? [];
      list.push(it);
      itemsByInvoice.set(it.invoice_id, list);
    }
    const paymentsByInvoice = new Map<string, typeof data.payments>();
    for (const p of data.payments) {
      const list = paymentsByInvoice.get(p.invoice_id) ?? [];
      list.push(p);
      paymentsByInvoice.set(p.invoice_id, list);
    }
    const cnItemsByNote = new Map<string, typeof data.creditNoteItems>();
    for (const ci of data.creditNoteItems) {
      const list = cnItemsByNote.get(ci.credit_note_id) ?? [];
      list.push(ci);
      cnItemsByNote.set(ci.credit_note_id, list);
    }
    const creditedByInvoice = new Map<string, number>();
    for (const cn of data.creditNotes) {
      if (!cn.invoice_id) continue;
      const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      creditedByInvoice.set(cn.invoice_id, (creditedByInvoice.get(cn.invoice_id) ?? 0) + cnTotal);
    }

    const now = new Date();
    return data.invoices.map((inv) => {
      const total = docTotals(itemsByInvoice.get(inv.id) ?? [], inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
      const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
      const credited = creditedByInvoice.get(inv.id) ?? 0;
      return {
        inv,
        customerName: (inv.customer_id && custName.get(inv.customer_id)) || 'No customer',
        total,
        paid,
        credited,
        balance: balanceDue(total, paid, credited),
        eff: effectiveInvoiceStatus(inv, paid, total, now),
      };
    });
  }, [data, custName]);

  // ---- KPI health row ----
  const kpis = useMemo(() => {
    const open = rows.filter((r) => OPEN_STATUSES.includes(r.eff));
    const outstanding = open.reduce((s, r) => s + r.balance, 0);
    const overdueRows = rows.filter((r) => r.eff === 'overdue');
    const overdue = overdueRows.reduce((s, r) => s + r.balance, 0);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().slice(0, 10);
    const dueWeekRows = open.filter((r) => r.inv.due_date && r.inv.due_date >= start && r.inv.due_date <= end && r.balance > 0);
    const dueWeek = dueWeekRows.reduce((s, r) => s + r.balance, 0);

    const monthKey = start.slice(0, 7);
    const paidMonth = data.payments
      .filter((p) => (p.paid_on ?? '').slice(0, 7) === monthKey)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    return { outstanding, openCount: open.length, overdue, overdueCount: overdueRows.length, dueWeek, dueWeekCount: dueWeekRows.length, paidMonth };
  }, [rows, data.payments]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!inTab(r.eff, tab)) return false;
      if (!q) return true;
      return (
        r.inv.invoice_number.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.inv.customer_po ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, tab, search]);

  const tabCounts = useMemo(() => {
    const m = new Map<TabKey, number>();
    for (const t of TABS) m.set(t.key, rows.filter((r) => inTab(r.eff, t.key)).length);
    return m;
  }, [rows]);

  // ---- Writes ----
  async function send(row: Row) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setBusyId(row.inv.id);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('of_invoices')
      .update({ status: 'sent', sent_at: nowIso, updated_at: nowIso })
      .eq('id', row.inv.id);
    setBusyId(null);
    if (error) {
      toast(friendlyError(error.message));
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'invoice',
      entityId: row.inv.id,
      customerId: row.inv.customer_id,
      event: 'invoice_sent',
      description: `${row.inv.invoice_number} marked as sent`,
    });
    toast(`${row.inv.invoice_number} marked as sent`);
    router.refresh();
  }

  async function cancelDraft(row: Row) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    setCancelRow(null);
    setBusyId(row.inv.id);
    const { error } = await supabase
      .from('of_invoices')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', row.inv.id);
    setBusyId(null);
    if (error) {
      toast(friendlyError(error.message));
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'invoice',
      entityId: row.inv.id,
      customerId: row.inv.customer_id,
      event: 'invoice_cancelled',
      description: `${row.inv.invoice_number} cancelled`,
    });
    toast(`${row.inv.invoice_number} cancelled`);
    router.refresh();
  }

  function exportCsv() {
    downloadCsv(
      'invoices',
      ['Number', 'Customer', 'Issue date', 'Due date', 'Customer PO', 'Amount', 'Paid', 'Credited', 'Balance due', 'Status', 'Last sent'],
      filtered.map((r) => [
        r.inv.invoice_number,
        r.customerName,
        r.inv.issue_date,
        r.inv.due_date ?? '',
        r.inv.customer_po ?? '',
        r.total.toFixed(2),
        r.paid.toFixed(2),
        r.credited.toFixed(2),
        r.balance.toFixed(2),
        INVOICE_STATUS_STYLE[r.eff].label,
        r.inv.sent_at ? fmtDate(r.inv.sent_at) : '',
      ]),
    );
  }

  function rowActions(r: Row): RowAction[] {
    const href = `/app/orderflow/invoices/${r.inv.id}`;
    const settled = r.eff === 'draft' || r.eff === 'cancelled' || r.eff === 'credited';
    const actions: RowAction[] = [{ label: 'View', onClick: () => router.push(href) }];
    if (r.eff === 'draft') {
      actions.push({ label: 'Edit draft', onClick: () => router.push(`/app/orderflow/invoices/new?edit=${r.inv.id}`) });
      actions.push({ label: 'Send', onClick: () => void send(r) });
    }
    actions.push({ label: 'Download PDF', onClick: () => router.push(`${href}?print=1`) });
    actions.push({ label: 'Duplicate', onClick: () => router.push(`/app/orderflow/invoices/new?duplicate=${r.inv.id}`) });
    if (!settled && r.balance > 0) actions.push({ label: 'Record payment', onClick: () => setPayRow(r) });
    if (!settled) actions.push({ label: 'Create credit note', onClick: () => router.push(`/app/orderflow/credit-notes/new?invoice=${r.inv.id}`) });
    if (r.eff === 'draft') actions.push({ label: 'Cancel draft', danger: true, onClick: () => setCancelRow(r) });
    return actions;
  }

  return (
    <div>
      {toastNode}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Invoices</h1>
          <p className="mt-0.5 text-[13px] text-[#5F6368]">Everything you&apos;ve billed — who owes what, and when it&apos;s due.</p>
        </div>
        <Link
          href="/app/orderflow/invoices/new"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]"
        >
          + New invoice
        </Link>
      </div>

      {/* KPI health row */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Outstanding" value={zar(kpis.outstanding)} sub={`${kpis.openCount} open invoice${kpis.openCount === 1 ? '' : 's'}`} />
        <Kpi
          label="Overdue"
          value={zar(kpis.overdue)}
          accent={kpis.overdue > 0 ? '#A32D2D' : undefined}
          sub={`${kpis.overdueCount} invoice${kpis.overdueCount === 1 ? '' : 's'} past due`}
        />
        <Kpi
          label="Due this week"
          value={zar(kpis.dueWeek)}
          accent={kpis.dueWeek > 0 ? '#854F0B' : undefined}
          sub={`${kpis.dueWeekCount} falling due in 7 days`}
        />
        <Kpi label="Paid this month" value={zar(kpis.paidMonth)} accent="#0F6E56" sub="payments received" />
      </div>

      {/* Tabs + search + export */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const count = tabCounts.get(t.key) ?? 0;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                  tab === t.key
                    ? 'border-[#1E5E54] bg-[#1E5E54] text-white'
                    : 'border-[#D7DAD8] bg-white text-[#5F6368] hover:border-[#1E5E54]/40'
                }`}
              >
                {t.label}
                {count > 0 ? <span className={`ml-1.5 tabular-nums ${tab === t.key ? 'text-white/70' : 'text-[#9A9DA1]'}`}>{count}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search number, customer, PO…" />
          <SecondaryBtn onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </SecondaryBtn>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5">
        {data.invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            body="Create your first invoice, or convert a quote or order into one. If invoices don't save, run supabase/core-data.sql against your project first."
            action={
              <Link
                href="/app/orderflow/invoices/new"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]"
              >
                + New invoice
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching invoices" body="Try a different search or status tab." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead>
                <tr className="border-b border-[#E7E7E2] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                  <th className="px-4 py-3 text-left font-medium">Number</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Due</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Balance due</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last sent</th>
                  <th className="w-[52px] px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = INVOICE_STATUS_STYLE[r.eff];
                  return (
                    <tr
                      key={r.inv.id}
                      onClick={() => router.push(`/app/orderflow/invoices/${r.inv.id}`)}
                      className={`cursor-pointer border-b border-[#F0F0EC] transition-colors last:border-0 hover:bg-[#FAFAF8] ${
                        busyId === r.inv.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#1E5E54]">{r.inv.invoice_number}</span>
                        {r.inv.customer_po ? <span className="mt-0.5 block text-[11px] text-[#9A9DA1]">PO {r.inv.customer_po}</span> : null}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-[#1A1C1E]">{r.customerName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#5F6368]">{fmtDate(r.inv.issue_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#5F6368]">{fmtDate(r.inv.due_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#1A1C1E]">{zar2(r.total)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <span className={r.balance > 0 && r.eff === 'overdue' ? 'font-medium text-[#A32D2D]' : r.balance > 0 ? 'font-medium text-[#1A1C1E]' : 'text-[#9A9DA1]'}>
                          {zar2(r.balance)}
                        </span>
                        {r.credited > 0 ? <span className="mt-0.5 block text-[11px] text-[#9A9DA1]">−{zar2(r.credited)} credited</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#5F6368]">{r.inv.sent_at ? fmtDate(r.inv.sent_at) : '—'}</td>
                      <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu actions={rowActions(r)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record payment — total is net of credit notes so the default amount
          and the status recompute both land on the true balance. */}
      {payRow ? (
        <RecordPaymentModal
          open
          onClose={() => setPayRow(null)}
          invoice={payRow.inv}
          paidSoFar={payRow.paid}
          total={Math.max(0, payRow.total - payRow.credited)}
          onRecorded={() => setPayRow(null)}
        />
      ) : null}

      {/* Cancel draft */}
      <ConfirmDialog
        open={!!cancelRow}
        title={cancelRow ? `Cancel ${cancelRow.inv.invoice_number}?` : 'Cancel invoice?'}
        body="The draft stays on record as cancelled — it won't count towards your numbers."
        confirmLabel="Cancel invoice"
        danger
        onConfirm={() => cancelRow && void cancelDraft(cancelRow)}
        onClose={() => setCancelRow(null)}
      />
    </div>
  );
}
