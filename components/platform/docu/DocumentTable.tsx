'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusPill, ConfidenceText } from '@/components/platform/ui';
import { documentTypeLabel } from '@/lib/platform/documents';
import { deriveFlags } from '@/lib/platform/docu/flags';
import type { DocumentFlag } from '@/lib/platform/docu/types';
import type { DocumentWithSupplier } from '@/lib/platform/types';
import { FlagsList } from './FlagsList';
import { DocumentRowMenu } from './DocumentRowMenu';

/** Shared column template — header + rows MUST use the same grid. */
const COLS = 'grid-cols-[minmax(170px,1fr)_150px_92px_120px_116px_84px_92px]';

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
      className={`grid ${COLS} items-center border-b border-[#EEF1F5] px-6 py-3.5 text-[14px] last:border-b-0`}
      aria-busy="true"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative h-7 w-7 shrink-0 rounded-md bg-[#E7EEF8]" aria-hidden>
          <span className="absolute inset-0 m-auto h-2 w-2 animate-ping rounded-full bg-[#1F5FA8]/60" />
          <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-[#1F5FA8]" />
        </span>
        <span className="truncate text-[#6B6F68]">{doc.filename}</span>
      </div>
      <span className="text-[#BFC5CC]">—</span>
      <span className="of-num text-[#6B6F68]">{formatDate(doc.created_at)}</span>
      <span className="text-[#BFC5CC]">—</span>
      <span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7EEF8] px-2.5 py-1 text-[12px] font-medium text-[#0F6E56]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0F6E56]" />
          <span className="animate-pulse">Extracting…</span>
        </span>
      </span>
      <span className="text-[#BFC5CC]">—</span>
      <span className="text-[#BFC5CC]">—</span>
    </div>
  );
}

/**
 * One document row. In select mode the row is a toggle button with a checkbox;
 * otherwise it's a stretched-link row with a kebab menu (rename / delete).
 * Pending docs always render the live "Extracting…" row.
 */
function DocRow({
  doc,
  flags,
  selectMode,
  selected,
  onToggle,
}: {
  doc: DocumentWithSupplier;
  /** Precomputed once by the table — avoids re-deriving per row on every render. */
  flags: DocumentFlag[];
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  if (doc.status === 'pending') return <ExtractingRow doc={doc} />;

  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(doc.id)}
        className={`grid ${COLS} w-full items-center border-b border-[#EEF1F5] px-6 py-3.5 text-left text-[14px] transition-colors last:border-b-0 ${
          selected ? 'bg-[#E7EEF8]' : 'hover:bg-[#F5F9FE]'
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
              selected ? 'border-[#3E7BC4] bg-[#1F5FA8] text-white' : 'border-[#BFC5CC] bg-white'
            }`}
          >
            {selected ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </span>
          <span className="truncate text-[#171A17]">{doc.filename}</span>
        </span>
        <span className="truncate text-[#6B6F68]">{doc.supplier?.name ?? '—'}</span>
        <span className="of-num text-[#6B6F68]">{formatDate(doc.created_at)}</span>
        <span className="text-[#6B6F68]">{documentTypeLabel(doc)}</span>
        <span>
          <StatusPill status={doc.status} />
        </span>
        <span>
          <FlagsList flags={flags} compact />
        </span>
        <span>
          <ConfidenceText value={doc.confidence} />
        </span>
      </button>
    );
  }

  const cell = 'pointer-events-none relative z-10';
  return (
    <div
      className={`group relative grid ${COLS} items-center border-b border-[#EEF1F5] px-6 py-3.5 text-[14px] transition-colors last:border-b-0 hover:bg-[#F5F9FE]`}
    >
      <Link href={`/app/docu/${doc.id}`} aria-label={`Open ${doc.filename}`} className="absolute inset-0 z-0" />

      <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2.5">
        <span className="h-7 w-7 shrink-0 rounded-md bg-[#EEF1F5]" aria-hidden />
        <span className="truncate text-[#171A17]">{doc.filename}</span>
        <span className="pointer-events-auto shrink-0">
          <DocumentRowMenu id={doc.id} filename={doc.filename} />
        </span>
      </div>
      <span className={`${cell} truncate text-[#6B6F68]`}>{doc.supplier?.name ?? '—'}</span>
      <span className={`${cell} of-num text-[#6B6F68]`}>{formatDate(doc.created_at)}</span>
      <span className={`${cell} text-[#6B6F68]`}>{documentTypeLabel(doc)}</span>
      <span className={cell}>
        <StatusPill status={doc.status} />
      </span>
      <span className={cell}>
        <FlagsList flags={flags} compact />
      </span>
      <span className={cell}>
        <ConfidenceText value={doc.confidence} />
      </span>
    </div>
  );
}

