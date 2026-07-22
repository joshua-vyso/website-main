'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlanWise } from './context';

const MODAL_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

// Swatches for new expense categories (distinct from the seeded palette where possible).
const PALETTE = ['#0C447C', '#854F0B', '#2E7D67', '#5B53C0', '#A0691A', '#7C5BC0', '#3E7C4F', '#B0552A'];

/** Add a new expense category (pw_budget_lines row) to the org's budget. */
export function AddBudgetLineModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (cat: string) => void }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { budget } = usePlanWise();
  const [mounted, setMounted] = useState(false);
  const [cat, setCat] = useState('');
  const [budgeted, setBudgeted] = useState('');
  const [actual, setActual] = useState('');
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setCat('');
      setBudgeted('');
      setActual('');
      setAction('');
      setBusy(false);
      setError(null);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  async function save() {
    const name = cat.trim();
    if (!name) { setError('Name the category.'); return; }
    if (!(Number(budgeted) > 0)) { setError('Set a budget amount.'); return; }
    const supabase = createClient();
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const b = Number(budgeted) || 0;
    const a = Number(actual) || 0;
    const { error: err } = await supabase.from('pw_budget_lines').insert({
      org_id: org.id,
      cat: name,
      budgeted: b,
      actual: a,
      profit_impact: b - a, // under budget = positive
      suggested_action: action.trim() || null,
      color: PALETTE[budget.length % PALETTE.length],
      sort_order: 100 + budget.length,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onSaved(name);
    onClose();
    router.refresh();
  }

  if (!mounted || !open) return null;
  const input = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/40 focus:outline-none';
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[420px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">Add budget category</h2>
            <p className="mt-0.5 text-[13px] text-[#5F6368]">A new expense line in this month&rsquo;s budget.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Category</label>
            <input autoFocus value={cat} onChange={(e) => { setCat(e.target.value); if (error) setError(null); }} placeholder="e.g. Cold chain, Insurance" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Budgeted (R)</label>
              <input value={budgeted} onChange={(e) => { setBudgeted(e.target.value); if (error) setError(null); }} inputMode="decimal" placeholder="0" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Actual (R)</label>
              <input value={actual} onChange={(e) => setActual(e.target.value)} inputMode="decimal" placeholder="0" className={input} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Suggested action <span className="text-[#9A9DA1]">(optional)</span></label>
            <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Lock an annual rate" className={input} />
          </div>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[#1F5FA8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#174C87] disabled:opacity-60">{busy ? 'Saving…' : 'Add category'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
