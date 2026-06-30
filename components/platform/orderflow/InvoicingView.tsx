'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { invoiceNumber, withVat, zar, zar2 } from '@/lib/platform/orderflow';
import { orderActivity, type Invoice, type OrderLite } from '@/lib/platform/orderflow-crm';
import { Kpi, InvoiceStatusBadge, RowActionsMenu, Drawer, useToast } from './ui';
import type { OrderItemLite } from './OrdersView';

export interface CustomerContactLite {
  name: string;
  email: string | null;
  phone: string | null;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function orderRef(id: string) {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

export function InvoicingView({
  invoices,
  items,
  customers,
  startSeq,
}: {
  invoices: Invoice[];
  items: Record<string, OrderItemLite[]>;
  customers: Record<string, CustomerContactLite>;
  startSeq: number;
}) {
  const router = useRouter();
  const { node: toastNode, show: toast } = useToast();
  const now = Date.now();
  const [seq, setSeq] = useState(startSeq);
  const [busy, setBusy] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const health = useMemo(() => {
    const weekAhead = now + 7 * 86_400_000;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    let outstanding = 0;
    let overdue = 0;
    let dueWeek = 0;
    let paidMonth = 0;
    let partial = 0;
    let draft = 0;
    for (const inv of invoices) {
      if (inv.status === 'cancelled') continue;
      if (inv.status === 'draft') draft++;
      if (inv.status === 'partially_paid') partial++;
      if (inv.balance > 0 && inv.status !== 'draft') outstanding += inv.balance;
      if (inv.status === 'overdue') overdue += inv.balance;
      else if (inv.balance > 0 && new Date(inv.due).getTime() <= weekAhead && new Date(inv.due).getTime() >= now) dueWeek += inv.balance;
      for (const p of inv.payments) if (new Date(p.date).getTime() >= monthStart) paidMonth += p.amount;
    }
    return { outstanding, overdue, dueWeek, paidMonth, partial, draft };
  }, [invoices, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (q && !`${inv.number} ${inv.customerName} ${orderRef(inv.orderId)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, search, statusFilter]);

  async function generate(inv: Invoice) {
    const supabase = createClient();
    if (!supabase || busy) return;
    setBusy(inv.id);
    const num = invoiceNumber(seq);
    await supabase.from('of_orders').update({ invoice_number: num, status: 'invoiced' }).eq('id', inv.orderId);
    setSeq((n) => n + 1);
    setBusy(null);
    router.refresh();
  }
  async function markPaid(inv: Invoice) {
    const supabase = createClient();
    if (!supabase || busy) return;
    setBusy(inv.id);
    await supabase.from('of_orders').update({ status: 'paid' }).eq('id', inv.orderId);
    setBusy(null);
    setDrawerId(null);
    router.refresh();
  }

  const drawer = drawerId ? invoices.find((i) => i.id === drawerId) ?? null : null;
  const filterSel = 'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]';

  return (
    <div>
      {toastNode}
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Invoicing</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">Issue invoices, track payments and stay on top of what&rsquo;s owed</p>
      </div>

      {/* Invoice health */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Outstanding" value={zar(health.outstanding)} accent={health.outstanding > 0 ? '#A32D2D' : undefined} />
        <Kpi label="Overdue" value={zar(health.overdue)} accent={health.overdue > 0 ? '#A32D2D' : undefined} />
        <Kpi label="Due this week" value={zar(health.dueWeek)} accent={health.dueWeek > 0 ? '#854F0B' : undefined} />
        <Kpi label="Paid this month" value={zar(health.paidMonth)} accent="#0F6E56" />
        <Kpi label="Partially paid" value={String(health.partial)} />
        <Kpi label="Draft invoices" value={String(health.draft)} />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice #, customer or order…"
          className="h-9 min-w-[240px] flex-1 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#1E5E54]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSel}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="partially_paid">Part-paid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-3 py-2.5 text-left font-medium">Invoice #</th>
                <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-left font-medium">Order</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="px-2 py-2.5 text-left font-medium">Issued</th>
                <th className="px-2 py-2.5 text-left font-medium">Due</th>
                <th className="px-2 py-2.5 text-right font-medium">Total</th>
                <th className="px-2 py-2.5 text-right font-medium">Paid</th>
                <th className="px-2 py-2.5 text-right font-medium">Balance</th>
                <th className="w-[120px] px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                    {invoices.length === 0 ? 'No invoices yet — confirm an order to invoice it.' : 'No invoices match.'}
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} onClick={() => setDrawerId(inv.id)} className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                    <td className="px-3 py-3 font-medium text-[#1A1C1E]">{inv.status === 'draft' ? '—' : inv.number}</td>
                    <td className="px-2 py-3 text-[#1A1C1E]">{inv.customerName}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/app/orderflow/orders/${inv.orderId}`} className="text-[#1E5E54] hover:underline">{orderRef(inv.orderId)}</Link>
                    </td>
                    <td className="px-2 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                    <td className="px-2 py-3 text-[#5F6368]">{inv.status === 'draft' ? '—' : fmtDate(inv.issued)}</td>
                    <td className="px-2 py-3 text-[#5F6368]">{inv.status === 'draft' ? '—' : fmtDate(inv.due)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#1A1C1E]">{zar(inv.total)}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-[#5F6368]">{inv.paid > 0 ? zar(inv.paid) : '—'}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-medium" style={{ color: inv.balance > 0 ? '#A32D2D' : '#0F6E56' }}>{zar(inv.balance)}</td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {inv.status === 'draft' ? (
                        <button type="button" onClick={() => void generate(inv)} disabled={busy === inv.id} className="rounded-lg bg-[#854F0B] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#6f4109] disabled:opacity-40">
                          {busy === inv.id ? '…' : 'Generate'}
                        </button>
                      ) : (
                        <RowActionsMenu
                          actions={[
                            { label: 'View invoice', onClick: () => setDrawerId(inv.id) },
                            { label: 'Email invoice', onClick: () => toast(`Invoice emailed to ${inv.customerName} (demo)`) },
                            { label: 'Record payment', onClick: () => toast('Record payment (demo)') },
                            { label: 'Mark paid', onClick: () => void markPaid(inv) },
                            { label: 'Send reminder', onClick: () => toast('Reminder sent (demo)') },
                            { label: 'Download PDF', onClick: () => toast('PDF downloaded (demo)') },
                            { label: 'Void invoice', onClick: () => toast('Invoice voided (demo)'), danger: true },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={!!drawer}
        onClose={() => setDrawerId(null)}
        title={drawer ? (drawer.status === 'draft' ? 'Draft invoice' : drawer.number) : ''}
        subtitle={drawer ? drawer.customerName : undefined}
        right={drawer ? <InvoiceStatusBadge status={drawer.status} /> : undefined}
        width={520}
        footer={
          drawer ? (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => toast('PDF downloaded (demo)')} className="text-[13px] font-medium text-[#5F6368] hover:text-[#1A1C1E]">Download PDF</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => toast('Reminder sent (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">Send reminder</button>
                {drawer.balance > 0 ? (
                  <button type="button" onClick={() => void markPaid(drawer)} className="rounded-lg bg-[#1E5E54] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">Mark paid</button>
                ) : null}
              </div>
            </div>
          ) : undefined
        }
      >
        {drawer ? <InvoiceDrawerBody inv={drawer} items={items[drawer.orderId] ?? []} contact={drawer.customerId ? customers[drawer.customerId] : undefined} /> : null}
      </Drawer>
    </div>
  );
}

function InvoiceDrawerBody({ inv, items, contact }: { inv: Invoice; items: OrderItemLite[]; contact?: CustomerContactLite }) {
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const v = withVat(subtotal);
  const activity = orderActivity({ id: inv.orderId, customer_id: inv.customerId, status: 'invoiced', invoice_number: inv.number, created_at: inv.issued, total: inv.total, item_count: items.length } as OrderLite, inv.customerName);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <Field label="Linked order"><Link href={`/app/orderflow/orders/${inv.orderId}`} className="text-[#1E5E54] hover:underline">{orderRef(inv.orderId)}</Link></Field>
        <Field label="Issued">{inv.status === 'draft' ? 'Not issued' : fmtDate(inv.issued)}</Field>
        <Field label="Due">{inv.status === 'draft' ? '—' : fmtDate(inv.due)}</Field>
        <Field label="Balance"><span className="font-semibold" style={{ color: inv.balance > 0 ? '#A32D2D' : '#0F6E56' }}>{zar2(inv.balance)}</span></Field>
      </div>

      <Section title="Line items">
        <table className="w-full text-[13px]">
          <tbody>
            {items.length === 0 ? (
              <tr><td className="py-4 text-center text-[#9A9DA1]">No items.</td></tr>
            ) : (
              items.map((i, idx) => (
                <tr key={idx} className="border-b border-[#F6F6F2] last:border-0">
                  <td className="py-2 pr-2 text-[#1A1C1E]">{i.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#5F6368]">{i.qty}{i.unit ? ` ${i.unit}` : ''}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium text-[#1A1C1E]">{zar((Number(i.qty) || 0) * (Number(i.unit_price) || 0))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="mt-3 space-y-1 border-t border-[#F0F0EC] pt-3 text-[13px]">
          <Row label="Subtotal" value={zar(v.subtotal)} />
          <Row label="VAT (15%)" value={zar(v.vat)} muted />
          <Row label="Total" value={zar(v.total)} bold />
          <Row label="Paid" value={zar(inv.paid)} muted />
          <Row label="Balance" value={zar(inv.balance)} bold />
        </div>
      </Section>

      <Section title="Payment history">
        {inv.payments.length === 0 ? (
          <p className="text-[13px] text-[#9A9DA1]">No payments recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2 text-[13px]">
            {inv.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-[#5F6368]">{fmtDate(p.date)} · {p.method} · {p.reference}</span>
                <span className="font-medium tabular-nums text-[#0F6E56]">{zar(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {contact ? (
        <Section title="Customer contact">
          <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3 text-[13px]">
            <div className="font-medium text-[#1A1C1E]">{contact.name}</div>
            <div className="mt-0.5 text-[#5F6368]">{contact.email ?? '—'}{contact.phone ? ` · ${contact.phone}` : ''}</div>
          </div>
        </Section>
      ) : null}

      <Section title="Activity">
        <div className="flex flex-col gap-3">
          {activity.map((a) => (
            <div key={a.id} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" />
              <div className="min-w-0">
                <div className="text-[#1A1C1E]">{a.label}{a.detail ? <span className="text-[#9A9DA1]"> · {a.detail}</span> : null}</div>
                <div className="text-[11px] text-[#9A9DA1]">{fmtDate(a.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[#1A1C1E]">{children}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-[#1A1C1E]">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-[#9A9DA1]' : 'text-[#5F6368]'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-[#1A1C1E]' : 'text-[#1A1C1E]'}`}>{value}</span>
    </div>
  );
}
