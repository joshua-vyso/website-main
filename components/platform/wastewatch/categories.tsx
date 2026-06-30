'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { WASTE_CATEGORIES, CATEGORY_COLOR } from '@/lib/platform/wastewatch';

// ---------------------------------------------------------------------------
// User-defined waste categories
//
// Categories are fully user-owned: the built-ins are only a starting point. The
// whole list (built-ins included) can be renamed, recoloured or removed, and is
// persisted to localStorage so it survives reloads (per browser). Built-in
// entries keep a `statKey` linking them to the demo waste aggregates in
// CATEGORY_STATS, so a rename preserves their historical data. The store is the
// single seam to swap localStorage for an org-scoped table later.
// ---------------------------------------------------------------------------

export interface WasteCategoryDef {
  /** Stable id — survives renames so demo stats and edits stay attached. */
  id: string;
  name: string;
  color: string;
  /** false for the seeded categories, true for user-created ones. */
  custom: boolean;
  /** Links a built-in to its CATEGORY_STATS aggregate (by original name). */
  statKey?: string;
}

const STORAGE_KEY = 'vyso.wastewatch.categories.v2';
const RADIUS_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

function seedDefaults(): WasteCategoryDef[] {
  return WASTE_CATEGORIES.map((name) => ({ id: `builtin:${name}`, name, color: CATEGORY_COLOR[name], custom: false, statKey: name }));
}

/** Palette offered in the colour picker — each visibly distinct. */
export const CATEGORY_SWATCHES = ['#0F6E56', '#A32D2D', '#854F0B', '#0C447C', '#2C7A8A', '#D9730D', '#5B53C0', '#B0466A', '#2E7D67', '#3A4DB0', '#9A9DA1'];

interface CategoriesCtx {
  categories: WasteCategoryDef[];
  addCategory: (name: string, color: string) => { ok: boolean; error?: string };
  editCategory: (id: string, name: string, color: string) => { ok: boolean; error?: string };
  removeCategory: (id: string) => void;
  resetCategories: () => void;
  colorOf: (name: string) => string;
}

const Ctx = createContext<CategoriesCtx | null>(null);

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `c_${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    /* fall through */
  }
  return `c_${Math.abs(Date.now() % 1e9).toString(36)}`;
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  // Built-ins as the initial value keep server and first client render identical;
  // any persisted edits load in the effect below.
  const [categories, setCategories] = useState<WasteCategoryDef[]>(seedDefaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setCategories(
            parsed
              .filter((c) => c && typeof c.name === 'string' && typeof c.color === 'string')
              .map((c) => ({ id: typeof c.id === 'string' ? c.id : newId(), name: c.name, color: c.color, custom: !!c.custom, statKey: typeof c.statKey === 'string' ? c.statKey : undefined })),
          );
        }
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next: WasteCategoryDef[]) => {
    setCategories(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable (private mode) — keep in-memory */
    }
  }, []);

  const validateName = useCallback(
    (name: string, ignoreId?: string): string | null => {
      const n = name.trim();
      if (!n) return 'Give the category a name.';
      if (n.length > 24) return 'Keep the name under 24 characters.';
      if (categories.some((c) => c.id !== ignoreId && c.name.toLowerCase() === n.toLowerCase())) return 'A category with that name already exists.';
      return null;
    },
    [categories],
  );

  const addCategory = useCallback<CategoriesCtx['addCategory']>(
    (name, color) => {
      const err = validateName(name);
      if (err) return { ok: false, error: err };
      persist([...categories, { id: newId(), name: name.trim(), color, custom: true }]);
      return { ok: true };
    },
    [categories, persist, validateName],
  );

  const editCategory = useCallback<CategoriesCtx['editCategory']>(
    (id, name, color) => {
      const err = validateName(name, id);
      if (err) return { ok: false, error: err };
      persist(categories.map((c) => (c.id === id ? { ...c, name: name.trim(), color } : c)));
      return { ok: true };
    },
    [categories, persist, validateName],
  );

  const removeCategory = useCallback<CategoriesCtx['removeCategory']>((id) => persist(categories.filter((c) => c.id !== id)), [categories, persist]);

  const resetCategories = useCallback<CategoriesCtx['resetCategories']>(() => persist(seedDefaults()), [persist]);

  const colorOf = useCallback<CategoriesCtx['colorOf']>((name) => categories.find((c) => c.name === name)?.color ?? '#9A9DA1', [categories]);

  const value = useMemo(
    () => ({ categories, addCategory, editCategory, removeCategory, resetCategories, colorOf }),
    [categories, addCategory, editCategory, removeCategory, resetCategories, colorOf],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCategories(): CategoriesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCategories must be used within a CategoriesProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Create / edit category popup
// ---------------------------------------------------------------------------

export function CategoryModal({ open, mode, category, onClose, onSaved }: { open: boolean; mode: 'create' | 'edit'; category?: WasteCategoryDef | null; onClose: () => void; onSaved?: (name: string) => void }) {
  const { addCategory, editCategory } = useCategories();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Seed the form when the popup opens (prefill in edit mode).
  useEffect(() => {
    if (open) {
      setName(mode === 'edit' ? category?.name ?? '' : '');
      setColor(mode === 'edit' ? category?.color ?? CATEGORY_SWATCHES[0] : CATEGORY_SWATCHES[0]);
      setError(null);
    }
  }, [open, mode, category]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function submit() {
    const res = mode === 'edit' && category ? editCategory(category.id, name, color) : addCategory(name, color);
    if (!res.ok) {
      setError(res.error ?? 'Could not save the category.');
      return;
    }
    onSaved?.(name.trim());
    onClose();
  }

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={RADIUS_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={onClose} />
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
              placeholder="e.g. Fruit & veg"
              className="h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
            />
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
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
          <button type="button" onClick={submit} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">{mode === 'edit' ? 'Save changes' : 'Create category'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
