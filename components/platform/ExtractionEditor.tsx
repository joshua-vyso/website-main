'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { FIELD_REVIEW_THRESHOLD } from '@/lib/platform/tokens';
import type { DocumentStatus, ExtractedField, ExtractedLineItem } from '@/lib/platform/types';
import type { DocuExtractedData } from '@/lib/platform/docu/types';

function ConfidenceChip({ confidence }: { confidence: number }) {
  const low = confidence < FIELD_REVIEW_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        low ? 'bg-[#FBEEDA] text-[#854F0B]' : 'bg-[#E1F5EE] text-[#0F6E56]'
      }`}
    >
      {Math.round(confidence)}%{low ? ' · check' : ''}
    </span>
  );
}

const COLS = 'grid grid-cols-[1fr_64px_48px_70px_56px_76px_88px_24px] gap-2 items-center';

/** A legacy extracted field that represents the supplier — superseded by the
 *  dedicated Supplier field above, so it's folded in and hidden from the grid. */
const isSupplierLabel = (label: string): boolean =>
  /supplier|vendor/i.test(label) || label.trim().toLowerCase() === 'from';

export function ExtractionEditor({
  id,
  status,
  fields,
  lineItems,
  extractedData,
}: {
  id: string;
  status: DocumentStatus;
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  /** The doc's full extracted_data, so saving preserves summary / custom_type. */
  extractedData?: DocuExtractedData | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ExtractedField[]>(() => fields.map((f) => ({ ...f })));
  const [lines, setLines] = useState<ExtractedLineItem[]>(() => lineItems.map((l) => ({ ...l })));
  // The dedicated supplier field. Falls back to a legacy "Supplier"/"Vendor"/"From"
  // field for documents extracted before supplier capture existed.
  const [supplier, setSupplier] = useState<string>(
    () => extractedData?.supplier ?? fields.find((f) => isSupplierLabel(f.label))?.value ?? '',
  );
  const [busy, setBusy] = useState(false);

  const needsReview = useMemo(
    () => draft.filter((f) => f.confidence < FIELD_REVIEW_THRESHOLD).length,
    [draft],
  );
  const lineTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = parseFloat((l.amount ?? '').replace(/[^0-9.-]/g, ''));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [lines],
  );

  const updateValue = (index: number, value: string) =>
    setDraft((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  const updateLine = (index: number, key: keyof ExtractedLineItem, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const persist = async (nextStatus: Extract<DocumentStatus, 'reviewed' | 'error'>) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('documents')
        // Merge so the parsed statement summary + custom type survive a review.
        .update({
          status: nextStatus,
          extracted_data: {
            ...(extractedData ?? {}),
            fields: draft,
            line_items: lines,
            supplier: supplier.trim() || null,
          },
        })
        .eq('id', id);
    }
    // Re-sync the corrected lines into ProcurePulse (idempotent, best-effort).
    // keepalive lets it outlive the navigation below.
    if (nextStatus === 'reviewed') {
      void fetch('/api/procurepulse/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
        keepalive: true,
      }).catch(() => {});
    }
    router.push('/app/docu');
    router.refresh();
  };

  const cellCls =
    'h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div className="flex flex-col rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="border-b border-[#F0F0EC] px-6 py-5">
        <h2 className="text-[16px] font-bold text-[#1A1C1E]">Extracted data</h2>
        <p className="mt-1 text-[13px] text-[#5F6368]">Confirm or correct each field, then save</p>
      </div>

      <div className="px-6 py-5">
        {/* Supplier — the selling party. Extracted from the document header; editable
            here so a missed or mis-read counterparty can be corrected before it feeds
            ProcurePulse's per-product supplier prices. */}
        <div className="mb-5">
          <label htmlFor="doc-supplier" className="mb-1.5 block text-[13px] text-[#5F6368]">
            Supplier
          </label>
          <input
            id="doc-supplier"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="e.g. Bacca Valley (Pty) Ltd — or the market agent"
            className="h-10 w-full max-w-md rounded-xl border border-[#E7E7E2] bg-white px-3.5 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
          />
        </div>

        {/* Summary fields (legacy docs only — products-only extraction returns no fields).
            The supplier field is hidden here; it's edited via the dedicated input above. */}
        {draft.some((f) => !isSupplierLabel(f.label)) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {draft.map((field, index) => {
              if (isSupplierLabel(field.label)) return null;
              const low = field.confidence < FIELD_REVIEW_THRESHOLD;
              return (
                <div key={`${field.label}-${index}`} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor={`field-${index}`} className="truncate text-[13px] text-[#5F6368]">
                      {field.label}
                    </label>
                    <ConfidenceChip confidence={field.confidence} />
                  </div>
                  <input
                    id={`field-${index}`}
                    type="text"
                    value={field.value}
                    onChange={(e) => updateValue(index, e.target.value)}
                    className={`h-10 w-full rounded-xl border px-3.5 text-[14px] text-[#1A1C1E] focus:outline-none ${
                      low
                        ? 'border-[#E7B97A] bg-[#FDF6EC] focus:border-[#D9730D]'
                        : 'border-[#E7E7E2] bg-white focus:border-[#1E5E54]/40'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Line items */}
        {lines.length > 0 ? (
          <div className="mt-7">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1C1E]">Line items ({lines.length})</h3>
              <span className="text-[13px] text-[#5F6368]">
                Total {lineTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={`${COLS} border-b border-[#E7E7E2] px-1 pb-2 text-[11px] text-[#5F6368]`}>
              <span>Description</span>
              <span>Weight (kg)</span>
              <span>Qty</span>
              <span>Unit</span>
              <span>Units/box</span>
              <span>Unit price</span>
              <span>Amount</span>
              <span />
            </div>
            <div className="mt-2 space-y-2">
              {lines.map((l, i) => (
                <div key={i} className={COLS}>
                  <input className={cellCls} value={l.description ?? ''} onChange={(e) => updateLine(i, 'description', e.target.value)} />
                  <input className={cellCls} value={l.weight ?? ''} onChange={(e) => updateLine(i, 'weight', e.target.value)} />
                  <input className={`${cellCls} text-right`} value={l.quantity ?? ''} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                  <input className={cellCls} value={l.unit ?? ''} placeholder="boxes" onChange={(e) => updateLine(i, 'unit', e.target.value)} />
                  <input className={`${cellCls} text-right`} value={l.units_per_box ?? ''} onChange={(e) => updateLine(i, 'units_per_box', e.target.value)} />
                  <input className={`${cellCls} text-right`} value={l.unit_price ?? ''} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} />
                  <input className={`${cellCls} text-right`} value={l.amount ?? ''} onChange={(e) => updateLine(i, 'amount', e.target.value)} />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    aria-label="Remove line"
                    className="flex h-9 w-7 items-center justify-center rounded-lg text-[#9A9DA1] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-2 text-[13px]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: needsReview > 0 ? '#D9730D' : '#0F6E56' }}
            aria-hidden
          />
          <span style={{ color: needsReview > 0 ? '#854F0B' : '#0F6E56' }}>
            {needsReview > 0
              ? `${needsReview} ${needsReview === 1 ? 'field needs' : 'fields need'} review`
              : 'All fields confirmed'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-[#F0F0EC] bg-white px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => persist('error')}
          className="inline-flex h-10 items-center rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] font-medium text-[#1A1C1E] transition-colors hover:border-[#A32D2D]/40 hover:text-[#A32D2D] disabled:opacity-60"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={busy || status === 'reviewed'}
          onClick={() => persist('reviewed')}
          className="inline-flex h-10 items-center rounded-xl bg-[#D9730D] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B] disabled:opacity-60"
        >
          {status === 'reviewed' ? 'Confirmed' : 'Save & confirm'}
        </button>
      </div>
    </div>
  );
}
