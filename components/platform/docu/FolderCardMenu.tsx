'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { FOLDER_COLORS } from '@/lib/platform/docu/folders';

type Mode = 'menu' | 'rename' | 'color' | 'delete';

/**
 * Per-folder actions (rename / recolour / delete) for a CUSTOM folder tile.
 * Rendered inside the tile's stretched-link card, so its trigger sits above the
 * link and never navigates. The dropdown is fixed-positioned to escape the card,
 * and closes on outside click or scroll. Deleting a folder unfiles its documents
 * (folder_id → null) rather than deleting them.
 */
export function FolderCardMenu({
  folderId,
  name,
  color,
}: {
  folderId: string;
  name: string;
  color: string | null;
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // Portal target only exists on the client — gate the portal until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    // Right-align the menu to the kebab so it covers the tile rather than opening
    // beside the tile's own text (which read as see-through).
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 200, window.innerWidth - 210)) });
    setValue(name);
    setMode('menu');
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setMode('menu');
  }

  // Fixed positioning detaches on scroll — just close.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  async function rename() {
    const next = value.trim();
    if (!next || next === name) return close();
    setBusy(true);
    const supabase = createClient();
    if (supabase) await supabase.from('document_folders').update({ name: next }).eq('id', folderId);
    router.refresh();
    setBusy(false);
    close();
  }

  async function recolour(c: string) {
    setBusy(true);
    const supabase = createClient();
    if (supabase) await supabase.from('document_folders').update({ color: c }).eq('id', folderId);
    router.refresh();
    setBusy(false);
    close();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    if (supabase) {
      // Unfile this folder's documents first (so the FK never blocks the delete),
      // then drop the folder. Docs fall back to their document-type folder.
      await supabase.from('documents').update({ folder_id: null }).eq('folder_id', folderId);
      await supabase.from('document_folders').delete().eq('id', folderId);
    }
    router.refresh();
    setBusy(false);
    close();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${name}`}
        onClick={(e) => {
          e.preventDefault();
          openMenu();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {open && mounted
        ? createPortal(
            <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={(e) => {
              e.preventDefault();
              close();
            }}
            className="fixed inset-0 z-[9998] cursor-default"
          />
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
            className="z-[9999] w-[208px] rounded-2xl border border-[#EAEDF2] bg-white p-2 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.28)] ring-1 ring-black/[0.04]"
          >
            {mode === 'menu' ? (
              <>
                <button type="button" onClick={() => setMode('rename')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
                  Rename
                </button>
                <button type="button" onClick={() => setMode('color')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]">
                  Recolour
                </button>
                <button type="button" onClick={() => setMode('delete')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]">
                  Delete
                </button>
              </>
            ) : mode === 'rename' ? (
              <div className="p-1">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void rename();
                    if (e.key === 'Escape') close();
                  }}
                  aria-label="New folder name"
                  className="h-8 w-full rounded-[10px] border border-[#3E7BC4] bg-white px-2.5 text-[13px] text-[#171A17] outline-none"
                />
                <div className="mt-1.5 flex justify-end gap-1.5">
                  <button type="button" onClick={close} className="inline-flex h-8 items-center rounded-[9px] px-3 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87]">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void rename()} disabled={busy || !value.trim()} className="inline-flex h-8 items-center rounded-[9px] bg-[#1F5FA8] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40">
                    {busy ? '…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : mode === 'color' ? (
              <div className="p-1.5">
                <p className="px-1 pb-1.5 text-[12px] text-[#6B6F68]">Pick a colour</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void recolour(c)}
                      disabled={busy}
                      aria-label={`Set colour ${c}`}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-105 ${
                        (color ?? '') === c ? 'ring-2 ring-offset-1 ring-[#171A17]' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-1.5">
                <p className="px-1 text-[12px] leading-snug text-[#6B6F68]">
                  Delete this folder? Its documents stay in Doc-U and become unfiled.
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button type="button" onClick={() => setMode('menu')} className="inline-flex h-8 items-center rounded-[9px] px-3 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87]">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex h-8 items-center rounded-[9px] bg-[#A32D2D] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#8f2727] disabled:opacity-40">
                    {busy ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
