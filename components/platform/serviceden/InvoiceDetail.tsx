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
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Invoice not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">It may have been deleted.</p>
        <Link href="/app/serviceden/invoices" className="mt-3 inline-block text-[13px] font-medium text-[#5B53C0] hover:underline">← Back to invoices</Link>
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
          <Link href="/app/serviceden/invoices" className="text-[13px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]">← Invoices</Link>
          <Badge label={meta.label} tone={meta.tone} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'draft' ? (
            <button type="button" onClick={() => void setStatus('sent')} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#5B53C0]/50">Mark sent</button>
          ) : null}
          {invoice.status !== 'paid' ? (
            <button type="button" onClick={() => void setStatus('paid')} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#5B53C0]/50">Mark paid</button>
          ) : null}
          <button type="button" onClick={() => show('Email sending comes with the Gmail connector — export the PDF for now')} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#9A9DA1]" title="Coming with the Gmail connector">Send via email · soon</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center rounded-lg bg-[#5B53C0] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#4c45a6]">Download PDF</button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div id="sd-invoice-print" className="mx-auto max-w-[820px] rounded-2xl border border-[#E7E7E2] bg-white p-8 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {settings?.logoData ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={settings.logoData} alt={`${sellerName} logo`} className="mb-4 max-h-[64px] max-w-[220px] object-contain" />
            ) : null}
            <div className="text-[26px] font-bold tracking-tight text-[#1A1C1E]">Invoice</div>
            <div className="mt-1 text-[14px] font-medium text-[#5B53C0]">{invoice.invoiceNumber}</div>
          </div>
          <div className="text-right text-[13px] text-[#5F6368]">
            <div className="text-[16px] font-semibold text-[#1A1C1E]">{sellerName}</div>
            {sellerEmail ? <div className="mt-0.5">{sellerEmail}</div> : null}
            {settings?.businessPhone ? <div>{settings.businessPhone}</div> : null}
            {settings?.businessAddress ? <div className="whitespace-pre-line">{settings.businessAddress}</div> : orgLocation ? <div>{orgLocation}</div> : null}
            {settings?.vatNumber ? <div className="mt-0.5">VAT: {settings.vatNumber}</div> : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Bill to</div>
            <div className="mt-1 text-[14px] font-semibold text-[#1A1C1E]">{customer?.name ?? '—'}</div>
            {customer?.company ? <div className="text-[13px] text-[#5F6368]">{customer.company}</div> : null}
            {customer?.email ? <div className="text-[13px] text-[#5F6368]">{customer.email}</div> : null}
            {customer?.phone ? <div className="text-[13px] text-[#5F6368]">{customer.phone}</div> : null}
            {customer?.address ? <div className="text-[13px] text-[#5F6368]">{customer.address}</div> : null}
          </div>
          <div className="text-right text-[13px]">
            <div className="flex justify-end gap-6"><span className="text-[#9A9DA1]">Issued</span><span className="tabular-nums text-[#1A1C1E]">{invoice.issueDate || '—'}</span></div>
            {invoice.dueDate ? <div className="mt-1 flex justify-end gap-6"><span className="text-[#9A9DA1]">Due</span><span className="tabular-nums text-[#1A1C1E]">{invoice.dueDate}</span></div> : null}
          </div>
        </div>

        <table className="mt-8 w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E7E7E2] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
              <th className="py-2 pr-2 text-left font-medium">Description</th>
              <th className="w-[64px] px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-[120px] px-2 py-2 text-right font-medium">Unit price</th>
              <th className="w-[120px] py-2 pl-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-[#9A9DA1]">No line items.</td></tr>
            ) : (
              invoice.items.map((it) => (
                <tr key={it.id} className="border-b border-[#F0F0EC]">
                  <td className="py-2.5 pr-2 text-[#1A1C1E]">{it.description}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{it.quantity}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-[#5F6368]">{zar(it.unitPrice)}</td>
                  <td className="py-2.5 pl-2 text-right tabular-nums text-[#1A1C1E]">{zar(lineAmount(it))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-[280px] space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#5F6368]">Subtotal</span><span className="tabular-nums text-[#1A1C1E]">{zar(sub)}</span></div>
            <div className="flex justify-between"><span className="text-[#5F6368]">VAT ({invoice.taxRate}%)</span><span className="tabular-nums text-[#1A1C1E]">{zar(vat)}</span></div>
            <div className="flex justify-between border-t border-[#E7E7E2] pt-2 text-[16px] font-bold"><span className="text-[#1A1C1E]">Total</span><span className="tabular-nums text-[#1A1C1E]">{zar(total)}</span></div>
          </div>
        </div>

        {/* Payment details + notes */}
        {showBank || invoice.notes ? (
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#F0F0EC] pt-5 sm:grid-cols-2">
            {showBank ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Payment details</div>
                <div className="mt-1.5 space-y-0.5 text-[13px] text-[#1A1C1E]">
                  {settings?.bankName ? <div><span className="text-[#9A9DA1]">Bank:</span> {settings.bankName}</div> : null}
                  {settings?.accountName ? <div><span className="text-[#9A9DA1]">Account name:</span> {settings.accountName}</div> : null}
                  {settings?.accountNumber ? <div><span className="text-[#9A9DA1]">Account no:</span> <span className="tabular-nums">{settings.accountNumber}</span></div> : null}
                  {settings?.branchCode ? <div><span className="text-[#9A9DA1]">Branch code:</span> <span className="tabular-nums">{settings.branchCode}</span></div> : null}
                  {settings?.swift ? <div><span className="text-[#9A9DA1]">SWIFT:</span> {settings.swift}</div> : null}
                  {settings?.paymentReference ? <div className="mt-1 text-[#5F6368]">{settings.paymentReference}</div> : null}
                </div>
              </div>
            ) : null}
            {invoice.notes ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Notes</div>
                <p className="mt-1.5 whitespace-pre-line text-[13px] text-[#5F6368]">{invoice.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 text-center text-[12px] text-[#9A9DA1]">Thank you for your business.</div>
      </div>
    </div>
  );
}
