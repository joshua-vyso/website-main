'use client';

/**
 * Credit notes list — KPIs (total credited, credited this month, count), search
 * + table with the linked invoice number, issue date, credit total (docTotals
 * over the note's items at the note's VAT rate) and status pill. "New credit
 * note" routes to the builder, where an invoice with an outstanding balance is
 * picked before crediting lines. Read-only view: all writes happen in the
 * builder / detail against of_credit_notes directly.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CreditNotesData } from '@/lib/platform/orderflow-data';
import {
  docTotals,
  zar,
  zar2,
  CREDIT_NOTE_STATUS_STYLE,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfInvoice,
} from '@/lib/platform/orderflow';
import { Kpi } from './ui';
import { EmptyState, Pill, SearchInput } from '@/components/platform/coredata/ui';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CreditNotesView({ data }: { data: CreditNotesData }) {
  const { creditNotes, items, invoices, customers } = data;
  const router = useRouter();
  const [search, setSearch] = useState('');

  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const itemsByNote = useMemo(() => {
    const m = new Map<string, OfCreditNoteItem[]>();
    for (const it of items) (m.get(it.credit_note_id) ?? m.set(it.credit_note_id, []).get(it.credit_note_id)!).push(it);
    return m;
  }, [items]);

  const enriched = useMemo(
    () =>
      creditNotes.map((cn) => {
        const its = itemsByNote.get(cn.id) ?? [];
        const total = docTotals(its, cn.vat_rate).total;
        const invoice: OfInvoice | null = cn.invoice_id ? invoiceById.get(cn.invoice_id) ?? null : null;
        const name = (cn.customer_id && customerName.get(cn.customer_id)) || 'No customer';
        return { cn, total, invoice, name };
      }),
    [creditNotes, itemsByNote, invoiceById, customerName],
  );

  const kpi = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let credited = 0;
    let thisMonth = 0;
    for (const e of enriched) {
      credited += e.total;
      if ((e.cn.issue_date || e.cn.created_at || '').slice(0, 7) === monthKey) thisMonth += e.total;
    }
    return { credited, thisMonth, count: enriched.length };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (e) =>
        e.cn.credit_number.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.invoice?.invoice_number ?? '').toLowerCase().includes(q) ||
        (e.cn.reason ?? '').toLowerCase().includes(q),
    );
  }, [enriched, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1A1C1E]">Credit notes</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">Credit a customer against an invoice for returns, shortfalls or adjustments</p>
        </div>
        <Link
          href="/app/orderflow/credit-notes/new"
          className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]"
        >
          + New credit note
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Total credited" value={zar(kpi.credited)} accent={kpi.credited > 0 ? '#854F0B' : undefined} />
        <Kpi label="Credited this month" value={zar(kpi.thisMonth)} accent={kpi.thisMonth > 0 ? '#854F0B' : undefined} />
        <Kpi label="Credit notes" value={String(kpi.count)} />
      </div>

      {/* Search */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search credit #, customer, invoice or reason…" />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-2.5 text-left font-medium">Credit #</th>
                <th className="px-2 py-2.5 text-left font-medium">Customer</th>
                <th className="px-2 py-2.5 text-left font-medium">Against invoice</th>
                <th className="px-2 py-2.5 text-left font-medium">Issued</th>
                <th className="px-2 py-2.5 text-right font-medium">Total</th>
                <th className="px-2 py-2.5 text-left font-medium">Reason</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="px-4 py-8">
                      <EmptyState
                        title="No credit notes yet"
                        body="Credit a customer against an outstanding invoice — for returns, shortfalls or price corrections."
                        action={
                          <Link
                            href="/app/orderflow/credit-notes/new"
                            className="inline-flex h-9 items-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]"
                          >
                            + New credit note
                          </Link>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[14px] text-[#9A9DA1]">
                    No credit notes match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const s = CREDIT_NOTE_STATUS_STYLE[e.cn.status];
                  return (
                    <tr
                      key={e.cn.id}
                      onClick={() => router.push(`/app/orderflow/credit-notes/${e.cn.id}`)}
                      className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]"
                    >
                      <td className="px-4 py-3 font-medium text-[#1A1C1E]">{e.cn.credit_number}</td>
                      <td className="px-2 py-3 text-[#1A1C1E]">{e.name}</td>
                      <td className="px-2 py-3">
                        {e.invoice ? (
                          <Link
                            href={`/app/orderflow/invoices/${e.invoice.id}`}
                            onClick={(ev) => ev.stopPropagation()}
                            className="font-medium text-[#1E5E54] hover:underline"
                          >
                            {e.invoice.invoice_number}
                          </Link>
                        ) : (
                          <span className="text-[#9A9DA1]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-[#5F6368]">{fmtDate(e.cn.issue_date)}</td>
                      <td className="px-2 py-3 text-right tabular-nums text-[#1A1C1E]">{zar2(e.total)}</td>
                      <td className="max-w-[220px] truncate px-2 py-3 text-[#5F6368]">{e.cn.reason || '—'}</td>
                      <td className="px-2 py-3">
                        <Pill label={s.label} bg={s.bg} fg={s.fg} />
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
