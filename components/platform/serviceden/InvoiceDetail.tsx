'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { Badge } from '@/components/platform/module-ui';
import {
  INVOICE_STATUS_META,
  SERVICEDEN_ACCOUNT_EMAIL,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  lineAmount,
  type SdInvoice,
} from '@/lib/platform/serviceden';
import { useServiceDen } from './context';
import { zar } from './ui';

// Print CSS: when printing, hide the whole app and show only the invoice sheet,
// so "Save as PDF" produces a clean, chrome-free document regardless of the
// sidebar/sub-nav around it.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sd-invoice-print, #sd-invoice-print * { visibility: visible !important; }
  #sd-invoice-print { position: absolute; inset: 0; margin: 0; width: 100%; border: none !important; box-shadow: none !important; }
  @page { margin: 16mm; }
}
`;

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { invoices, customerById } = useServiceDen();
  const { org } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();

  const invoice = invoices.find((i) => i.id === invoiceId);

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Invoice not found</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">It may have been deleted.</p>
        <Link href="/app/serviceden/invoices" className="mt-3 inline-block text-[13px] font-medium text-[#5B53C0] hover:underline">← Back to invoices</Link>
      </div>
    );
  }

  const customer = customerById(invoice.customerId);
  const meta = INVOICE_STATUS_META[invoice.status];
  const sub = invoiceSubtotal(invoice.items);
  const vat = invoiceTax(sub, invoice.taxRate);
  const total = invoiceTotal(invoice.items, invoice.taxRate);

  async function setStatus(status: SdInvoice['status']) {
    const supabase = createClient();
    if (!supabase) return;
    show(status === 'sent' ? 'Marked as sent' : status === 'paid' ? 'Marked as paid' : 'Moved to draft');
    const { error } = await supabase.from('sd_invoices').update({ status }).eq('id', invoice!.id);
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
            <div className="text-[26px] font-bold tracking-tight text-[#1A1C1E]">Invoice</div>
            <div className="mt-1 text-[14px] font-medium text-[#5B53C0]">{invoice.invoiceNumber}</div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-semibold text-[#1A1C1E]">{org?.name ?? 'Your business'}</div>
            <div className="mt-0.5 text-[13px] text-[#5F6368]">{SERVICEDEN_ACCOUNT_EMAIL}</div>
            {org?.location ? <div className="text-[13px] text-[#5F6368]">{org.location}</div> : null}
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

        {invoice.notes ? (
          <div className="mt-8 border-t border-[#F0F0EC] pt-4">
            <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Notes</div>
            <p className="mt-1 whitespace-pre-line text-[13px] text-[#5F6368]">{invoice.notes}</p>
          </div>
        ) : null}

        <div className="mt-8 text-center text-[12px] text-[#9A9DA1]">Thank you for your business.</div>
      </div>
    </div>
  );
}
