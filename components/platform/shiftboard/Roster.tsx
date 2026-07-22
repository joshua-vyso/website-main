'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { DAYS, type Shift } from '@/lib/platform/shiftboard';
import { ConflictBadge } from './shared';
import { useShiftBoard } from './context';

const MODAL_RADIUS = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export function Roster() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(DAYS[0]);
  const [dept, setDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sb.roster.rows.filter((r) => (dept === 'all' || r.department === dept) && (!q || `${r.name} ${r.role}`.toLowerCase().includes(q)));
  }, [sb.roster, dept, search]);

  const sel = 'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-3.5 text-[14px] text-[#3E4A57] outline-none focus:border-[#3E7BC4]';
  const dayIdx = DAYS.indexOf(day);

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Roster</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Plan shifts, spot conflicts and fill open slots</p>
        </div>
        <button type="button" onClick={() => setAiOpen(true)} className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">✦ Generate best roster</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-11 items-center gap-1 rounded-[12px] border border-[#E4E9F0] bg-white px-1.5">
          <button type="button" onClick={() => show('Previous week (demo)')} className="rounded-[8px] px-2 py-1 text-[14px] text-[#A0A49C] transition-colors hover:text-[#174C87]">‹</button>
          <span className="of-num px-1.5 text-[14px] font-medium text-[#171A17]">{sb.roster.label || 'This week'}</span>
          <button type="button" onClick={() => show('Next week (demo)')} className="rounded-[8px] px-2 py-1 text-[14px] text-[#A0A49C] transition-colors hover:text-[#174C87]">›</button>
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="all">All departments</option>{sb.departments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}</select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="h-11 min-w-[180px] flex-1 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]" />
        {view === 'day' ? (
          <select value={day} onChange={(e) => setDay(e.target.value)} className={sel}>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        ) : null}
        <div className="inline-flex h-11 items-center rounded-[12px] bg-[#F2F2EF] p-1">
          {(['week', 'day'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors ${view === v ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#171A17]'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Roster grid */}
      <SectionCard title={view === 'week' ? 'Weekly schedule' : `${day} schedule`}>
        {view === 'week' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  <th className="px-2 py-2 text-left font-medium">Staff</th>
                  {DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-[14px] text-[#8A8E86]">No staff match your filters.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employeeId} className="border-t border-[#EEF1F5] align-top">
                      <td className="px-2 py-2">
                        <div className="text-[13px] font-semibold text-[#171A17]">{r.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#A0A49C]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sb.deptColor(r.department) }} />{r.department}</div>
                      </td>
                      {r.days.map((sh, i) => (<td key={i} className="px-1 py-1.5"><ShiftCell s={sh} onClick={() => show(`Edit shift (demo)`)} /></td>))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          (() => {
            const dayRows = rows.filter((r) => r.days[dayIdx]?.status === 'scheduled');
            if (dayRows.length === 0) return <p className="py-8 text-center text-[14px] text-[#8A8E86]">No one scheduled for {day} in this view.</p>;
            return (
              <div className="flex flex-col gap-2">
                {dayRows.map((r) => {
                  const sh = r.days[dayIdx];
                  return (
                    <div key={r.employeeId} onClick={() => show('Edit shift (demo)')} className="flex cursor-pointer items-center justify-between rounded-[14px] border border-[#EEF1F5] bg-white px-3.5 py-2.5 transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(r.department) }} /><span className="text-[14px] font-semibold text-[#171A17]">{r.name}</span><span className="text-[12px] text-[#A0A49C]">{r.department}</span></span>
                      <span className="flex items-center gap-3">{sh.conflict ? <ConflictBadge conflict={sh.conflict} /> : null}<span className="of-num text-[13px] font-semibold text-[#171A17]">{sh.time}</span></span>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </SectionCard>

      {/* Open shifts */}
      <SectionCard title="Open shifts" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{sb.roster.openShifts.length}</span> unfilled</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sb.roster.openShifts.map((o, i) => (
            <div key={i} className="rounded-[14px] border border-dashed border-[#E2E6EC] bg-[#FBFCFE] p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A17]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(o.department) }} />{o.department}</div>
              <div className="mt-1 text-[12px] text-[#A0A49C]">{o.day} · <span className="of-num">{o.time}</span></div>
              <button type="button" onClick={() => show('Fill shift (demo)')} className="mt-2.5 inline-flex h-[34px] w-full items-center justify-center rounded-[10px] bg-[#1F5FA8] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]">Fill shift</button>
            </div>
          ))}
        </div>
      </SectionCard>

      <AiRosterModal open={aiOpen} onClose={() => setAiOpen(false)} onGenerate={() => { setAiOpen(false); show('Draft roster generated (demo)'); }} />
    </div>
  );
}

function ShiftCell({ s, onClick }: { s: Shift; onClick: () => void }) {
  if (s.status === 'off') return <div className="flex justify-center rounded-[8px] bg-[#EEF1F5] py-1.5 text-[11px] font-medium text-[#8A8E86]">Off</div>;
  if (s.status === 'leave') return <div className="flex justify-center rounded-[8px] bg-[#FBEEDA] py-1.5 text-[11px] font-medium text-[#854F0B]">Leave</div>;
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-[8px] border px-1.5 py-1 text-left transition-colors ${s.conflict ? 'border-[#F3C7C7] bg-[#FCF1F1]' : 'border-[#DCE8F7] bg-[#F5F9FE] hover:border-[#3E7BC4]'}`} title={s.department}>
      <div className="of-num text-[11px] font-semibold text-[#171A17]">{s.time}</div>
      {s.conflict ? <div className="mt-0.5"><ConflictBadge conflict={s.conflict} /></div> : <div className="mt-0.5 text-[10px] text-[#A0A49C]">{s.department}</div>}
    </button>
  );
}

const AI_INPUTS = ['Availability', 'Skills', 'Labour cost', 'Leave', 'Departments', 'Overtime', 'Expected workload'];

function AiRosterModal({ open, onClose, onGenerate }: { open: boolean; onClose: () => void; onGenerate: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_RADIUS}>
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[440px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display flex items-center gap-2 text-[18px] font-semibold text-[#171A17]">✦ Generate best roster</h2>
            <p className="mt-1 text-[13px] text-[#6B6F68]">AI scheduling will build a draft week for you to review.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[18px] text-[#A0A49C] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]">✕</button>
        </div>
        <div className="mt-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">It will balance</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AI_INPUTS.map((i) => (<span key={i} className="rounded-full border border-[#EEF1F5] bg-[#F5F9FE] px-2.5 py-1 text-[12px] text-[#6B6F68]">{i}</span>))}
          </div>
          <p className="mt-4 rounded-[12px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12px] text-[#6B6F68]">Coming soon. It will draft a conflict-free roster that minimises labour cost and overtime while keeping every department covered — then you approve or tweak it.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Cancel</button>
          <button type="button" onClick={onGenerate} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">Generate draft</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
