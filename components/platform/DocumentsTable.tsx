'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusPill, ConfidenceText } from '@/components/platform/ui';
import { DOC_TYPES, DOC_TYPE_LABEL, countByType } from '@/lib/platform/documents';
import type { DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/** Format an ISO timestamp as "DD Mon" (e.g. "12 Mar"). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  return `${day} ${month}`;
}

type SortDir = 'desc' | 'asc';

export function DocumentsTable({ docs }: { docs: DocumentWithSupplier[] }) {
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(() => {
    const filtered =
      activeType === null ? docs : docs.filter((d) => d.document_type === activeType);
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [docs, activeType, sortDir]);

  const toggleSort = () => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));

  return (
    <div className="mt-6">
      {/* Type-filter tabs + sort control */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {DOC_TYPES.map((t) => {
            const isActive = t.key === activeType;
            const count = countByType(docs, t.key);
            return (
              <button
                key={t.key ?? 'all'}
                type="button"
                onClick={() => setActiveType(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-[#1F5FA8] text-white'
                    : 'border border-[#E2E6EC] bg-white text-[#3E4A57] hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]'
                }`}
              >
                <span>{t.label}</span>
                <span className={`of-num ${isActive ? 'text-white/70' : 'text-[#A0A49C]'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleSort}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2E6EC] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
        >
          Sort: {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
          <span className="text-[#A0A49C]">⇅</span>
        </button>
      </div>

      {/* Card table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        {/* Header */}
        <div className="grid grid-cols-[1fr_180px_110px_140px_140px_110px] items-center border-b border-[#EEF1F5] bg-[#FBFCFE] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
          <span>Document</span>
          <span>Supplier</span>
          <button
            type="button"
            onClick={toggleSort}
            className="flex items-center gap-1 text-left uppercase tracking-[0.06em] text-[#A0A49C] transition-colors hover:text-[#171A17]"
          >
            Date <span className="text-[10px] text-[#A0A49C]">{sortDir === 'desc' ? '▾' : '▴'}</span>
          </button>
          <span>Type</span>
          <span>Status</span>
          <span>Confidence</span>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-[14px] text-[#8A8E86]">No documents.</div>
        ) : (
          rows.map((doc) => (
            <Link
              key={doc.id}
              href={`/app/docu/${doc.id}`}
              className="grid grid-cols-[1fr_180px_110px_140px_140px_110px] items-center border-b border-[#F4F5F7] px-6 py-3.5 text-[14px] transition-colors last:border-b-0 hover:bg-[#F5F9FE]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-7 w-7 shrink-0 rounded-[8px] bg-[#EEF1F5]" aria-hidden />
                <span className="truncate font-semibold text-[#171A17]">{doc.filename}</span>
              </div>
              <span className="truncate text-[#2C333B]">{doc.supplier?.name ?? '—'}</span>
              <span className="of-num text-[#6B6F68]">{formatDate(doc.created_at)}</span>
              <span className="text-[#6B6F68]">
                {doc.document_type ? DOC_TYPE_LABEL[doc.document_type] : '—'}
              </span>
              <span>
                <StatusPill status={doc.status} />
              </span>
              <span>
                <ConfidenceText value={doc.confidence} />
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
