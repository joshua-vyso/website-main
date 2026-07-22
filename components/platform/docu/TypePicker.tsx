'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { DOC_TYPES, documentTypeLabel } from '@/lib/platform/documents';
import type { DocumentType } from '@/lib/platform/types';
import type { DocuExtractedData } from '@/lib/platform/docu/types';

/**
 * Editable document-type control. Pick one of the built-in categories or enter
 * a custom value. Custom types are stored in extracted_data.custom_type (jsonb),
 * so no schema change is needed; the built-in categories write document_type.
 */
export function TypePicker({
  documentId,
  documentType,
  extractedData,
}: {
  documentId: string;
  documentType: DocumentType | null;
  extractedData: DocuExtractedData | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const customCurrent = extractedData?.custom_type?.trim() ?? '';
  const [customValue, setCustomValue] = useState(customCurrent);

  const label = documentTypeLabel({ document_type: documentType, extracted_data: extractedData });
  const builtins = DOC_TYPES.filter((t) => t.key !== null) as { key: DocumentType; label: string }[];

  async function persist(patch: Record<string, unknown>) {
    setBusy(true);
    setOpen(false);
    const supabase = createClient();
    if (supabase) await supabase.from('documents').update(patch).eq('id', documentId);
    router.refresh();
    setBusy(false);
  }

  function pickBuiltin(key: DocumentType) {
    if (busy) return;
    // Set the category and drop any custom override.
    if (extractedData?.custom_type) {
      const next = { ...extractedData };
      delete next.custom_type;
      void persist({ document_type: key, extracted_data: next });
    } else {
      void persist({ document_type: key });
    }
  }

  function setCustom() {
    const value = customValue.trim();
    if (!value || busy) return;
    void persist({ extracted_data: { ...(extractedData ?? { fields: [] }), custom_type: value } });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] text-[#6B6F68] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] disabled:opacity-50"
      >
        <span className="text-[#A0A49C]">Type:</span>
        <span className="max-w-[140px] truncate font-semibold text-[#171A17]">{label}</span>
        <span className="text-[#A0A49C]">▾</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close type menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[240px] rounded-2xl border border-[#EAEDF2] bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
            {builtins.map((t) => {
              const active = !customCurrent && documentType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickBuiltin(t.key)}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                    active ? 'bg-[#E7EEF8] text-[#174C87]' : 'text-[#171A17] hover:bg-[#F5F9FE]'
                  }`}
                >
                  {t.label}
                  {active ? <span className="text-[#0F6E56]">✓</span> : null}
                </button>
              );
            })}

            <div className="mt-1.5 border-t border-[#EEF1F5] px-1 pt-2">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                Custom type
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setCustom();
                  }}
                  placeholder="e.g. Credit note"
                  className="h-8 flex-1 rounded-[9px] border border-[#E4E9F0] bg-white px-2.5 text-[12px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
                />
                <button
                  type="button"
                  onClick={setCustom}
                  disabled={busy || !customValue.trim() || customValue.trim() === customCurrent}
                  className="h-8 shrink-0 rounded-[9px] bg-[#1F5FA8] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
