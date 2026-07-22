'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { Badge } from '@/components/platform/module-ui';
import {
  INVOICE_STATUS_META,
  hasBankDetails,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  lineAmount,
  type SdCustomer,
  type SdInvoice,
  type SdInvoiceStatus,
  type SdSettings,
} from '@/lib/platform/serviceden';
import { zar } from './ui';

// Print CSS: when printing, hide the whole app and show only the invoice sheet,
// so "Save as PDF" produces a clean, chrome-free document regardless of the
// sidebar/sub-nav around it.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sd-invoice-print, #sd-invoice-print * { visibility: visible !important; }
  /* top/left only (no inset/bottom) so the sheet keeps its natural height and
     paginates across pages — inset:0 pins the height and truncates long invoices. */
  #sd-invoice-print { position: absolute; top: 0; left: 0; width: 100%; margin: 0; border: none !important; box-shadow: none !important; }
  @page { margin: 16mm; }
}
`;

export function InvoiceDetail({
  invoice,
  customer,
  settings,
  orgName,
  orgLocation,
}: {
  invoice: SdInvoice | null;
  customer: SdCustomer | null;
  settings: SdSettings | null;
  orgName: string | null;
  orgLocation: string | null;
}) {
  const router = useRouter();
  const { node, show } = useToast();

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
        <p className="of-display text-[18px] font-semibold text-[#171A17]">Invoice not found</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">It may have been deleted.</p>
        <Link href="/app/serviceden/invoices" className="mt-4 inline-block text-[13px] font-semibold text-[#1F5FA8] hover:underline">← Back to invoices</Link>
      </div>
    );
  }

  const meta = INVOICE_STATUS_META[invoice.status];
  const sub = invoiceSubtotal(invoice.items);
  const vat = invoiceTax(sub, invoice.taxRate);
  const total = invoiceTotal(invoice.items, invoice.taxRate);

  const sellerName = settings?.businessName || orgName || 'Your business';
  // Only show a contact email if the business set one — never fall back to the
  // internal gate account (that would print joshua@vyso.co.za on client PDFs).
  const sellerEmail = settings?.businessEmail || null;
  const showBank = hasBankDetails(settings);

  async function setStatus(status: SdInvoiceStatus) {
    if (!invoice) return;
    const supabase = createClient();
    if (!supabase) return;
    show(status === 'sent' ? 'Marked as sent' : status === 'paid' ? 'Marked as paid' : 'Moved to draft');
    const { error } = await supabase.from('sd_invoices').update({ status }).eq('id', invoice.id);
    if (error) { show(`Couldn't update: ${error.message}`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {node}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Toolbar (hidden in print) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/serviceden/invoices" className="text-[13px] font-semibold text-[#6B6F68] transition-colors hover:text-[#1F5FA8]">← Invoices</Link>
          <Badge label={meta.label} tone={meta.tone} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'draft' ? (
            <button type="button" onClick={() => void setStatus('sent')} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Mark sent</button>
          ) : null}
          {invoice.status !== 'paid' ? (
            <button type="button" onClick={() => void setStatus('paid')} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Mark paid</button>
          ) : null}
          <button type="button" onClick={() => show('Email sending comes with the Gmail connector — export the PDF for now')} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#EEF1F5] bg-white px-[18px] text-[14px] font-medium text-[#A0A49C]" title="Coming with the Gmail connector">Send via email · soon</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">Download PDF</button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div id="sd-invoice-print" className="mx-auto max-w-[820px] rounded-2xl border border-[#EAEDF2] bg-white p-8 shadow-[0_1px_2px_rgba(20,24,20,0.03)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {settings?.logoData ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={settings.logoData} alt={`${sellerName} logo`} className="mb-4 max-h-[64px] max-w-[220px] object-contain" />
            ) : null}
            <div className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Invoice</div>
            <div className="of-num mt-1 text-[14px] font-semibold text-[#1F5FA8]">{invoice.invoiceNumber}</div>
          </div>
          <div className="text-right text-[13px] text-[#6B6F68]">
            <div className="of-display text-[16px] font-semibold text-[#171A17]">{sellerName}</div>
            {sellerEmail ? <div className="mt-0.5">{sellerEmail}</div> : null}
            {settings?.businessPhone ? <div className="of-num">{settings.businessPhone}</div> : null}
            {settings?.businessAddress ? <div className="whitespace-pre-line">{settings.businessAddress}</div> : orgLocation ? <div>{orgLocation}</div> : null}
            {settings?.vatNumber ? <div className="mt-0.5">VAT: <span className="of-num">{settings.vatNumber}</span></div> : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">Bill to</div>
            <div className="mt-1.5 text-[14px] font-semibold text-[#171A17]">{customer?.name ?? '—'}</div>
            {customer?.company ? <div className="text-[13px] text-[#6B6F68]">{customer.company}</div> : null}
            {customer?.email ? <div className="text-[13px] text-[#6B6F68]">{customer.email}</div> : null}
            {customer?.phone ? <div className="of-num text-[13px] text-[#6B6F68]">{customer.phone}</div> : null}
            {customer?.address ? <div className="text-[13px] text-[#6B6F68]">{customer.address}</div> : null}
          </div>
          <div className="text-right text-[13px]">
            <div className="flex justify-end gap-6"><span className="text-[#A0A49C]">Issued</span><span className="of-num text-[#171A17]">{invoice.issueDate || '—'}</span></div>
            {invoice.dueDate ? <div className="mt-1 flex justify-end gap-6"><span className="text-[#A0A49C]">Due</span><span className="of-num text-[#171A17]">{invoice.dueDate}</span></div> : null}
          </div>
        </div>

        <table className="mt-8 w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#EAEDF2] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
              <th className="py-2 pr-2 text-left font-medium">Description</th>
              <th className="w-[64px] px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-[120px] px-2 py-2 text-right font-medium">Unit price</th>
              <th className="w-[120px] py-2 pl-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-[#A0A49C]">No line items.</td></tr>
            ) : (
              invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-[#F4F5F7]">
                  <td className="py-3 pr-2 text-[#171A17]">{it.description}</td>
                  <td className="of-num px-2 py-3 text-right text-[#6B6F68]">{it.quantity}</td>
                  <td className="of-num px-2 py-3 text-right text-[#6B6F68]">{zar(it.unitPrice)}</td>
                  <td className="of-num py-3 pl-2 text-right font-semibold text-[#171A17]">{zar(lineAmount(it))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-[280px] space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#6B6F68]">Subtotal</span><span className="of-num text-[#171A17]">{zar(sub)}</span></div>
            <div className="flex justify-between"><span className="text-[#6B6F68]">VAT (<span className="of-num">{invoice.taxRate}</span>%)</span><span className="of-num text-[#171A17]">{zar(vat)}</span></div>
            <div className="flex items-baseline justify-between border-t border-[#EAEDF2] pt-2.5"><span className="text-[14px] font-semibold text-[#171A17]">Total</span><span className="of-num text-[22px] font-semibold tracking-[-0.02em] text-[#171A17]">{zar(total)}</span></div>
          </div>
        </div>

        {/* Payment details + notes */}
        {showBank || invoice.notes ? (
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#EEF1F5] pt-5 sm:grid-cols-2">
            {showBank ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">Payment details</div>
                <div className="mt-1.5 space-y-0.5 text-[13px] text-[#171A17]">
                  {settings?.bankName ? <div><span className="text-[#A0A49C]">Bank:</span> {settings.bankName}</div> : null}
                  {settings?.accountName ? <div><span className="text-[#A0A49C]">Account name:</span> {settings.accountName}</div> : null}
                  {settings?.accountNumber ? <div><span className="text-[#A0A49C]">Account no:</span> <span className="of-num">{settings.accountNumber}</span></div> : null}
                  {settings?.branchCode ? <div><span className="text-[#A0A49C]">Branch code:</span> <span className="of-num">{settings.branchCode}</span></div> : null}
                  {settings?.swift ? <div><span className="text-[#A0A49C]">SWIFT:</span> <span className="of-num">{settings.swift}</span></div> : null}
                  {settings?.paymentReference ? <div className="mt-1 text-[#6B6F68]">{settings.paymentReference}</div> : null}
                </div>
              </div>
            ) : null}
            {invoice.notes ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">Notes</div>
                <p className="mt-1.5 whitespace-pre-line text-[13px] text-[#6B6F68]">{invoice.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 text-center text-[12px] text-[#A0A49C]">Thank you for your business.</div>
      </div>
    </div>
  );
}
