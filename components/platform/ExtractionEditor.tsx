'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { FIELD_REVIEW_THRESHOLD } from '@/lib/platform/tokens';
import type { DocumentStatus, ExtractedField } from '@/lib/platform/types';

/** Amber "check" chip for low-confidence fields, green chip otherwise. */
function ConfidenceChip({ confidence }: { confidence: number }) {
  const low = confidence < FIELD_REVIEW_THRESHOLD;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        low ? 'bg-[#FBEEDA] text-[#854F0B]' : 'bg-[#E1F5EE] text-[#0F6E56]'
      }`}
    >
      {confidence}%{low ? ' · check' : ''}
    </span>
  );
}

export function ExtractionEditor({
  id,
  status,
  fields,
}: {
  id: string;
  status: DocumentStatus;
  fields: ExtractedField[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ExtractedField[]>(() =>
    fields.map((f) => ({ ...f })),
  );
  const [busy, setBusy] = useState(false);

  const needsReview = useMemo(
    () => draft.filter((f) => f.confidence < FIELD_REVIEW_THRESHOLD).length,
    [draft],
  );

  const updateValue = (index: number, value: string) => {
    setDraft((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  };

  const persist = async (nextStatus: Extract<DocumentStatus, 'reviewed' | 'error'>) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('documents')
        .update({ status: nextStatus, extracted_data: { fields: draft } })
        .eq('id', id);
    }
    router.push('/app/docu');
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#E7E7E2] bg-white">
      {/* Card header */}
      <div className="border-b border-[#F0F0EC] px-6 py-5">
        <h2 className="text-[16px] font-bold text-[#1A1C1E]">Extracted data</h2>
        <p className="mt-1 text-[13px] text-[#5F6368]">
          Confirm or correct each field before it&apos;s saved
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 px-6 py-5">
        {draft.length === 0 ? (
          <p className="text-[14px] text-[#9A9DA1]">No fields were extracted from this document.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {draft.map((field, index) => {
              const low = field.confidence < FIELD_REVIEW_THRESHOLD;
              return (
                <div key={`${field.label}-${index}`} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor={`field-${index}`}
                      className="truncate text-[13px] text-[#5F6368]"
                    >
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

        {/* Review note */}
        {needsReview > 0 ? (
          <div className="mt-6 flex items-center gap-2 text-[13px] text-[#854F0B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9730D]" aria-hidden />
            {needsReview} {needsReview === 1 ? 'field needs' : 'fields need'} review before this can
            be confirmed
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-2 text-[13px] text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" aria-hidden />
            All fields confirmed
          </div>
        )}
      </div>

      {/* Sticky action row */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-2xl border-t border-[#F0F0EC] bg-white px-6 py-4">
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
