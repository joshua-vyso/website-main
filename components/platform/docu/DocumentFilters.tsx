'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DOC_TYPES, DOC_TYPE_LABEL, countByType } from '@/lib/platform/documents';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import type { DocumentFolder, DocumentType, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Filter control for the inbox. Document types live behind a "Filter" button
 * (popover) alongside the org's folders, and you can create a new folder
 * inline. State (active type / active folder) is owned by InboxView; folder
 * creation persists to document_folders here, then refreshes.
 */
export function DocumentFilters({
  docs,
  folders,
  activeType,
  onTypeChange,
  activeFolderId,
  onFolderChange,
  sortDir,
  onSortToggle,
  hideFilter = false,
}: {
  docs: DocumentWithSupplier[];
  folders: DocumentFolder[];
  activeType: DocumentType | null;
  onTypeChange: (t: DocumentType | null) => void;
  activeFolderId: string | null;
  onFolderChange: (id: string | null) => void;
  sortDir: 'desc' | 'asc';
  onSortToggle: () => void;
  /** Folder view: hide the type/folder filter, keep only Sort. */
  hideFilter?: boolean;
}) {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A just-created folder, shown optimistically until the server refresh lands
  // (so the active-filter label doesn't flicker to "All documents").
  const [optimistic, setOptimistic] = useState<DocumentFolder | null>(null);

  const allFolders =
    optimistic && !folders.some((f) => f.id === optimistic.id) ? [...folders, optimistic] : folders;
  const activeFolder = allFolders.find((f) => f.id === activeFolderId) ?? null;
  const hasFilter = activeType !== null || activeFolderId !== null;
  const buttonLabel = activeType
    ? DOC_TYPE_LABEL[activeType]
    : activeFolder
      ? activeFolder.name
      : 'All documents';

  function pickType(t: DocumentType | null) {
    onFolderChange(null);
    onTypeChange(t);
    setOpen(false);
  }

  function pickFolder(id: string) {
    onTypeChange(null);
    onFolderChange(id);
    setOpen(false);
  }

  function clearAll() {
    onTypeChange(null);
    onFolderChange(null);
  }

  async function createFolder() {
    const name = newName.trim();
    if (!name || creating) return;
    const supabase = createClient();
    if (!supabase || !org?.id) {
      setError('Supabase is not configured.');
      return;
    }
    setCreating(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('document_folders')
      .insert({ org_id: org.id, name, created_by: userId })
      .select('id')
      .single();
    setCreating(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setNewName('');
    if (data?.id && org.id) {
      setOptimistic({
        id: data.id as string,
        org_id: org.id,
        name,
        starred: false,
        color: null,
        created_by: userId ?? null,
        created_at: new Date().toISOString(),
      });
      pickFolder(data.id as string);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {hideFilter ? (
        <div />
      ) : (
        <div className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            hasFilter
              ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
              : 'border-[#E7E7E2] bg-white text-[#1A1C1E] hover:border-[#1E5E54]/30'
          }`}
          aria-expanded={open}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 4h12M4.5 8h7M6.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{buttonLabel}</span>
          <span className={hasFilter ? 'text-white/60' : 'text-[#9A9DA1]'}>▾</span>
        </button>

        {hasFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full border border-[#E7E7E2] bg-white px-3 py-1.5 text-[13px] text-[#5F6368] transition-colors hover:border-[#A32D2D]/30 hover:text-[#A32D2D]"
          >
            Clear ✕
          </button>
        ) : null}

        {/* Popover */}
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close filter"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-2xl border border-[#E7E7E2] bg-white p-3 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
              {/* Types */}
              <div className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">
                Document type
              </div>
              <div className="space-y-0.5">
                {DOC_TYPES.map((t) => {
                  const isActive = t.key === activeType && activeFolderId === null;
                  return (
                    <button
                      key={t.key ?? 'all'}
                      type="button"
                      onClick={() => pickType(t.key)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                        isActive ? 'bg-[#E9EFEC] text-[#0F4C44]' : 'text-[#1A1C1E] hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="text-[12px] text-[#9A9DA1]">{countByType(docs, t.key)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Folders */}
              <div className="mt-3 px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">
                Folders
              </div>
              <div className="space-y-0.5">
                {allFolders.length === 0 ? (
                  <p className="px-2.5 py-1 text-[12px] text-[#9A9DA1]">No folders yet.</p>
                ) : (
                  allFolders.map((f) => {
                    const isActive = f.id === activeFolderId;
                    const count = docs.filter((d) => d.folder_id === f.id).length;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => pickFolder(f.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                          isActive ? 'bg-[#E9EFEC] text-[#0F4C44]' : 'text-[#1A1C1E] hover:bg-[#FAFAF8]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: f.color ?? '#C9CCC8' }}
                          />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="text-[12px] text-[#9A9DA1]">{count}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* New folder */}
              <div className="mt-2 flex items-center gap-2 border-t border-[#F0F0EC] pt-2.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createFolder();
                  }}
                  placeholder="New folder name"
                  className="h-8 flex-1 rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void createFolder()}
                  disabled={creating || !newName.trim()}
                  className="h-8 shrink-0 rounded-lg bg-[#1E5E54] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                >
                  {creating ? '…' : 'Add'}
                </button>
              </div>
              {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
            </div>
          </>
        ) : null}
        </div>
      )}

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
