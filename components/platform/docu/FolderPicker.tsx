'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import type { DocumentFolder } from '@/lib/platform/types';

/**
 * Compact folder selector for the detail panel. Files a document into one of
 * the org's folders (or none) by writing documents.folder_id, then refreshes.
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = folders.find((f) => f.id === currentFolderId) ?? null;

  async function assign(folderId: string | null) {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    const supabase = createClient();
    if (supabase) {
      await supabase.from('documents').update({ folder_id: folderId }).eq('id', documentId);
    }
    router.refresh();
    setBusy(false);
  }

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
          <div className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-xl border border-[#E7E7E2] bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
            <button
              type="button"
              onClick={() => void assign(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                currentFolderId === null ? 'bg-[#E9EFEC] text-[#0F4C44]' : 'text-[#1A1C1E] hover:bg-[#FAFAF8]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#C9CCC8]" />
              No folder
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => void assign(f.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  f.id === currentFolderId ? 'bg-[#E9EFEC] text-[#0F4C44]' : 'text-[#1A1C1E] hover:bg-[#FAFAF8]'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color ?? '#C9CCC8' }} />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {folders.length === 0 ? (
              <p className="px-2.5 py-1.5 text-[12px] text-[#9A9DA1]">No folders yet — create one from the inbox filter.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
