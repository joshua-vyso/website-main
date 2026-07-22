'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';

type Mode = 'menu' | 'rename' | 'delete';

/**
 * Per-row actions (rename / delete) for a document in the inbox. Rendered inside
 * the row's stretched-link cell, so its trigger sits above the link and never
 * navigates. The dropdown is fixed-positioned to escape the month tile's
 * overflow-hidden, and closes on outside click or scroll.
 */
export function DocumentRowMenu({ id, filename }: { id: string; filename: string }) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [value, setValue] = useState(filename);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // The portal target only exists on the client — gate it until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    // Right-align to the kebab so the menu covers the row, not the link text.
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 208, window.innerWidth - 216)) });
    setValue(filename);
    setMode('menu');
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setMode('menu');
  }

  // Fixed positioning detaches from the page on scroll — just close it.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  async function rename() {
    const next = value.trim();
    if (!next || next === filename) return close();
    setBusy(true);
    const supabase = createClient();
    if (supabase) await supabase.from('documents').update({ filename: next }).eq('id', id);
    router.refresh();
    setBusy(false);
    close();
  }

  async function remove() {
    setBusy(true);
    // Routed server-side so it also reverses any ProcurePulse contribution.
    await fetch('/api/documents/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentIds: [id] }),
    }).catch(() => {});
    router.refresh();
    setBusy(false);
    close();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Document actions"
        onClick={openMenu}
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
                onClick={close}
                className="fixed inset-0 z-[9998] cursor-default"
              />
              <div
                style={{ position: 'fixed', top: pos.top, left: pos.left, fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
                className="z-[9999] w-[208px] rounded-2xl border border-[#EAEDF2] bg-white p-2 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.28)] ring-1 ring-black/[0.04]"
              >
                {mode === 'menu' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode('rename')}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-[#171A17] transition-colors hover:bg-[#F5F9FE]"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('delete')}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]"
                    >
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
                      aria-label="New document name"
                      className="h-9 w-full rounded-[10px] border border-[#3E7BC4] bg-white px-3 text-[13px] text-[#171A17] outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={close}
                        className="inline-flex h-8 items-center rounded-[9px] px-3.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void rename()}
                        disabled={busy || !value.trim()}
                        className="inline-flex h-8 items-center rounded-[9px] bg-[#1F5FA8] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
                      >
                        {busy ? '…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-1.5">
                    <p className="px-1 text-[12px] leading-snug text-[#6B6F68]">
                      Delete this document? This can&apos;t be undone.
                    </p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMode('menu')}
                        className="inline-flex h-8 items-center rounded-[9px] px-3.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove()}
                        disabled={busy}
                        className="inline-flex h-8 items-center rounded-[9px] bg-[#A32D2D] px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#8f2727] disabled:opacity-40"
                      >
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
