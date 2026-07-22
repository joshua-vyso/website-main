'use client';

import { docTotals, zar2, type OfCustomer } from '@/lib/platform/orderflow';
import { hasBankDetails, type CdCompanyProfile } from '@/lib/platform/coredata';

// ---------------------------------------------------------------------------
// Print CSS: when printing, hide the whole app and show only the document
// sheet, so "Save as PDF" produces a clean, chrome-free document regardless of
// the sidebar/sub-nav around it. top/left only (NEVER inset:0) so the sheet
// keeps its natural height and paginates across pages — inset:0 pins the height
// and truncates long documents.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #of-doc-print, #of-doc-print * { visibility: visible !important; }
  #of-doc-print { position: absolute; top: 0; left: 0; width: 100%; margin: 0; border: none !important; box-shadow: none !important; }
  @page { margin: 16mm; }
}
`;

export interface DocSheetLine {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
}

export function DocSheet({
  title,
  number,
  statusPill,
  companyProfile,
  orgName,
  customer,
  billTo,
  deliverTo,
  meta,
  lines,
  showPrices = true,
  vatRate = 0,
  discount = 0,
  notes,
  terms,
  signatureBlock = false,
}: {
  title: string;
  number: string;
  statusPill?: { label: string; bg: string; fg: string } | null;
  companyProfile: CdCompanyProfile | null;
  orgName: string | null;
  customer: OfCustomer | null;
  billTo?: string | null;
  deliverTo?: string | null;
  meta: { label: string; value: string }[];
  lines: DocSheetLine[];
  showPrices?: boolean;
  vatRate?: number;
  discount?: number;
  notes?: string | null;
  terms?: string | null;
  signatureBlock?: boolean;
}) {
  // Seller identity — company_name falls back to the org name, but every other
  // contact detail is shown ONLY when it's actually set (never invent contact
  // details that would then print on a client's document).
  const sellerName = companyProfile?.company_name || orgName || 'Your business';
  const sellerEmail = companyProfile?.email || null;
  const sellerPhone = companyProfile?.phone || null;
  const sellerAddress = companyProfile?.address || null;
  const sellerVat = companyProfile?.vat_number || null;
  const sellerReg = companyProfile?.registration_number || null;

  const billToText = billTo ?? customer?.billing_address ?? null;
  const showBank = showPrices && hasBankDetails(companyProfile);
  const footerText = companyProfile?.invoice_footer || null;

  // Totals only when the document shows prices (delivery notes hide them).
  const totals = showPrices ? docTotals(lines, vatRate, discount) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div id="of-doc-print" className="mx-auto max-w-[820px] rounded-2xl border border-[#EAEDF2] bg-white p-8 sm:p-10">
        {/* Header — logo + document title on the left, seller block on the right */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {companyProfile?.logo_data ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={companyProfile.logo_data} alt={`${sellerName} logo`} className="mb-4 max-h-[64px] max-w-[220px] object-contain" />
            ) : null}
            <div className="text-[26px] font-bold tracking-tight text-[#171A17]">{title}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[14px] font-medium text-[#1F5FA8]">{number}</span>
              {statusPill ? (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: statusPill.bg, color: statusPill.fg }}>
                  {statusPill.label}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right text-[13px] text-[#6B6F68]">
            <div className="text-[16px] font-semibold text-[#171A17]">{sellerName}</div>
            {sellerEmail ? <div className="mt-0.5">{sellerEmail}</div> : null}
            {sellerPhone ? <div>{sellerPhone}</div> : null}
            {sellerAddress ? <div className="whitespace-pre-line">{sellerAddress}</div> : null}
            {sellerVat ? <div className="mt-0.5">VAT: {sellerVat}</div> : null}
            {sellerReg ? <div>Reg: {sellerReg}</div> : null}
          </div>
        </div>

        {/* Bill-to / deliver-to + meta rows */}
        <div className="mt-8 flex flex-wrap justify-between gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Bill to</div>
              <div className="mt-1 text-[14px] font-semibold text-[#171A17]">{customer?.name ?? '—'}</div>
              {customer?.trading_name ? <div className="text-[13px] text-[#6B6F68]">{customer.trading_name}</div> : null}
              {customer?.email ? <div className="text-[13px] text-[#6B6F68]">{customer.email}</div> : null}
              {customer?.phone ? <div className="text-[13px] text-[#6B6F68]">{customer.phone}</div> : null}
              {billToText ? <div className="whitespace-pre-line text-[13px] text-[#6B6F68]">{billToText}</div> : null}
              {customer?.vat_number ? <div className="mt-0.5 text-[13px] text-[#6B6F68]">VAT: {customer.vat_number}</div> : null}
            </div>
            {deliverTo ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Deliver to</div>
                <div className="mt-1 whitespace-pre-line text-[13px] text-[#6B6F68]">{deliverTo}</div>
              </div>
            ) : null}
          </div>
          {meta.length > 0 ? (
            <div className="text-right text-[13px]">
              {meta.map((m, i) => (
                <div key={`${m.label}-${i}`} className={`flex justify-end gap-6 ${i === 0 ? '' : 'mt-1'}`}>
                  <span className="text-[#8A8E86]">{m.label}</span>
                  <span className="tabular-nums text-[#171A17]">{m.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Items table */}
        <table className="mt-8 w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#EAEDF2] text-[11px] uppercase tracking-wide text-[#8A8E86]">
              <th className="py-2 pr-2 text-left font-medium">Description</th>
              <th className="w-[72px] px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-[72px] px-2 py-2 text-left font-medium">Unit</th>
              {showPrices ? <th className="w-[120px] px-2 py-2 text-right font-medium">Unit price</th> : null}
              {showPrices ? <th className="w-[120px] py-2 pl-2 text-right font-medium">Amount</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={showPrices ? 5 : 3} className="py-6 text-center text-[#8A8E86]">No line items.</td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className="border-b border-[#EEF1F5]">
                  <td className="py-2.5 pr-2 text-[#171A17]">{l.name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-[#6B6F68]">{l.qty}</td>
                  <td className="px-2 py-2.5 text-left text-[#6B6F68]">{l.unit || '—'}</td>
                  {showPrices ? <td className="px-2 py-2.5 text-right tabular-nums text-[#6B6F68]">{zar2(l.unit_price)}</td> : null}
                  {showPrices ? <td className="py-2.5 pl-2 text-right tabular-nums text-[#171A17]">{zar2((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals (prices only) */}
        {totals ? (
          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-[280px] space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-[#6B6F68]">Subtotal</span><span className="tabular-nums text-[#171A17]">{zar2(totals.subtotal)}</span></div>
              {totals.discount > 0 ? (
                <div className="flex justify-between"><span className="text-[#6B6F68]">Discount</span><span className="tabular-nums text-[#171A17]">−{zar2(totals.discount)}</span></div>
              ) : null}
              <div className="flex justify-between"><span className="text-[#6B6F68]">VAT ({vatRate}%)</span><span className="tabular-nums text-[#171A17]">{zar2(totals.vat)}</span></div>
              <div className="flex justify-between border-t border-[#EAEDF2] pt-2 text-[16px] font-bold"><span className="text-[#171A17]">Total</span><span className="tabular-nums text-[#171A17]">{zar2(totals.total)}</span></div>
            </div>
          </div>
        ) : null}

        {/* Payment details + notes/terms */}
        {showBank || notes || terms ? (
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#EEF1F5] pt-5 sm:grid-cols-2">
            {showBank ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Payment details</div>
                <div className="mt-1.5 space-y-0.5 text-[13px] text-[#171A17]">
                  {companyProfile?.bank_name ? <div><span className="text-[#8A8E86]">Bank:</span> {companyProfile.bank_name}</div> : null}
                  {companyProfile?.account_name ? <div><span className="text-[#8A8E86]">Account name:</span> {companyProfile.account_name}</div> : null}
                  {companyProfile?.account_number ? <div><span className="text-[#8A8E86]">Account no:</span> <span className="tabular-nums">{companyProfile.account_number}</span></div> : null}
                  {companyProfile?.branch_code ? <div><span className="text-[#8A8E86]">Branch code:</span> <span className="tabular-nums">{companyProfile.branch_code}</span></div> : null}
                  {companyProfile?.swift ? <div><span className="text-[#8A8E86]">SWIFT:</span> {companyProfile.swift}</div> : null}
                </div>
              </div>
            ) : null}
            {notes || terms ? (
              <div className="space-y-4">
                {notes ? (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Notes</div>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] text-[#6B6F68]">{notes}</p>
                  </div>
                ) : null}
                {terms ? (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#8A8E86]">Terms</div>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] text-[#6B6F68]">{terms}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Signature block — delivery notes: received-by / signature / date */}
        {signatureBlock ? (
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-[#EEF1F5] pt-6 sm:grid-cols-3">
            <div>
              <div className="h-8 border-b border-[#8A8E86]" />
              <div className="mt-1.5 text-[11px] uppercase tracking-wide text-[#8A8E86]">Received by (name)</div>
            </div>
            <div>
              <div className="h-8 border-b border-[#8A8E86]" />
              <div className="mt-1.5 text-[11px] uppercase tracking-wide text-[#8A8E86]">Signature</div>
            </div>
            <div>
              <div className="h-8 border-b border-[#8A8E86]" />
              <div className="mt-1.5 text-[11px] uppercase tracking-wide text-[#8A8E86]">Date</div>
            </div>
          </div>
        ) : null}

        {footerText ? (
          <div className="mt-8 whitespace-pre-line text-center text-[12px] text-[#8A8E86]">{footerText}</div>
        ) : null}
      </div>
    </>
  );
}

/** Accent "Download PDF" button — triggers the browser print dialog. Callers place it in their own toolbar. */
export function PrintButton({ label }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
    >
      {label ?? 'Download PDF'}
    </button>
  );
}
