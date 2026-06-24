'use client';

import { DOC_TYPES, countByType } from '@/lib/platform/documents';
import type { DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/** Document-type filter tabs + a sort toggle. State is owned by InboxView. */
export function DocumentFilters({
  docs,
  activeType,
  onTypeChange,
  sortDir,
  onSortToggle,
}: {
  docs: DocumentWithSupplier[];
  activeType: DocumentType | null;
  onTypeChange: (t: DocumentType | null) => void;
  sortDir: 'desc' | 'asc';
  onSortToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {DOC_TYPES.map((t) => {
          const isActive = t.key === activeType;
          const count = countByType(docs, t.key);
          return (
            <button
              key={t.key ?? 'all'}
              type="button"
              onClick={() => onTypeChange(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#1A1C1E] text-white'
                  : 'border border-[#E7E7E2] bg-white text-[#1A1C1E] hover:border-[#1E5E54]/30'
              }`}
            >
              <span>{t.label}</span>
              <span className={isActive ? 'text-white/60' : 'text-[#9A9DA1]'}>{count}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSortToggle}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E7E7E2] bg-white px-3.5 py-1.5 text-[13px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/30"
      >
        Sort: {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
        <span className="text-[#9A9DA1]">⇅</span>
      </button>
    </div>
  );
}
