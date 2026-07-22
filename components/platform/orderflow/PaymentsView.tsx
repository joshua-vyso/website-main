'use client';

/**
 * Payments list — the receipts ledger across every invoice. Shows KPIs
 * (received this month / today, outstanding across all invoices, overdue
 * invoice count), a searchable + filterable table of recorded payments, and a
 * two-step "Record payment" flow: step 1 picks an open invoice (balance > 0),
 * step 2 hands off to the shared RecordPaymentModal (which inserts of_payments,
 * updates the invoice's effective status and logs the activity).
 *
 * Each row can attach a receipt: the file is uploaded to the 'documents' bucket
 * inline (we need the returned document id), a documents row is inserted, then
 * of_payments.receipt_document_id is set and a document_attached activity logged.
 *
 * Everything derives balances via docTotals + paymentsTotal + balanceDue
 * (contract rule 10). Empty-safe and migration-safe.
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useIsAdmin } from '@/components/platform/RoleGate';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { RecordPaymentModal } from '@/components/platform/orderflow/PaymentModal';
import { Kpi, useToast } from '@/components/platform/orderflow/ui';
import { EmptyState, Modal, PrimaryBtn, SearchInput, SecondaryBtn } from '@/components/platform/coredata/ui';
import {
  PAYMENT_METHODS,
  balanceDue,
  docTotals,
  effectiveInvoiceStatus,
  paymentsTotal,
  zar,
  zar2,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfCustomer,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
  type PaymentMethod,
} from '@/lib/platform/orderflow';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  eft: 'EFT',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

const METHOD_FILTERS: { value: 'all' | PaymentMethod; label: string }[] = [
  { value: 'all', label: 'All methods' },
  ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
];

const MAX_MB = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // paid_on is a plain date (yyyy-mm-dd); anchor to midday so tz never shifts it.
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Same-month check against now, ignoring time-of-day/tz drift. */
function isSameMonth(iso: string, now: Date): boolean {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function PaymentsView({
  payments,
  invoices,
  invoiceItems,
  creditNotes,
  creditNoteItems,
  customers,
}: {
  payments: OfPayment[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  customers: OfCustomer[];
}) {
  // Recording payments is owner/admin-only (RLS). Members can view the ledger but not add.
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'all' | PaymentMethod>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Two-step record flow: pick an open invoice → RecordPaymentModal.
  const [picking, setPicking] = useState(false);
  const [payFor, setPayFor] = useState<OfInvoice | null>(null);

  const custName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  // Invoice items grouped by invoice for total computation.
  const itemsByInvoice = useMemo(() => {
    const m = new Map<string, OfInvoiceItem[]>();
    for (const it of invoiceItems) {
      const arr = m.get(it.invoice_id);
      if (arr) arr.push(it);
      else m.set(it.invoice_id, [it]);
    }
    return m;
  }, [invoiceItems]);

  // Payments grouped by invoice.
  const paymentsByInvoice = useMemo(() => {
    const m = new Map<string, OfPayment[]>();
    for (const p of payments) {
      const arr = m.get(p.invoice_id);
      if (arr) arr.push(p);
      else m.set(p.invoice_id, [p]);
    }
    return m;
  }, [payments]);

  // Credited amount per invoice — only ISSUED credit notes reduce the balance.
  const creditedByInvoice = useMemo(() => {
    const cnItemsByNote = new Map<string, OfCreditNoteItem[]>();
    for (const it of creditNoteItems) {
      const arr = cnItemsByNote.get(it.credit_note_id);
      if (arr) arr.push(it);
      else cnItemsByNote.set(it.credit_note_id, [it]);
    }
    const m = new Map<string, number>();
    for (const cn of creditNotes) {
      if (cn.status !== 'issued' || !cn.invoice_id) continue;
      const total = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      m.set(cn.invoice_id, (m.get(cn.invoice_id) ?? 0) + total);
    }
    return m;
  }, [creditNotes, creditNoteItems]);

  // Per-invoice derived total / paid / credited / balance.
  const invoiceDerived = useMemo(() => {
    const m = new Map<string, { total: number; paid: number; credited: number; balance: number }>();
    for (const inv of invoices) {
      const total = docTotals(itemsByInvoice.get(inv.id) ?? [], inv.vat_rate, inv.discount, inv.rebate_pct ?? 0).total;
      const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
      const credited = creditedByInvoice.get(inv.id) ?? 0;
      m.set(inv.id, { total, paid, credited, balance: balanceDue(total, paid, credited) });
    }
    return m;
  }, [invoices, itemsByInvoice, paymentsByInvoice, creditedByInvoice]);

  // KPIs.
  const kpis = useMemo(() => {
    const now = new Date();
    let month = 0;
    let today = 0;
    for (const p of payments) {
      const amt = Number(p.amount) || 0;
      if (isSameMonth(p.paid_on, now)) month += amt;
      if (isSameDay(p.paid_on, now)) today += amt;
    }
    let outstanding = 0;
    let overdue = 0;
    for (const inv of invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft') continue;
      const d = invoiceDerived.get(inv.id);
      if (!d) continue;
      outstanding += d.balance;
      const eff = effectiveInvoiceStatus(inv, d.paid, d.total, now);
      if (eff === 'overdue') overdue += 1;
    }
    return { month, today, outstanding, overdue };
  }, [payments, invoices, invoiceDerived]);

  // Open invoices (balance > 0), most recent first — for the picker.
  const openInvoices = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== 'cancelled' && inv.status !== 'draft')
      .map((inv) => ({ inv, d: invoiceDerived.get(inv.id) }))
      .filter((x) => x.d != null && x.d.balance > 0.005)
      .sort((a, b) => (a.inv.created_at < b.inv.created_at ? 1 : -1));
  }, [invoices, invoiceDerived]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate || null;
    const to = toDate || null;
    return payments.filter((p) => {
      if (method !== 'all' && p.method !== method) return false;
      // paid_on is yyyy-mm-dd so string comparison is a valid date-range test.
      if (from && p.paid_on < from) return false;
      if (to && p.paid_on > to) return false;
      if (!q) return true;
      const inv = invoiceById.get(p.invoice_id);
      const name = (p.customer_id && custName.get(p.customer_id)) || '';
      return (
        (inv?.invoice_number ?? '').toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        (p.reference ?? '').toLowerCase().includes(q)
      );
    });
  }, [payments, method, fromDate, toDate, query, invoiceById, custName]);

  const payForDerived = payFor ? invoiceDerived.get(payFor.id) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-[#171A17]">Payments</h1>
          <p className="mt-0.5 text-[13px] text-[#6B6F68]">
            Every receipt across your invoices — record payments and attach proof.
          </p>
        </div>
        {isAdmin ? <PrimaryBtn onClick={() => setPicking(true)}>+ Record payment</PrimaryBtn> : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Received this month" value={zar(kpis.month)} accent="#0F6E56" />
        <Kpi label="Received today" value={zar(kpis.today)} />
        <Kpi label="Outstanding" value={zar(kpis.outstanding)} accent={kpis.outstanding > 0 ? '#854F0B' : undefined} />
        <Kpi
          label="Overdue invoices"
          value={String(kpis.overdue)}
          accent={kpis.overdue > 0 ? '#A32D2D' : undefined}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search invoice, customer, reference…" />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as 'all' | PaymentMethod)}
          className="h-9 rounded-lg border border-[#E2E6EC] bg-white px-3 text-[13px] text-[#171A17]"
        >
          {METHOD_FILTERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-[12px] text-[#6B6F68]">
          <span>From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#171A17]"
          />
          <span>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#171A17]"
          />
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-[12px] font-medium text-[#1F5FA8] hover:text-[#174C87]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        {payments.length === 0 ? (
          <EmptyState
            title="No payments recorded yet"
            body="Record a payment against an open invoice to start building your receipts ledger."
            action={isAdmin ? <PrimaryBtn onClick={() => setPicking(true)}>+ Record payment</PrimaryBtn> : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching payments" body="Try a different search, method or date range." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#EAEDF2] text-[11px] uppercase tracking-wide text-[#8A8E86]">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const inv = invoiceById.get(p.invoice_id);
                  const name = (p.customer_id && custName.get(p.customer_id)) || 'No customer';
                  return (
                    <tr key={p.id} className="border-b border-[#EEF1F5] transition-colors last:border-0 hover:bg-[#F5F9FE]">
                      <td className="whitespace-nowrap px-4 py-3 text-[#6B6F68]">{fmtDate(p.paid_on)}</td>
                      <td className="px-4 py-3 text-[#171A17]">{name}</td>
                      <td className="px-4 py-3">
                        {inv ? (
                          <Link
                            href={`/app/orderflow/invoices/${inv.id}`}
                            className="font-medium text-[#1F5FA8] hover:text-[#174C87]"
                          >
                            {inv.invoice_number}
                          </Link>
                        ) : (
                          <span className="text-[#8A8E86]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-[#171A17]">
                        {zar2(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-[#6B6F68]">{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-4 py-3 text-[#6B6F68]">
                        {p.reference ? p.reference : <span className="text-[#8A8E86]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ReceiptCell payment={p} invoiceNumber={inv?.invoice_number ?? ''} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PickInvoiceModal
        open={picking}
        onClose={() => setPicking(false)}
        openInvoices={openInvoices}
        custName={custName}
        onPick={(inv) => {
          setPicking(false);
          setPayFor(inv);
        }}
      />

      {payFor ? (
        <RecordPaymentModal
          open
          onClose={() => setPayFor(null)}
          invoice={payFor}
          paidSoFar={payForDerived?.paid ?? 0}
          total={Math.max(0, (payForDerived?.total ?? 0) - (payForDerived?.credited ?? 0))}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — pick an open invoice (balance > 0)
// ---------------------------------------------------------------------------

function PickInvoiceModal({
  open,
  onClose,
  openInvoices,
  custName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  openInvoices: { inv: OfInvoice; d?: { total: number; paid: number; credited: number; balance: number } }[];
  custName: Map<string, string>;
  onPick: (inv: OfInvoice) => void;
}) {
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openInvoices
      .filter(({ inv }) => {
        if (!q) return true;
        const name = (inv.customer_id && custName.get(inv.customer_id)) || '';
        return inv.invoice_number.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [openInvoices, search, custName]);

  function close() {
    setSearch('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Record payment"
      subtitle="Pick the invoice this payment settles."
      width={540}
      footer={
        <div className="flex items-center justify-end">
          <SecondaryBtn onClick={close}>Cancel</SecondaryBtn>
        </div>
      }
    >
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoice number or customer…" />
      </div>

      <div className="max-h-[340px] overflow-y-auto rounded-xl border border-[#EAEDF2]">
        {openInvoices.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-[#8A8E86]">
            No open invoices — every invoice is fully paid.
          </p>
        ) : results.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-[#8A8E86]">No invoices match that search.</p>
        ) : (
          <ul className="divide-y divide-[#EEF1F5]">
            {results.map(({ inv, d }) => (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => onPick(inv)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[#F5F9FE]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-[#171A17]">{inv.invoice_number}</div>
                    <div className="truncate text-[12px] text-[#6B6F68]">
                      {(inv.customer_id && custName.get(inv.customer_id)) || 'No customer'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Balance</div>
                    <div className="tabular-nums text-[13px] font-semibold text-[#854F0B]">{zar2(d?.balance ?? 0)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Receipt cell — attach a receipt to a payment (inline upload → documents row →
// of_payments.receipt_document_id → document_attached activity).
// ---------------------------------------------------------------------------

function ReceiptCell({ payment, invoiceNumber }: { payment: OfPayment; invoiceNumber: string }) {
  const router = useRouter();
  const { org, email, userId } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<boolean>(Boolean(payment.receipt_document_id));
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    const okType =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      /\.(pdf|png|jpe?g)$/i.test(file.name);
    if (!okType) {
      setError('Only PDF, JPG or PNG.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB}MB.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const path = `${org.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadErr) throw uploadErr;

      // Insert the documents row FIRST so we can link its id back onto the payment.
      const { data: inserted, error: insertErr } = await supabase
        .from('documents')
        .insert({
          org_id: org.id,
          filename: file.name,
          status: 'reviewed',
          document_type: 'receipt',
          storage_path: path,
          uploaded_by: userId,
          entity_type: 'payment',
          entity_id: payment.id,
          customer_id: payment.customer_id ?? null,
        })
        .select('id')
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error('Could not save the receipt.');

      const { error: linkErr } = await supabase
        .from('of_payments')
        .update({ receipt_document_id: inserted.id })
        .eq('id', payment.id);
      if (linkErr) throw linkErr;

      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'payment',
        entityId: payment.id,
        customerId: payment.customer_id ?? null,
        event: 'document_attached',
        description: invoiceNumber ? `Receipt for ${invoiceNumber}` : 'Receipt attached',
      });

      setAttached(true);
      toast('Receipt attached');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setError(/does not exist|schema cache|column/i.test(msg) ? 'Run supabase/core-data.sql to enable receipts.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {attached ? (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F6E56]">✓ Attached</span>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#E2E6EC] bg-white px-2.5 text-[12px] font-medium text-[#171A17] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-60"
        >
          {busy ? 'Uploading…' : '↑ Attach receipt'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {error ? <span className="text-[11px] text-[#A32D2D]">{error}</span> : null}
      {toastNode}
    </div>
  );
}
