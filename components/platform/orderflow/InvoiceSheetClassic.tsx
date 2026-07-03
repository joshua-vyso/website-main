'use client';

/**
 * Classic South-African TAX INVOICE — the formal, bordered form Turn 'n Slice
 * hands to its wholesale customers (bakeries, hotels), NOT the modern DocSheet.
 *
 * It is a print-first document: mostly black text, thin grey borders, white
 * background, no brand accent. The layout mirrors the TNS reference:
 *   - centered seller name + stacked contact lines (Tel/Email/VAT), optional logo
 *   - a left column of boxes (Postal Address, Bank Details, Invoice To)
 *   - a right "Tax Invoice" heading over a bordered Invoice-No/Tax-Date/Terms/
 *     Account-No grid, then a Cust-VAT-Reg / P.O.-No row
 *   - a bordered Qty | Item | Rate | VAT | Amount table with a per-line VAT code
 *   - a bordered VAT-Total / Total block (rendered "ZAR 12,893.50")
 *   - a SIGNED / PRINT NAME signature footer
 *
 * Uses the SAME print scoping as DocSheet (id="of-doc-print", top/left only,
 * never inset:0) so "Save as PDF" produces a clean, paginated document.
 */

import { docTotals, vatCodeFor, type OfCustomer, type VatTreatment } from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #of-doc-print, #of-doc-print * { visibility: visible !important; }
  #of-doc-print { position: absolute; top: 0; left: 0; width: 100%; margin: 0; box-shadow: none !important; }
  @page { margin: 14mm; }
}
`;

export interface ClassicInvoiceLine {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
}

export interface ClassicInvoiceMeta {
  number: string;
  issueDate: string;
  dueDate?: string | null;
  customerPo?: string | null;
  termsText?: string | null;
  note?: string | null;
}

/** "ZAR 12,893.50" — en-US grouping/decimals, kept as-is to match the reference. */
function zarAmt(n: number): string {
  return `ZAR ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** dd/mm/yyyy — the classic SA date format on the reference invoice. */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function InvoiceSheetClassic({
  companyProfile,
  orgName,
  customer,
  invoice,
  lines,
  vatTreatment,
  vatRate,
  discount = 0,
  rebatePct = 0,
}: {
  companyProfile: CdCompanyProfile | null;
  orgName: string | null;
  customer: OfCustomer | null;
  invoice: ClassicInvoiceMeta;
  lines: ClassicInvoiceLine[];
  vatTreatment: VatTreatment;
  vatRate: number;
  /** Absolute rand discount on the invoice, applied to the subtotal before VAT. */
  discount?: number;
  /** Customer rebate % snapshotted on the invoice, deducted after discount, before VAT. */
  rebatePct?: number;
}) {
  // Seller identity — company_name falls back to the org name; every other
  // contact detail prints ONLY when actually set (never invent details).
  const sellerName = companyProfile?.company_name || orgName || 'Your business';
  const sellerPhone = companyProfile?.phone || null;
  const sellerEmail = companyProfile?.email || null;
  const sellerVat = companyProfile?.vat_number || null;
  const sellerAddress = companyProfile?.address || null;

  const bankName = companyProfile?.bank_name || null;
  const accountNumber = companyProfile?.account_number || null;
  const hasBank = !!(bankName || accountNumber);

  // Totals via the shared docTotals so discount + VAT + Total agree with the
  // on-screen figures, balanceDue and payment tracking (which all use docTotals).
  const rate = Number(vatRate) || 0;
  const totals = docTotals(lines, rate, discount, rebatePct);
  // Derive the per-line VAT code from the EFFECTIVE rate so the code and the VAT
  // Total can never contradict (a 0% invoice always reads Z/E; a rated one reads V).
  const vatCode = rate > 0 ? 'V' : vatCodeFor(vatTreatment);

  // Shared cell styles for the bordered "form" look (thin dark rules).
  const cellB = '#333';
  const softB = '#999';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div
        id="of-doc-print"
        className="mx-auto max-w-[820px] border border-[#333] bg-white p-6 text-[12px] text-[#1a1a1a] sm:p-8"
        style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
      >
        {/* Top band — logo left, centered seller name, contact lines right. */}
        <div className="relative flex items-start justify-between gap-4 border-b border-[#333] pb-4">
          <div className="min-w-[120px]">
            {companyProfile?.logo_data ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={companyProfile.logo_data} alt={`${sellerName} logo`} className="max-h-[56px] max-w-[160px] object-contain" />
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 text-center">
            <div className="text-[20px] font-bold uppercase tracking-wide text-[#111]">{sellerName}</div>
          </div>
          <div className="min-w-[150px] text-right text-[11px] leading-relaxed text-[#333]">
            {sellerPhone ? <div>Tel: {sellerPhone}</div> : null}
            {sellerEmail ? <div>Email: {sellerEmail}</div> : null}
            {sellerVat ? <div>VAT #: {sellerVat}</div> : null}
          </div>
        </div>

        {/* Address / bank / invoice-to boxes on the left; Tax Invoice grid on the right. */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex min-w-[260px] flex-1 flex-col gap-3">
            {sellerAddress ? (
              <div className="border border-[#999] p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555]">Postal Address</div>
                <div className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-[#222]">{sellerAddress}</div>
              </div>
            ) : null}

            {hasBank ? (
              <div className="border border-[#999] p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555]">Bank Details</div>
                <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-[#222]">
                  {bankName ? <div>{bankName}</div> : null}
                  {accountNumber ? <div>Account Number: {accountNumber}</div> : null}
                </div>
              </div>
            ) : null}

            <div className="border border-[#999] p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555]">Invoice To</div>
              <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-[#222]">
                <div className="text-[12px] font-semibold text-[#111]">{customer?.name ?? '—'}</div>
                {customer?.trading_name ? <div>{customer.trading_name}</div> : null}
                {customer?.vat_number ? <div>Vat# {customer.vat_number}</div> : null}
                {customer?.billing_address ? <div className="whitespace-pre-line">{customer.billing_address}</div> : null}
              </div>
            </div>
          </div>

          <div className="flex min-w-[260px] flex-1 flex-col">
            <div className="text-right text-[26px] font-bold tracking-tight text-[#111]">Tax Invoice</div>

            {/* Bordered 2-col grid — label | value. */}
            <table className="mt-2 w-full border-collapse text-[11px]">
              <tbody>
                {[
                  { label: 'Invoice No', value: invoice.number },
                  { label: 'Tax Date', value: fmtDate(invoice.issueDate) },
                  { label: 'Terms', value: invoice.termsText ?? '' },
                  { label: 'Account No', value: customer?.account_code ?? '' },
                ].map((r) => (
                  <tr key={r.label}>
                    <td className="border border-[#333] px-2 py-1.5 font-semibold text-[#333]" style={{ width: '45%' }}>
                      {r.label}
                    </td>
                    <td className="border border-[#333] px-2 py-1.5 text-[#111]">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cust VAT Reg. | P.O. No. row. */}
            <table className="mt-2 w-full border-collapse text-[11px]">
              <tbody>
                <tr>
                  <td className="border border-[#333] px-2 py-1.5 font-semibold text-[#333]" style={{ width: '25%' }}>
                    Cust VAT Reg.
                  </td>
                  <td className="border border-[#333] px-2 py-1.5 text-[#111]" style={{ width: '25%' }}>
                    {customer?.vat_number ?? ''}
                  </td>
                  <td className="border border-[#333] px-2 py-1.5 font-semibold text-[#333]" style={{ width: '20%' }}>
                    P.O. No.
                  </td>
                  <td className="border border-[#333] px-2 py-1.5 text-[#111]">{invoice.customerPo ?? ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items table — bordered classic grid. */}
        <table className="mt-4 w-full border-collapse text-[11px]" style={{ border: `1px solid ${cellB}` }}>
          <thead>
            <tr className="bg-[#f2f2f0] text-[#111]">
              <th className="border border-[#333] px-2 py-1.5 text-right font-semibold" style={{ width: '64px' }}>
                Qty
              </th>
              <th className="border border-[#333] px-2 py-1.5 text-left font-semibold">Item</th>
              <th className="border border-[#333] px-2 py-1.5 text-right font-semibold" style={{ width: '110px' }}>
                Rate
              </th>
              <th className="border border-[#333] px-2 py-1.5 text-center font-semibold" style={{ width: '48px' }}>
                VAT
              </th>
              <th className="border border-[#333] px-2 py-1.5 text-right font-semibold" style={{ width: '120px' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-[#333] px-2 py-4 text-center text-[#777]">
                  No line items.
                </td>
              </tr>
            ) : (
              lines.map((l) => {
                const qty = Number(l.qty) || 0;
                const rate = Number(l.unit_price) || 0;
                return (
                  <tr key={l.id}>
                    <td className="border border-[#999] px-2 py-1.5 text-right tabular-nums align-top">{qty}</td>
                    <td className="border border-[#999] px-2 py-1.5 text-left align-top text-[#111]">{l.name}</td>
                    <td className="border border-[#999] px-2 py-1.5 text-right tabular-nums align-top">{rate.toFixed(2)}</td>
                    <td className="border border-[#999] px-2 py-1.5 text-center align-top">{vatCode}</td>
                    <td className="border border-[#999] px-2 py-1.5 text-right tabular-nums align-top">{(qty * rate).toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totals — bordered block, bottom-right, "ZAR …". */}
        <div className="mt-3 flex justify-end">
          <table className="border-collapse text-[12px]" style={{ minWidth: '280px' }}>
            <tbody>
              {totals.discount > 0 || totals.rebate > 0 ? (
                <tr>
                  <td className="border border-[#333] px-3 py-1.5 font-semibold text-[#333]">Subtotal</td>
                  <td className="border border-[#333] px-3 py-1.5 text-right tabular-nums text-[#111]">{zarAmt(totals.subtotal)}</td>
                </tr>
              ) : null}
              {totals.discount > 0 ? (
                <tr>
                  <td className="border border-[#333] px-3 py-1.5 font-semibold text-[#333]">Discount</td>
                  <td className="border border-[#333] px-3 py-1.5 text-right tabular-nums text-[#111]">−{zarAmt(totals.discount)}</td>
                </tr>
              ) : null}
              {totals.rebate > 0 ? (
                <tr>
                  <td className="border border-[#333] px-3 py-1.5 font-semibold text-[#333]">Rebate ({rebatePct}%)</td>
                  <td className="border border-[#333] px-3 py-1.5 text-right tabular-nums text-[#111]">−{zarAmt(totals.rebate)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="border border-[#333] px-3 py-1.5 font-semibold text-[#333]">VAT Total</td>
                <td className="border border-[#333] px-3 py-1.5 text-right tabular-nums text-[#111]">{zarAmt(totals.vat)}</td>
              </tr>
              <tr>
                <td className="border border-[#333] px-3 py-2 text-[13px] font-bold text-[#111]">Total</td>
                <td className="border border-[#333] px-3 py-2 text-right text-[13px] font-bold tabular-nums text-[#111]">
                  {zarAmt(totals.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Optional note. */}
        {invoice.note ? (
          <div className="mt-4 whitespace-pre-line text-[11px] leading-relaxed text-[#444]">{invoice.note}</div>
        ) : null}

        {/* Signature footer — bottom-left, dotted/underlined lines. */}
        <div className="mt-10 max-w-[420px]">
          <div className="flex items-end gap-2 text-[11px] text-[#333]">
            <span className="whitespace-nowrap font-semibold">SIGNED:</span>
            <span className="flex-1" style={{ borderBottom: `1px dotted ${softB}`, height: '1em' }} />
          </div>
          <div className="mt-5 flex items-end gap-2 text-[11px] text-[#333]">
            <span className="whitespace-nowrap font-semibold">PRINT NAME:</span>
            <span className="flex-1" style={{ borderBottom: `1px dotted ${softB}`, height: '1em' }} />
          </div>
        </div>
      </div>
    </>
  );
}
