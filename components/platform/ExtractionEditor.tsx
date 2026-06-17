'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { FIELD_REVIEW_THRESHOLD } from '@/lib/platform/tokens';
import type { DocumentStatus, ExtractedField, ExtractedLineItem } from '@/lib/platform/types';

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

const COLS = 'grid grid-cols-[1fr_80px_56px_72px_92px_104px_28px] gap-2 items-center';

export function ExtractionEditor({
  id,
  status,
  fields,
  lineItems,
}: {
  id: string;
  status: DocumentStatus;
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ExtractedField[]>(() => fields.map((f) => ({ ...f })));
  const [lines, setLines] = useState<ExtractedLineItem[]>(() => lineItems.map((l) => ({ ...l })));
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
        .update({ status: nextStatus, extracted_data: { fields: draft, line_items: lines } })
        .eq('id', id);
    }
    router.push('/app/docu');
    router.refresh();
  };

  const cellCls =
    'h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] focus:border-[#1E5E54]/40 focus:outline-none';

  return (
    <div className="flex h-full max-h-[calc(100vh-180px)] flex-col rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="border-b border-[#F0F0EC] px-6 py-5">
        <h2 className="text-[16px] font-bold text-[#1A1C1E]">Extracted data</h2>
        <p className="mt-1 text-[13px] text-[#5F6368]">Confirm or correct each field, then save</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Summary fields (legacy docs only — products-only extraction returns no fields) */}
        {draft.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {draft.map((field, index) => {
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
              <span>Weight</span>
              <span>Qty</span>
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
