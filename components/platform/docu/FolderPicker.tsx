'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { DEFAULT_FOLDERS, isDefaultFolderName } from '@/lib/platform/documents';
import type { DocumentFolder } from '@/lib/platform/types';

/**
 * Folder selector for the detail panel. Files a document into a folder by
 * writing documents.folder_id, then refreshes. The menu is two-level: a
 * "Default" group (Vyso's document categories) and a "Custom" group (the org's
 * own folders, with inline create) — each expands to its options. Default
 * folders are created lazily the first time one is chosen.
 */
export function FolderPicker({
  documentId,
  folders,
  currentFolderId,
}: {
  documentId: string;
  folders: DocumentFolder[];
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const current = folders.find((f) => f.id === currentFolderId) ?? null;
  const customFolders = folders.filter((f) => !isDefaultFolderName(f.name));
  const defaultRowByName = new Map(
    folders.filter((f) => isDefaultFolderName(f.name)).map((f) => [f.name, f]),
  );

  // Open with the group containing the current folder already expanded.
  const initialGroup: 'default' | 'custom' | null = current
    ? isDefaultFolderName(current.name)
      ? 'default'
      : 'custom'
    : null;
  const [expanded, setExpanded] = useState<'default' | 'custom' | null>(initialGroup);

  async function writeFolder(folderId: string | null) {
    setBusy(true);
    setOpen(false);
    const supabase = createClient();
    if (supabase) {
      await supabase.from('documents').update({ folder_id: folderId }).eq('id', documentId);
    }
    router.refresh();
    setBusy(false);
  }

  /** Pick a default folder — find-or-create its row, then assign. */
  async function pickDefault(name: string) {
    if (busy) return;
    const existing = defaultRowByName.get(name);
    if (existing) return writeFolder(existing.id);
    setBusy(true);
    setOpen(false);
    const supabase = createClient();
    if (supabase && org?.id) {
      const { data } = await supabase
        .from('document_folders')
        .insert({ org_id: org.id, name, created_by: userId })
        .select('id')
        .single();
      if (data?.id) {
        await supabase.from('documents').update({ folder_id: data.id as string }).eq('id', documentId);
      }
    }
    router.refresh();
    setBusy(false);
  }

  async function createCustom() {
    const name = newName.trim();
    if (!name || creating) return;
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setCreating(true);
    const { data } = await supabase
      .from('document_folders')
      .insert({ org_id: org.id, name, created_by: userId })
      .select('id')
      .single();
    setCreating(false);
    setNewName('');
    if (data?.id) {
      setOpen(false);
      setBusy(true);
      await supabase.from('documents').update({ folder_id: data.id as string }).eq('id', documentId);
      router.refresh();
      setBusy(false);
    }
  }

  const rowCls = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-colors ${
      active ? 'bg-[#E9EFEC] text-[#0F4C44]' : 'text-[#1A1C1E] hover:bg-[#FAFAF8]'
    }`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/30 disabled:opacity-50"
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: current?.color ?? '#C9CCC8' }}
          aria-hidden
        />
        <span className="max-w-[160px] truncate">{current ? current.name : 'No folder'}</span>
        <span className="text-[#9A9DA1]">▾</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close folder menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[260px] overflow-y-auto rounded-2xl border border-[#E7E7E2] bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
            {/* No folder */}
            <button type="button" onClick={() => writeFolder(null)} className={rowCls(currentFolderId === null)}>
              <span className="h-2.5 w-2.5 rounded-full bg-[#C9CCC8]" />
              No folder
            </button>

            {/* Default group */}
            <button
              type="button"
              onClick={() => setExpanded((e) => (e === 'default' ? null : 'default'))}
              className="mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[12px] font-medium uppercase tracking-wide text-[#9A9DA1] transition-colors hover:bg-[#FAFAF8]"
              aria-expanded={expanded === 'default'}
            >
              <span>Default</span>
              <span className={`transition-transform ${expanded === 'default' ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {expanded === 'default' ? (
              <div className="space-y-0.5">
                {DEFAULT_FOLDERS.map((f) => {
                  const row = defaultRowByName.get(f.name);
                  const active = row != null && row.id === currentFolderId;
                  return (
                    <button key={f.name} type="button" onClick={() => pickDefault(f.name)} className={rowCls(active)}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="truncate">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Custom group */}
            <button
              type="button"
              onClick={() => setExpanded((e) => (e === 'custom' ? null : 'custom'))}
              className="mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[12px] font-medium uppercase tracking-wide text-[#9A9DA1] transition-colors hover:bg-[#FAFAF8]"
              aria-expanded={expanded === 'custom'}
            >
              <span>Custom</span>
              <span className={`transition-transform ${expanded === 'custom' ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {expanded === 'custom' ? (
              <div className="space-y-0.5">
                {customFolders.map((f) => (
                  <button key={f.id} type="button" onClick={() => writeFolder(f.id)} className={rowCls(f.id === currentFolderId)}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color ?? '#C9CCC8' }} />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
                <div className="mt-1 flex items-center gap-1.5 px-1 pb-0.5">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void createCustom();
                    }}
                    placeholder="New folder"
                    className="h-7 flex-1 rounded-lg border border-[#E7E7E2] bg-white px-2 text-[12px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void createCustom()}
                    disabled={creating || !newName.trim()}
                    className="h-7 shrink-0 rounded-lg bg-[#1E5E54] px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                  >
                    {creating ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