/** A collapsible section of the table (a month, or a custom Recent bucket). */
export interface DocGroup {
  key: string;
  label: string;
  docs: DocumentWithSupplier[];
}

/**
 * The documents table, rendered as collapsible tiles. By default it groups
 * `rows` into month tiles (most recent open). Pass `groups` to supply your own
 * sections instead (e.g. Today / This week on the Recent page) — those open by
 * default. `allDocs` is the full set so per-row flags (duplicate-invoice) derive
 * across the org.
 */
export function DocumentTable({
  rows,
  groups: customGroups,
  allDocs,
  selectMode = false,
  selected,
  onToggleSelect,
}: {
  rows?: DocumentWithSupplier[];
  groups?: DocGroup[];
  allDocs: DocumentWithSupplier[];
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  // The flat row set (for flag derivation) and the display sections. With custom
  // groups we use them as-is; otherwise we month-group `rows`.
  const flatRows = useMemo(
    () => (customGroups ? customGroups.flatMap((g) => g.docs) : (rows ?? [])),
    [customGroups, rows],
  );

  // Group preserving the incoming (already-sorted) order. Memoized so it isn't
  // rebuilt on every unrelated re-render (search keystroke, poll, toggle).
  const groups = useMemo<DocGroup[]>(() => {
    if (customGroups) return customGroups;
    const out: DocGroup[] = [];
    const byKey = new Map<string, number>();
    for (const doc of rows ?? []) {
      const k = monthKey(doc.created_at);
      if (!byKey.has(k)) {
        byKey.set(k, out.length);
        out.push({ key: k, label: monthLabel(k), docs: [] });
      }
      out[byKey.get(k)!].docs.push(doc);
    }
    return out;
  }, [customGroups, rows]);

  // Per-row flags computed ONCE per (rows, allDocs) change instead of per row on
  // every render — duplicate-invoice detection scans allDocs, so this was the
  // dominant O(n²) render cost on large inboxes.
  const flagsById = useMemo(() => {
    const map = new Map<string, DocumentFlag[]>();
    for (const doc of flatRows) {
      if (doc.status !== 'pending') map.set(doc.id, deriveFlags(doc, allDocs));
    }
    return map;
  }, [flatRows, allDocs]);

  // Custom groups all open by default; month tiles open the most recent dated
  // month. Recomputed every render (from the live groups) so filtering never
  // leaves every tile collapsed. User toggles win as per-key overrides.
  const datedKeys = groups.map((g) => g.key).filter((k) => k !== 'unknown').sort();
  const defaultOpenKey = datedKeys.length ? datedKeys[datedKeys.length - 1] : groups[0]?.key;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpenFor = (k: string) =>
    overrides[k] ?? (customGroups ? true : k === defaultOpenKey);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-[#EAEDF2] bg-white px-6 py-12 text-center text-[14px] text-[#8A8E86] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
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
          <div key={g.key} className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-[#F5F9FE]"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`text-[#8A8E86] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▾
                </span>
                <span className="of-display text-[16px] font-semibold text-[#171A17]">{g.label}</span>
              </span>
              <span className="text-[12px] text-[#A0A49C]">
                <span className="of-num">{g.docs.length}</span> document{g.docs.length === 1 ? '' : 's'}
              </span>
            </button>

            {isOpen ? (
              <div className="border-t border-[#EAEDF2]">
                <div
                  className={`grid ${COLS} items-center border-b border-[#EEF1F5] bg-[#FBFCFE] px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]`}
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
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    flags={flagsById.get(doc.id) ?? []}
                    selectMode={selectMode}
                    selected={selected?.has(doc.id) ?? false}
                    onToggle={onToggleSelect ?? (() => {})}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
