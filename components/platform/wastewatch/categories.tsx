'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import type { WasteWatchData, WasteCategoryRow } from '@/lib/platform/wastewatch';

// ---------------------------------------------------------------------------
// WasteWatch provider — holds the org's waste data (fetched per-org in the
// layout) and exposes the category CRUD as real ww_waste_categories writes.
// Categories are fully user-owned: renamed, recoloured, added or removed.
// ---------------------------------------------------------------------------

const RADIUS_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

/** Palette offered in the colour picker — each visibly distinct. */
export const CATEGORY_SWATCHES = ['#0F6E56', '#A32D2D', '#854F0B', '#0C447C', '#2C7A8A', '#D9730D', '#5B53C0', '#B0466A', '#2E7D67', '#3A4DB0', '#9A9DA1'];

type SaveResult = { ok: boolean; error?: string };

interface WasteWatchCtx extends WasteWatchData {
  colorOf: (name: string) => string;
  isEmpty: boolean;
  addCategory: (name: string, color: string) => Promise<SaveResult>;
  editCategory: (id: string, name: string, color: string) => Promise<SaveResult>;
  removeCategory: (id: string) => Promise<void>;
}

const Ctx = createContext<WasteWatchCtx | null>(null);

export function WasteWatchProvider({ data, children }: { data: WasteWatchData; children: ReactNode }) {
  const router = useRouter();
  const { org } = usePlatform();

  const value = useMemo<WasteWatchCtx>(() => {
    const cats = data.categories;
    const validate = (name: string, ignoreId?: string): string | null => {
      const n = name.trim();
      if (!n) return 'Give the category a name.';
      if (n.length > 24) return 'Keep the name under 24 characters.';
      if (cats.some((c) => c.id !== ignoreId && c.name.toLowerCase() === n.toLowerCase())) return 'A category with that name already exists.';
      return null;
    };
    return {
      ...data,
      isEmpty: data.events.length === 0 && data.categories.length === 0 && data.devices.length === 0,
      colorOf: (name: string) => cats.find((c) => c.name === name)?.color ?? '#9A9DA1',
      async addCategory(name, color) {
        const err = validate(name);
        if (err) return { ok: false, error: err };
        const supabase = createClient();
        if (!supabase || !org) return { ok: false, error: 'Not connected.' };
        const { error } = await supabase.from('ww_waste_categories').insert({ org_id: org.id, name: name.trim(), color, cost: 0, pct: 0, trend: [], sort_order: cats.length + 1 });
        if (error) return { ok: false, error: error.message };
        router.refresh();
        return { ok: true };
      },
      async editCategory(id, name, color) {
        const err = validate(name, id);
        if (err) return { ok: false, error: err };
        const supabase = createClient();
        if (!supabase || !org) return { ok: false, error: 'Not connected.' };
        const { error } = await supabase.from('ww_waste_categories').update({ name: name.trim(), color }).eq('id', id);
        if (error) return { ok: false, error: error.message };
        router.refresh();
        return { ok: true };
      },
      async removeCategory(id) {
        const supabase = createClient();
        if (!supabase) return;
        await supabase.from('ww_waste_categories').delete().eq('id', id);
        router.refresh();
      },
    };
  }, [data, org, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWasteWatch(): WasteWatchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWasteWatch must be used within a WasteWatchProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Create / edit category popup
// ---------------------------------------------------------------------------

export function CategoryModal({ open, mode, category, onClose, onSaved }: { open: boolean; mode: 'create' | 'edit'; category?: WasteCategoryRow | null; onClose: () => void; onSaved?: (name: string) => void }) {
  const { addCategory, editCategory } = useWasteWatch();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setName(mode === 'edit' ? category?.name ?? '' : '');
      setColor(mode === 'edit' ? category?.color ?? CATEGORY_SWATCHES[0] : CATEGORY_SWATCHES[0]);
      setError(null);
    }
  }, [open, mode, category]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  async function submit() {
    setBusy(true);
    const res = mode === 'edit' && category ? await editCategory(category.id, name, color) : await addCategory(name, color);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Could not save the category.'); return; }
    onSaved?.(name.trim());
    onClose();
  }

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={RADIUS_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[400px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">{mode === 'edit' ? 'Edit category' : 'New waste category'}</h2>
            <p className="mt-0.5 text-[13px] text-[#5F6368]">Group waste your own way — it’ll appear here and in the Log waste form.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Name</label>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (error) setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Leafy Greens" className="h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/40 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1A1C1E]">Colour</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_SWATCHES.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-[#1A1C1E]/60 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#FAFAF8] px-3 py-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[13px] text-[#5F6368]">Preview · <span className="font-medium text-[#1A1C1E]">{name.trim() || 'New category'}</span></span>
          </div>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#174C87] disabled:opacity-60">{busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create category'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
