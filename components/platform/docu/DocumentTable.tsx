'use client';

import { useState } from 'react';
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

/**
 * "2026-06" bucket key for a timestamp (sorts lexically). Buckets by the
 * viewer's LOCAL calendar month on purpose — "when it hit my inbox" — kept
 * consistent with formatDate/monthLabel which are also local.
 */
function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "June 2026" label for a month key. */
function monthLabel(key: string): string {
  if (key === 'unknown') return 'Undated';
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
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

/** One document row — a link once extracted, the live row while pending. */
function DocRow({ doc, allDocs }: { doc: DocumentWithSupplier; allDocs: DocumentWithSupplier[] }) {
  if (doc.status === 'pending') return <ExtractingRow doc={doc} />;
  const flags = deriveFlags(doc, allDocs);
  return (
    <Link
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
}

/**
 * The documents table, grouped into collapsible month tiles (most recent open
 * by default). `rows` are already filtered/sorted by InboxView; `allDocs` is the
 * full set so per-row flags (e.g. duplicate-invoice) derive across the org.
 */
export function DocumentTable({
  rows,
  allDocs,
}: {
  rows: DocumentWithSupplier[];
  allDocs: DocumentWithSupplier[];
}) {
  // Group preserving the incoming (already-sorted) order.
  const groups: { key: string; docs: DocumentWithSupplier[] }[] = [];
  const byKey = new Map<string, number>();
  for (const doc of rows) {
    const k = monthKey(doc.created_at);
    if (!byKey.has(k)) {
      byKey.set(k, groups.length);
      groups.push({ key: k, docs: [] });
    }
    groups[byKey.get(k)!].docs.push(doc);
  }

  // The most recent real month among the CURRENTLY visible groups is open by
  // default. Recomputed every render (from the live, filtered `groups`) so that
  // filtering never leaves every tile collapsed. User toggles are stored as
  // per-month overrides that win over the default.
  const datedKeys = groups.map((g) => g.key).filter((k) => k !== 'unknown').sort();
  const defaultOpenKey = datedKeys.length ? datedKeys[datedKeys.length - 1] : groups[0]?.key;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpenFor = (k: string) => overrides[k] ?? k === defaultOpenKey;

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E7E2] bg-white px-6 py-10 text-center text-[14px] text-[#9A9DA1]">
        No documents match.
      </div>
    );
  }

  const toggle = (k: string) => setOverrides((prev) => ({ ...prev, [k]: !isOpenFor(k) }));

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = isOpenFor(g.key);
        return (
          <div key={g.key} className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-[#FAFAF8]"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`text-[#9A9DA1] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▾
                </span>
                <span className="text-[14px] font-semibold text-[#1A1C1E]">{monthLabel(g.key)}</span>
              </span>
              <span className="text-[12px] text-[#9A9DA1]">
                {g.docs.length} document{g.docs.length === 1 ? '' : 's'}
              </span>
            </button>

            {isOpen ? (
              <div className="border-t border-[#E7E7E2]">
                <div
                  className={`grid ${COLS} items-center border-b border-[#F0F0EC] bg-[#FBFBF9] px-6 py-2.5 text-[12px] text-[#5F6368]`}
                >
                  <span>Document</span>
                  <span>Supplier</span>
                  <span>Date</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Flags</span>
                  <span>Confidence</span>
                </div>
                {g.docs.map((doc) => (
                  <DocRow key={doc.id} doc={doc} allDocs={allDocs} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
