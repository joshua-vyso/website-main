'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { DocumentStatsCards } from './docu/DocumentStatsCards';
import { DocumentFilters } from './docu/DocumentFilters';
import { DocumentTable } from './docu/DocumentTable';
import { UploadBubble } from './docu/UploadBubble';
import { DocuNav } from './docu/DocuNav';
import { createClient } from '@/lib/platform/supabase-browser';
import { applySearch, parseSearch, SEARCH_EXAMPLES } from '@/lib/platform/docu/search';
import { deriveFlags } from '@/lib/platform/docu/flags';
import type { DocumentFolder, DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Doc-U inbox. Owns search / type-filter / folder-filter / sort state, an
 * in-place upload bubble, and live polling while documents are extracting.
 * Public signature adds `folders`; the awaiting / confidence / flagged routes
 * pass an empty folder list and keep working.
 */
export function InboxView({
  docs,
  folders = [],
  title,
  subtitle,
  backHref,
  backLabel,
  hideFilter = false,
  hideStats = false,
  groupMode = 'month',
  emptyTitle,
  emptyBody,
}: {
  docs: DocumentWithSupplier[];
  folders?: DocumentFolder[];
  title: string;
  subtitle: string;
  /** When set, renders a "‹ {backLabel}" breadcrumb above the title (folder view). */
  backHref?: string;
  backLabel?: string;
  /** Folder view: the type/folder filter is redundant (already scoped). */
  hideFilter?: boolean;
  /** Folder view: KPI cards live on the hub, not inside a folder. */
  hideStats?: boolean;
  /** 'recent' groups rows into Today / This week instead of month tiles. */
  groupMode?: 'month' | 'recent';
  /** Custom empty-state copy (e.g. the Recent view). */
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const router = useRouter();
  useRealtimeRefresh('documents');
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Local mirror of the server docs so bulk delete/review reflect INSTANTLY
  // (optimistic) instead of waiting for a full server refetch. Re-seeded
  // whenever the server prop changes (a refresh reconciles to server truth).
  const [localDocs, setLocalDocs] = useState(docs);
  useEffect(() => {
    setLocalDocs(docs);
  }, [docs]);

  // While any document is still extracting (status 'pending'), poll the server
  // component so rows flip from "Extracting…" to their result live. The budget
  // resets whenever the pending set changes (e.g. a new upload), and caps at
  // ~2 min so a permanently-stuck pending row can't poll forever.
  const pendingKey = localDocs
    .filter((d) => d.status === 'pending')
    .map((d) => d.id)
    .sort()
    .join(',');
  const pollsRef = useRef(0);
  useEffect(() => {
    if (!pendingKey) return;
    pollsRef.current = 0;
    const iv = setInterval(() => {
      pollsRef.current += 1;
      if (pollsRef.current > 20) {
        clearInterval(iv);
        return;
      }
      router.refresh();
    }, 6000);
    return () => clearInterval(iv);
  }, [pendingKey, router]);

  const rows = useMemo(() => {
    const parsed = parseSearch(search);
    let result = applySearch(localDocs, parsed);
    if (activeType) result = result.filter((d) => d.document_type === activeType);
    if (activeFolderId) result = result.filter((d) => d.folder_id === activeFolderId);
    if (parsed.flag) {
      result = result.filter((d) => deriveFlags(d, localDocs).some((f) => f.kind === parsed.flag));
    }
    return [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });
  }, [localDocs, search, activeType, activeFolderId, sortDir]);

  // Recent view: bucket the filtered rows into Today vs earlier (this week) by
  // date ADDED. Computed after mount so day boundaries use the viewer's local
  // time and there's no SSR/CSR hydration mismatch. `null` until mounted.
  const [recentNow, setRecentNow] = useState<number | null>(null);
  useEffect(() => {
    if (groupMode === 'recent') setRecentNow(Date.now());
  }, [groupMode]);
  const recentGroups = useMemo(() => {
    if (groupMode !== 'recent' || recentNow == null) return null;
    const d = new Date(recentNow);
    const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today: DocumentWithSupplier[] = [];
    const week: DocumentWithSupplier[] = [];
    for (const doc of rows) {
      const t = new Date(doc.created_at).getTime();
      if (!Number.isNaN(t) && t >= startOfToday) today.push(doc);
      else week.push(doc);
    }
    const g: { key: string; label: string; docs: DocumentWithSupplier[] }[] = [];
    if (today.length) g.push({ key: 'today', label: 'Today', docs: today });
    if (week.length) g.push({ key: 'week', label: 'This week', docs: week });
    return g;
  }, [groupMode, recentNow, rows]);

  // Selectable = the currently-shown rows that have finished extracting.
  const selectableIds = useMemo(
    () => rows.filter((d) => d.status !== 'pending').map((d) => d.id),
    [rows],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmBulk(false);
  }
  async function bulkDelete() {
    if (selected.size === 0) return;
    const ids = [...selected];
    setBulkBusy(true);
    // Drop the rows immediately so deletion feels instant…
    setLocalDocs((prev) => prev.filter((d) => !selected.has(d.id)));
    exitSelect();
    await fetch('/api/documents/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentIds: ids }),
    }).catch(() => null);
    setBulkBusy(false);
    // …then reconcile with server truth (re-seeds localDocs, restoring the rows
    // if the delete failed).
    router.refresh();
  }
  async function bulkReview() {
    if (selected.size === 0) return;
    const ids = [...selected];
    setBulkBusy(true);
    // Flip the rows to 'reviewed' immediately.
    setLocalDocs((prev) =>
      prev.map((d) => (selected.has(d.id) ? { ...d, status: 'reviewed' as const } : d)),
    );
    exitSelect();
    const supabase = createClient();
    if (supabase) await supabase.from('documents').update({ status: 'reviewed' }).in('id', ids);
    setBulkBusy(false);
    router.refresh();
  }

  return (
    <div className="px-8 py-7">
      <DocuNav />

      {/* Header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-1.5 inline-flex items-center gap-1 text-[13px] text-[#5F6368] transition-colors hover:text-[#1A1C1E]"
            >
              <span aria-hidden>‹</span> {backLabel ?? 'Back'}
            </Link>
          ) : null}
          <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">{title}</h1>
          <p className="mt-1 text-[14px] text-[#5F6368]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Try: ${SEARCH_EXAMPLES[0]}`}
            aria-label="Search documents"
            className="h-10 w-72 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
          />
          {localDocs.length > 0 ? (
            <button
              type="button"
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className="inline-flex h-10 shrink-0 items-center rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30"
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUploadOpen((o) => !o)}
              className="inline-flex h-10 shrink-0 items-center rounded-xl bg-[#D9730D] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B]"
            >
              Upload document
            </button>
            {uploadOpen ? <UploadBubble onClose={() => setUploadOpen(false)} /> : null}
          </div>
        </div>
      </div>

      {/* KPI grid — hidden inside a folder (the hub carries the org-wide KPIs) */}
      {hideStats ? null : (
        <div className="mt-6">
          <DocumentStatsCards docs={localDocs} />
        </div>
      )}

      {/* Table or empty state */}
      {localDocs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
          <h2 className="text-[18px] font-semibold text-[#1A1C1E]">
            {emptyTitle ?? 'No documents yet'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
            {emptyBody ??
              'Upload your first document and Doc-U will extract the details automatically. Your stats above will fill in as documents come through.'}
          </p>
          {groupMode === 'recent' ? null : (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#D9730D] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#C2650B]"
            >
              Upload your first document
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6">
            <DocumentFilters
              docs={localDocs}
              folders={folders}
              activeType={activeType}
              onTypeChange={setActiveType}
              activeFolderId={activeFolderId}
              onFolderChange={setActiveFolderId}
              sortDir={sortDir}
              onSortToggle={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              hideFilter={hideFilter}
            />
          </div>
          {selectMode ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1E5E54]/30 bg-[#E9EFEC] px-4 py-2.5">
              <div className="flex items-center gap-4 text-[13px]">
                <span className="font-medium text-[#0F4C44]">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
                  className="text-[#1E5E54] hover:underline"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
              {confirmBulk ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-[#5F6368]">
                    Delete {selected.size} document{selected.size === 1 ? '' : 's'} permanently?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmBulk(false)}
                    className="rounded-lg px-2.5 py-1 text-[#5F6368] hover:bg-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkDelete()}
                    disabled={bulkBusy}
                    className="rounded-lg bg-[#A32D2D] px-3 py-1 font-medium text-white transition-colors hover:bg-[#8f2727] disabled:opacity-40"
                  >
                    {bulkBusy ? '…' : 'Confirm delete'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void bulkReview()}
                    disabled={selected.size === 0 || bulkBusy}
                    className="inline-flex items-center rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {bulkBusy ? '…' : `Mark reviewed${selected.size ? ` (${selected.size})` : ''}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulk(true)}
                    disabled={selected.size === 0}
                    className="inline-flex items-center rounded-lg border border-[#A32D2D]/40 px-3 py-1.5 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#FCEBEB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete{selected.size ? ` (${selected.size})` : ''}
                  </button>
                </div>
              )}
            </div>
          ) : null}
          <div className="mt-4">
            {rows.length === 0 && search.trim() ? (
              <div className="rounded-2xl border border-[#E7E7E2] bg-white px-6 py-12 text-center">
                <p className="text-[14px] text-[#5F6368]">No documents match “{search}”.</p>
                <p className="mt-1 text-[13px] text-[#9A9DA1]">
                  Try: {SEARCH_EXAMPLES.slice(1).join(' · ')}
                </p>
              </div>
            ) : groupMode === 'recent' ? (
              recentNow == null ? (
                <div className="space-y-3">
                  <div className="h-14 animate-pulse rounded-2xl border border-[#E7E7E2] bg-[#FAFAF8]" />
                  <div className="h-14 animate-pulse rounded-2xl border border-[#E7E7E2] bg-[#FAFAF8]" />
                </div>
              ) : (
                <DocumentTable
                  groups={recentGroups ?? []}
                  allDocs={localDocs}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                />
              )
            ) : (
              <DocumentTable
                rows={rows}
                allDocs={localDocs}
                selectMode={selectMode}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
