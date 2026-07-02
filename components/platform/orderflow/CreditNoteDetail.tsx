'use client';

/**
 * Credit note detail — the printable DocSheet plus a small toolbar (back link,
 * credit total, download PDF). Meta shows the issue date, the invoice this note
 * credits (with a link) and the reason. Totals are plain positive values (a
 * credit note is a standalone document; it doesn't render negative amounts).
 */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  docTotals,
  CREDIT_NOTE_STATUS_STYLE,
  zar2,
  type OfCreditNote,
  type OfCreditNoteItem,
  type OfCustomer,
  type OfInvoice,
} from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';
import { DocSheet, PrintButton, type DocSheetLine } from './DocSheet';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CreditNoteDetail({
  creditNote,
  items,
  customer,
  invoice,
  companyProfile,
  orgName,
}: {
  creditNote: OfCreditNote | null;
  items: OfCreditNoteItem[];
  customer: OfCustomer | null;
  invoice: OfInvoice | null;
  companyProfile: CdCompanyProfile | null;
  orgName: string | null;
}) {
  const searchParams = useSearchParams();

  // Download-from-list deep link (?print=1) auto-opens the print dialog once.
  useEffect(() => {
    if (creditNote && searchParams?.get('print') === '1') {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [creditNote, searchParams]);

  const total = useMemo(() => (creditNote ? docTotals(items, creditNote.vat_rate).total : 0), [creditNote, items]);

  if (!creditNote) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Credit note not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">It may have been deleted.</p>
        <Link href="/app/orderflow/credit-notes" className="mt-3 inline-block text-[13px] font-medium text-[#1E5E54] hover:underline">
          ← Back to credit notes
        </Link>
      </div>
    );
  }

  const cn = creditNote;
  const s = CREDIT_NOTE_STATUS_STYLE[cn.status];

  const sheetLines: DocSheetLine[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    qty: Number(it.qty) || 0,
    unit: it.unit,
    unit_price: Number(it.unit_price) || 0,
  }));

  const meta = [
    { label: 'Issued', value: fmtDate(cn.issue_date) },
    ...(invoice ? [{ label: 'Against invoice', value: invoice.invoice_number }] : []),
    ...(cn.reason ? [{ label: 'Reason', value: cn.reason }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar (hidden in print via DocSheet's PRINT_CSS scoping) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/orderflow/credit-notes" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">
            ← Credit notes
          </Link>
          <span className="text-[13px] tabular-nums text-[#9A9DA1]">{zar2(total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoice ? (
            <Link
              href={`/app/orderflow/invoices/${invoice.id}`}
              className="inline-flex h-9 items-center rounded-lg border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/50"
            >
              View invoice {invoice.invoice_number}
            </Link>
          ) : null}
          <PrintButton />
        </div>
      </div>

      {/* Link back to the invoice */}
      {invoice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E7E7E2] bg-[#FBFBF9] px-4 py-3 text-[13px]">
          <span className="text-[#5F6368]">
            This credit note was raised against invoice <span className="font-medium text-[#1A1C1E]">{invoice.invoice_number}</span>.
          </span>
          <Link href={`/app/orderflow/invoices/${invoice.id}`} className="font-medium text-[#1E5E54] hover:underline">
            View invoice →
          </Link>
        </div>
      ) : null}

      {/* Printable credit note sheet */}
      <DocSheet
        title="Credit note"
        number={cn.credit_number}
        statusPill={{ label: s.label, bg: s.bg, fg: s.fg }}
        companyProfile={companyProfile}
        orgName={orgName}
        customer={customer}
        meta={meta}
        lines={sheetLines}
        vatRate={cn.vat_rate}
        notes={cn.notes}
      />
    </div>
  );
}
