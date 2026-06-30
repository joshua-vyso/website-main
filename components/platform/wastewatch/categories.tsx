'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { WASTE_CATEGORIES, CATEGORY_COLOR } from '@/lib/platform/wastewatch';

// ---------------------------------------------------------------------------
// User-defined waste categories
//
// Categories are no longer a fixed compile-time set. The built-in ones seed the
// store; users add their own via the "New category" popup. Custom categories are
// persisted to localStorage so they survive reloads (per browser) and are usable
// across the module — the doughnut/legend, the Log waste form and the Waste Log
// filter all read from this store. When a real backend exists this provider is
// the single seam to swap localStorage for an org-scoped table.
// ---------------------------------------------------------------------------

export interface WasteCategoryDef {
  name: string;
  color: string;
  /** false for the built-in seed categories, true for user-created ones. */
  custom: boolean;
}

const STORAGE_KEY = 'vyso.wastewatch.categories';

const BUILTINS: WasteCategoryDef[] = WASTE_CATEGORIES.map((name) => ({ name, color: CATEGORY_COLOR[name], custom: false }));

/** Palette offered in the colour picker — drawn from the Vyso module accents,
 * each visibly distinct from the others. */
export const CATEGORY_SWATCHES = ['#0F6E56', '#A32D2D', '#854F0B', '#0C447C', '#2C7A8A', '#D9730D', '#5B53C0', '#B0466A', '#2E7D67', '#3A4DB0', '#9A9DA1'];

interface CategoriesCtx {
  categories: WasteCategoryDef[];
  addCategory: (name: string, color: string) => { ok: boolean; error?: string };
  removeCategory: (name: string) => void;
  colorOf: (name: string) => string;
}

const Ctx = createContext<CategoriesCtx | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<WasteCategoryDef[]>([]);

  // Load persisted custom categories after mount (avoids any SSR/hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustom(parsed.filter((c) => c && typeof c.name === 'string' && typeof c.color === 'string').map((c) => ({ name: c.name, color: c.color, custom: true })));
        }
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next: WasteCategoryDef[]) => {
    setCustom(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((c) => ({ name: c.name, color: c.color }))));
    } catch {
      /* storage may be unavailable (private mode) — keep in-memory */
    }
  }, []);

  const categories = useMemo(() => [...BUILTINS, ...custom], [custom]);

  const addCategory = useCallback<CategoriesCtx['addCategory']>(
    (name, color) => {
      const n = name.trim();
      if (!n) return { ok: false, error: 'Give the category a name.' };
      if (n.length > 24) return { ok: false, error: 'Keep the name under 24 characters.' };
      if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: 'A category with that name already exists.' };
      persist([...custom, { name: n, color, custom: true }]);
      return { ok: true };
    },
    [categories, custom, persist],
  );

  const removeCategory = useCallback<CategoriesCtx['removeCategory']>(
    (name) => persist(custom.filter((c) => c.name !== name)),
    [custom, persist],
  );

  const colorOf = useCallback<CategoriesCtx['colorOf']>(
    (name) => categories.find((c) => c.name === name)?.color ?? '#9A9DA1',
    [categories],
  );

  const value = useMemo(() => ({ categories, addCategory, removeCategory, colorOf }), [categories, addCategory, removeCategory, colorOf]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCategories(): CategoriesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCategories must be used within a CategoriesProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Create-category popup
// ---------------------------------------------------------------------------

export function CreateCategoryModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (name: string) => void }) {
  const { addCategory } = useCategories();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Reset the form whenever the popup is opened.
  useEffect(() => {
    if (open) {
      setName('');
      setColor(CATEGORY_SWATCHES[0]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function submit() {
    const res = addCategory(name, color);
    if (!res.ok) {
      setError(res.error ?? 'Could not create the category.');
      return;
    }
    onCreated?.(name.trim());
    onClose();
  }

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[400px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">New waste category</h2>
            <p className="mt-0.5 text-[13px] text-[#5F6368]">Group waste your own way — it’ll appear here and in the Log waste form.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="e.g. Beverages"
              className="h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1A1C1E]">Colour</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-[#1A1C1E]/60 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
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
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
          <button type="button" onClick={submit} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">Create category</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
