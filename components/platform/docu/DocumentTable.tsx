'use client';

import Link from 'next/link';
import { StatusPill, ConfidenceText } from '@/components/platform/ui';
import { DOC_TYPE_LABEL } from '@/lib/platform/documents';
import { deriveFlags } from '@/lib/platform/docu/flags';
import type { DocumentWithSupplier } from '@/lib/platform/types';
import { FlagsList } from './FlagsList';

/** Shared column template — header + rows MUST use the same grid. */
const COLS = 'grid-cols-[1fr_150px_92px_120px_116px_84px_92px]';

/** Format an ISO timestamp as "DD Mon" (e.g. "12 Mar"). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  return `${day} ${month}`;
}

/** A still-extracting row: not clickable, with a live "Extracting…" pulse. */
function ExtractingRow({ doc }: { doc: DocumentWithSupplier }) {
  return (
    <div
      className={`grid ${COLS} items-center border-b border-[#F0F0EC] px-6 py-3.5 text-[14px] last:border-b-0`}
      aria-busy="true"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative h-7 w-7 shrink-0 rounded-md bg-[#E9EFEC]" aria-hidden>
          <span className="absolute inset-0 m-auto h-2 w-2 animate-ping rounded-full bg-[#1E5E54]/60" />
          <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-[#1E5E54]" />
        </span>
        <span className="truncate text-[#5F6368]">{doc.filename}</span>
      </div>
      <span className="text-[#C9CCC8]">—</span>
      <span className="text-[#5F6368]">{formatDate(doc.created_at)}</span>
      <span className="text-[#C9CCC8]">—</span>
      <span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9EFEC] px-2.5 py-1 text-[12px] font-medium text-[#0F6E56]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0F6E56]" />
          <span className="animate-pulse">Extracting…</span>
        </span>
      </span>
      <span className="text-[#C9CCC8]">—</span>
      <span className="text-[#C9CCC8]">—</span>
    </div>
  );
}

/**
 * The documents table. `rows` are already filtered/sorted by InboxView;
 * `allDocs` is the full set so per-row flags (e.g. duplicate-invoice) can be
 * derived across the org. Rows that are still extracting (status 'pending')
 * render as a non-clickable live "Extracting…" row.
 */
export function DocumentTable({
  rows,
  allDocs,
}: {
  rows: DocumentWithSupplier[];
  allDocs: DocumentWithSupplier[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
      <div className={`grid ${COLS} items-center border-b border-[#E7E7E2] px-6 py-3 text-[12px] text-[#5F6368]`}>
        <span>Document</span>
        <span>Supplier</span>
        <span>Date</span>
        <span>Type</span>
        <span>Status</span>
        <span>Flags</span>
        <span>Confidence</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-[14px] text-[#9A9DA1]">No documents match.</div>
      ) : (
        rows.map((doc) => {
          // Not clickable until extraction finishes.
          if (doc.status === 'pending') {
            return <ExtractingRow key={doc.id} doc={doc} />;
          }
          const flags = deriveFlags(doc, allDocs);
          return (
            <Link
              key={doc.id}
              href={`/app/docu/${doc.id}`}
              className={`grid ${COLS} items-center border-b border-[#F0F0EC] px-6 py-3.5 text-[14px] transition-colors last:border-b-0 hover:bg-[#FAFAF8]`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-7 w-7 shrink-0 rounded-md bg-[#F0F0EC]" aria-hidden />
                <span className="truncate text-[#1A1C1E]">{doc.filename}</span>
              </div>
              <span className="truncate text-[#5F6368]">{doc.supplier?.name ?? '—'}</span>
              <span className="text-[#5F6368]">{formatDate(doc.created_at)}</span>
              <span className="text-[#5F6368]">
                {doc.document_type ? DOC_TYPE_LABEL[doc.document_type] : '—'}
              </span>
              <span>
                <StatusPill status={doc.status} />
              </span>
              <span>
                <FlagsList flags={flags} compact />
              </span>
              <span>
                <ConfidenceText value={doc.confidence} />
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
