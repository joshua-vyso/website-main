'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ModuleWidgetCard } from '@/components/platform/module-ui';
import { widgetsFor } from '@/lib/platform/module-widgets';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { DEVICE_STATUS_STYLE, WASTE_REASONS, type DeviceStatus, type WasteCategory } from '@/lib/platform/wastewatch';
import { useWasteWatch } from './categories';

const MODAL_RADIUS = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

const UNITS = ['kg', 'units', 'crates', 'L'];
/** Reasons that stem from a controllable process (vs. natural spoilage). */
const PREVENTABLE_REASONS = new Set(['Over-portioned', 'Prep error', 'Damaged']);

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const s = DEVICE_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'animate-pulse' : ''}`} style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

export function CategoryBadge({ cat }: { cat: WasteCategory }) {
  const { colorOf } = useWasteWatch();
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] text-[#2C333B]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(cat) }} />
      {cat}
    </span>
  );
}

export function BatteryPill({ level }: { level: number | null }) {
  if (level == null) return <span className="of-num text-[12px] text-[#A0A49C]">—</span>;
  const color = level <= 20 ? '#A32D2D' : level <= 50 ? '#854F0B' : '#0F6E56';
  return (
    <span className="of-num inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color }}>
      <span className="relative inline-block h-3 w-6 rounded-sm border" style={{ borderColor: color }}>
        <span className="absolute inset-y-0.5 left-0.5 rounded-[1px]" style={{ width: `${Math.max(8, level * 0.18)}px`, backgroundColor: color }} />
      </span>
      {level}%
    </span>
  );
}

export function TrendArrow({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  const map = { up: { g: '▲', c: '#A32D2D' }, down: { g: '▼', c: '#0F6E56' }, flat: { g: '→', c: '#8A8E86' } };
  return <span style={{ color: map[dir].c }}>{map[dir].g}</span>;
}

export function MobileWidgets({ onAction }: { onAction?: () => void }) {
  return (
    <div>
      <h2 className="mb-2.5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {widgetsFor('wastewatch').map((w) => (
          <ModuleWidgetCard key={w.id} widget={w} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

type LogStep = 'choose' | 'device' | 'device-done' | 'manual';

/** Log waste as a centered popup. Step one offers two tiles — connect a measuring
 * device (prompts for the operator's name; scale wiring comes later) or enter the
 * waste manually. */
export function LogWasteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { categories } = useWasteWatch();
  const { org } = usePlatform();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<LogStep>('choose');
  const [name, setName] = useState('');

  // Manual-entry form
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [recipe, setRecipe] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setStep('choose');
      setName('');
      setItem('');
      setQty('');
      setUnit(UNITS[0]);
      setCategory(categories[0]?.name ?? '');
      setCost('');
      setReason(WASTE_REASONS[0]);
      setRecipe('');
      setNotes('');
      setSaving(false);
      setError(null);
    }
  }, [open, categories]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const input = 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
  const title = step === 'manual' ? 'Enter waste manually' : step === 'choose' ? 'Log waste' : 'Connect to a device';
  const subtitle = step === 'choose' ? 'How would you like to record this?' : step === 'manual' ? 'Type the details yourself' : 'Start a measuring session';

  const canSave = !!org && item.trim().length > 0 && Number(qty) > 0 && !saving;

  async function submitManual() {
    if (!org || !canSave) return;
    const supabase = createClient();
    if (!supabase) { setError('Not connected.'); return; }
    setSaving(true);
    setError(null);
    const now = new Date();
    const row = {
      org_id: org.id,
      event_date: now.toISOString().slice(0, 10),
      event_time: now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }),
      item: item.trim(),
      category: category || categories[0]?.name || 'Uncategorised',
      qty: Number(qty) || 0,
      unit,
      cost: Number(cost) || 0,
      reason,
      recipe: recipe.trim() || null,
      employee: 'You',
      device: 'Manual entry',
      location: 'Main site',
      preventable: PREVENTABLE_REASONS.has(reason),
      notes: notes.trim() || null,
    };
    const { error: insErr } = await supabase.from('ww_waste_events').insert(row);
    if (insErr) {
      setSaving(false);
      setError(insErr.message);
      return;
    }
    router.refresh();
    onClose();
    onSaved();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_RADIUS}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[440px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display text-[18px] font-semibold tracking-[-0.015em] text-[#171A17]">{title}</h2>
            <p className="mt-1 text-[13px] text-[#6B6F68]">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]">✕</button>
        </div>

        {step === 'choose' ? (
          <div className="mt-4 space-y-3">
            <ChoiceTile
              onClick={() => setStep('device')}
              title="Connect to a device"
              desc="Pair a scale and capture waste automatically."
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7 7 10 10-5 5V2l5 5L7 17" /></svg>}
            />
            <ChoiceTile
              onClick={() => setStep('manual')}
              title="Enter manually"
              desc="Type the item, quantity and reason yourself."
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>}
            />
          </div>
        ) : null}

        {step === 'device' ? (
          <>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#171A17]">Your name</label>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep('device-done'); }} placeholder="e.g. Thandi Mokoena" className={input} />
              </div>
              <p className="rounded-[12px] border border-[#EAF2FC] bg-[#F5F9FE] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#6B6F68]">Once a scale is linked to your account, your waste is weighed and logged automatically — no typing. We’ll wire up the hardware connection here soon.</p>
            </div>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={() => setStep('choose')} className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#F2F4F7] hover:text-[#171A17]">Back</button>
              <button type="button" disabled={!name.trim()} onClick={() => setStep('device-done')} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40">Continue</button>
            </div>
          </>
        ) : null}

        {step === 'device-done' ? (
          <>
            <div className="mt-4 flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F5EE] text-[#0F6E56]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <div>
                <div className="of-display text-[16px] font-semibold text-[#171A17]">You’re set{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}</div>
                <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-[#6B6F68]">Connect your scale to start capturing waste automatically. For now you can log it manually.</p>
              </div>
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <button type="button" onClick={() => setStep('manual')} className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87]">Log manually instead</button>
              <button type="button" onClick={onClose} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">Done</button>
            </div>
          </>
        ) : null}

        {step === 'manual' ? (
          <>
            <div className="mt-4 space-y-3">
              <input autoFocus value={item} onChange={(e) => setItem(e.target.value)} className={input} placeholder="Item (e.g. Strawberries)" />
              <div className="grid grid-cols-[1fr_84px_1fr] gap-3">
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={input} placeholder="Quantity" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={input}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={input} placeholder="Estimated cost (R)" />
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>{WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>
              <input value={recipe} onChange={(e) => setRecipe(e.target.value)} className={input} placeholder="Recipe (optional)" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} h-20 py-2.5`} placeholder="Notes (optional)" />
              {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
            </div>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={() => setStep('choose')} className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#F2F4F7] hover:text-[#171A17]">Back</button>
              <button type="button" disabled={!canSave} onClick={submitManual} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Logging…' : 'Log waste'}</button>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function ChoiceTile({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 rounded-[14px] border border-[#EEF1F5] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#C9DEF7] hover:bg-[#FBFCFE] hover:shadow-[0_6px_18px_-10px_rgba(20,24,20,0.28)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#EAF2FC] text-[#1F5FA8]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-[#171A17]">{title}</span>
        <span className="mt-0.5 block text-[12px] text-[#8A8E86]">{desc}</span>
      </span>
      <span className="shrink-0 text-[#C4C7CA]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </span>
    </button>
  );
}
