'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { SectionCard, DataTable, PrimaryAction } from '@/components/platform/module-ui';
import { useToast } from '@/components/platform/orderflow/ui';
import type { SupplierHistoryEvent } from '@/lib/platform/supplysync-data';
import { useSupplySync } from './context';
import { AMBER, EmptyState, INK, MUTE, RED, FAINT, ACCENT, channelColor, SupplierNameButton } from './shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODAL_STYLE = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

/** Channels a user can log a communication against (with their event_type key). */
const LOG_CHANNELS = [
  'Call',
  'WhatsApp',
  'Email',
  'Meeting',
  'Price Update',
  'Document Request',
  'Complaint',
  'Delivery Issue',
] as const;
type LogChannel = (typeof LOG_CHANNELS)[number];

const EVENT_TYPE_FOR: Record<LogChannel, string> = {
  Call: 'call',
  WhatsApp: 'whatsapp',
  Email: 'email',
  Meeting: 'meeting',
  'Price Update': 'price_update',
  'Document Request': 'document_request',
  Complaint: 'complaint',
  'Delivery Issue': 'delivery_issue',
};

function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Nicely format an ISO date (or "—" when missing). */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Days from today to a follow-up date (negative = overdue). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(then)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((then - today) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function ChannelPill({ channel }: { channel: string | null }) {
  const c = channelColor(channel);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${c}14`, color: c }}
    >
      {channel ?? 'Event'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Log-communication modal (real insert into ss_supplier_history)
// ---------------------------------------------------------------------------

function LogCommunicationModal({
  open,
  onClose,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: (msg: string) => void;
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const { suppliers } = useSupplySync();

  const [mounted, setMounted] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [channel, setChannel] = useState<LogChannel>('Call');
  const [summary, setSummary] = useState('');
  const [contactName, setContactName] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setSupplierId(suppliers[0]?.id ?? '');
      setChannel('Call');
      setSummary('');
      setContactName('');
      setFollowUp('');
      setFollowUpDate('');
      setBusy(false);
      setError(null);
    }
  }, [open, suppliers]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  async function save() {
    if (!supplierId) {
      setError('Choose a supplier.');
      return;
    }
    if (!summary.trim()) {
      setError('Add a short summary.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const fu = followUp.trim();
    const { error: err } = await supabase.from('ss_supplier_history').insert({
      org_id: org.id,
      supplier_id: supplierId,
      event_type: EVENT_TYPE_FOR[channel],
      channel,
      summary: summary.trim(),
      contact_name: contactName.trim() || null,
      follow_up: fu || null,
      follow_up_date: fu && followUpDate ? followUpDate : null,
      follow_up_done: false,
      owner: 'You',
      event_date: todayISO(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onLogged('Communication logged');
    onClose();
    router.refresh();
  }

  if (!mounted || !open) return null;

  const input =
    'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4] focus:outline-none';
  const select = `${input} appearance-none`;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[460px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display text-[18px] font-semibold tracking-[-0.015em] text-[#171A17]">Log communication</h2>
            <p className="mt-1 text-[13px] text-[#6B6F68]">Record a touchpoint on the supplier timeline.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Supplier</label>
              <select
                autoFocus
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  if (error) setError(null);
                }}
                className={select}
              >
                {suppliers.length === 0 ? <option value="">No suppliers</option> : null}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as LogChannel)} className={select}>
                {LOG_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#171A17]">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="What was discussed or agreed?"
              className="w-full resize-none rounded-[12px] border border-[#E4E9F0] bg-white px-4 py-2.5 text-[14px] text-[#171A17] transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#171A17]">
              Contact name <span className="text-[#8A8E86]">(optional)</span>
            </label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Thabo Ndlovu"
              className={input}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">
                Follow-up <span className="text-[#8A8E86]">(optional)</span>
              </label>
              <input
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="e.g. Send revised quote"
                className={input}
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#171A17]">
                Follow-up date <span className="text-[#8A8E86]">(optional)</span>
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className={input}
              />
            </div>
          </div>

          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
          >
            {busy ? 'Logging…' : 'Log communication'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Relationship History tab
// ---------------------------------------------------------------------------

export function HistoryTab() {
  const router = useRouter();
  const { org } = usePlatform();
  const { isEmpty, history, suppliers, openProfile } = useSupplySync();
  const { node: toastNode, show } = useToast();

  const [logOpen, setLogOpen] = useState(false);
  // Optimistic overrides for follow-ups just marked done (id -> true).
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function markFollowUpDone(ev: SupplierHistoryEvent) {
    const supabase = createClient();
    if (!supabase || !org) {
      show('Not connected.');
      return;
    }
    setSavingId(ev.id);
    setDoneOverride((prev) => ({ ...prev, [ev.id]: true }));
    const { error } = await supabase
      .from('ss_supplier_history')
      .update({ follow_up_done: true })
      .eq('id', ev.id)
      .eq('org_id', org.id);
    setSavingId(null);
    if (error) {
      // Roll the optimistic flip back on failure.
      setDoneOverride((prev) => {
        const next = { ...prev };
        delete next[ev.id];
        return next;
      });
      show('Could not update follow-up.');
      return;
    }
    show('Follow-up completed');
    router.refresh();
    // Let the refreshed server value take over the optimistic flip.
    setDoneOverride((prev) => {
      const n = { ...prev };
      delete n[ev.id];
      return n;
    });
  }

  const isDone = (ev: SupplierHistoryEvent) => doneOverride[ev.id] ?? ev.followUpDone;

  // --- Communication log rows (all events, newest first) ---
  const logRows = useMemo(
    () =>
      [...history]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map((ev) => {
          const followUpCell =
            ev.followUp && !isDone(ev)
              ? `${ev.followUp}${ev.followUpDate ? ` · ${fmtDate(ev.followUpDate)}` : ''}`
              : ev.followUp && isDone(ev)
                ? `${ev.followUp} · done`
                : '—';
          return [
            <span key="date" className="of-num whitespace-nowrap text-[#6B6F68]">
              {fmtDate(ev.date)}
            </span>,
            ev.supplierId ? (
              <SupplierNameButton key="sup" id={ev.supplierId} name={ev.supplierName || 'Supplier'} />
            ) : (
              <span key="sup" className="text-[#6B6F68]">
                {ev.supplierName || '—'}
              </span>
            ),
            <span key="contact" className="text-[#6B6F68]">
              {ev.contactName || '—'}
            </span>,
            <ChannelPill key="channel" channel={ev.channel} />,
            <span key="summary" className="text-[#171A17]">
              {ev.summary || '—'}
            </span>,
            <span key="fu" className="text-[#6B6F68]">
              {followUpCell}
            </span>,
            <span key="owner" className="text-[#6B6F68]">
              {ev.owner || '—'}
            </span>,
          ];
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, doneOverride, openProfile],
  );

  // --- Notes board: suppliers that have notes, latest 1–2 each ---
  const noteCards = useMemo(
    () =>
      suppliers
        .filter((s) => s.notes.length > 0)
        .map((s) => ({
          supplier: s,
          notes: [...s.notes]
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
            .slice(0, 2),
        })),
    [suppliers],
  );

  // --- Outstanding follow-ups: set + not done, soonest first ---
  const followUps = useMemo(
    () =>
      history
        .filter((ev) => !!ev.followUp && !isDone(ev))
        .sort((a, b) => {
          const av = a.followUpDate ?? '9999-12-31';
          const bv = b.followUpDate ?? '9999-12-31';
          return av < bv ? -1 : av > bv ? 1 : 0;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, doneOverride],
  );

  if (isEmpty) {
    return (
      <EmptyState
        title="No relationship history yet"
        hint="Once suppliers are added and you start logging calls, quotes and quality conversations, every touchpoint lands here as a searchable timeline."
      />
    );
  }

  return (
    <div className="space-y-5">
      {toastNode}

      {/* Action */}
      <div className="flex justify-end">
        <PrimaryAction onClick={() => setLogOpen(true)}>+ Log communication</PrimaryAction>
      </div>

      {/* 1) Communication log */}
      <SectionCard
        title="Communication log"
        right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{history.length}</span> touchpoints</span>}
      >
        <DataTable
          columns={[
            { label: 'Date' },
            { label: 'Supplier' },
            { label: 'Contact' },
            { label: 'Channel' },
            { label: 'Summary' },
            { label: 'Follow-up' },
            { label: 'Owner' },
          ]}
          rows={logRows}
          empty="No communications logged yet."
        />
      </SectionCard>

      {/* 2) Notes board */}
      <SectionCard
        title="Notes board"
        right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{noteCards.length}</span> suppliers</span>}
      >
        {noteCards.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#8A8E86]">No supplier notes captured yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {noteCards.map(({ supplier, notes }) => (
              <div key={supplier.id} className="rounded-2xl border border-[#EAEDF2] bg-[#FBFCFE] p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openProfile(supplier.id)}
                    className="of-display text-left text-[15px] font-semibold text-[#171A17] transition-colors hover:text-[#1F5FA8]"
                  >
                    {supplier.name}
                  </button>
                  <span className="text-[12px] text-[#A0A49C]">{supplier.category}</span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {notes.map((n, i) => (
                    <li key={i} className="border-l-2 pl-3" style={{ borderColor: `${ACCENT}55` }}>
                      <p className="text-[13px] leading-snug" style={{ color: INK }}>
                        {n.body}
                      </p>
                      <p className="of-num mt-1 text-[12px]" style={{ color: FAINT }}>
                        {fmtDate(n.date)}
                        {n.author ? ` · ${n.author}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 3) Follow-ups */}
      <SectionCard
        title="Follow-ups"
        right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{followUps.length}</span> outstanding</span>}
      >
        {followUps.length === 0 ? (
          <p className="py-6 text-center text-[13px]" style={{ color: MUTE }}>
            No follow-ups outstanding.
          </p>
        ) : (
          <ul className="divide-y divide-[#EEF1F5]">
            {followUps.map((ev) => {
              const days = daysUntil(ev.followUpDate);
              const soon = days !== null && days <= 2; // due within 2 days or overdue
              const overdue = days !== null && days < 0;
              const dueColor = overdue ? RED : soon ? AMBER : MUTE;
              const dueLabel =
                ev.followUpDate === null
                  ? 'No date'
                  : days !== null && days < 0
                    ? `Overdue · ${fmtDate(ev.followUpDate)}`
                    : days === 0
                      ? `Due today · ${fmtDate(ev.followUpDate)}`
                      : `Due ${fmtDate(ev.followUpDate)}`;
              return (
                <li key={ev.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {ev.supplierId ? (
                        <SupplierNameButton
                          id={ev.supplierId}
                          name={ev.supplierName || 'Supplier'}
                          className="text-[14px] font-semibold"
                        />
                      ) : (
                        <span className="text-[14px] font-semibold text-[#171A17]">
                          {ev.supplierName || 'Supplier'}
                        </span>
                      )}
                      <ChannelPill channel={ev.channel} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#6B6F68]">{ev.followUp}</p>
                    <p className="of-num mt-1 text-[12px] font-medium" style={{ color: dueColor }}>
                      {dueLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => markFollowUpDone(ev)}
                    disabled={savingId === ev.id}
                    className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-60"
                  >
                    {savingId === ev.id ? 'Saving…' : 'Mark done'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <LogCommunicationModal open={logOpen} onClose={() => setLogOpen(false)} onLogged={show} />
    </div>
  );
}
