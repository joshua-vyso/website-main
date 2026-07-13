'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { FOLDER_COLORS } from '@/lib/platform/docu/folders';
import { isUniqueViolation } from '@/lib/platform/db-errors';

/**
 * "New folder" — creates a custom document_folders row (name + colour) for the
 * org, then refreshes so the new tile appears in the grid.
 */
export function NewFolderButton() {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setColor(FOLDER_COLORS[0]);
    setError(null);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    const supabase = createClient();
    if (!supabase || !org?.id) {
      setError('Supabase is not configured.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: insErr } = await supabase
      .from('document_folders')
      .insert({ org_id: org.id, name: trimmed, color, created_by: userId });
    setBusy(false);
    if (insErr) {
      setError(isUniqueViolation(insErr) ? 'A folder with that name already exists.' : insErr.message);
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#E7E7E2] bg-white px-4 text-[14px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M8 3.5v9M3.5 8h9" />
        </svg>
        New folder
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[280px] rounded-2xl border border-[#E7E7E2] bg-white p-3 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]">
            <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">
              New folder
            </p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Folder name"
              className="h-9 w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
            />
            <div className="mt-2.5 grid grid-cols-8 gap-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-6 w-6 rounded-md transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-offset-1 ring-[#1A1C1E]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-1.5">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-[13px] text-[#5F6368] hover:bg-[#FAFAF8]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={busy || !name.trim()}
                className="rounded-lg bg-[#1E5E54] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
              >
                {busy ? 'Creating…' : 'Create folder'}
              </button>
            </div>
            {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
