'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { ROSTER, DAYS, DEPARTMENTS, DEPARTMENT_COLOR, type Shift, type DepartmentName } from '@/lib/platform/shiftboard';
import { ConflictBadge } from './shared';

const MODAL_RADIUS = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export function Roster() {
  const { node, show } = useToast();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(DAYS[0]);
  const [dept, setDept] = useState<'all' | DepartmentName>('all');
  const [search, setSearch] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ROSTER.rows.filter((r) => (dept === 'all' || r.department === dept) && (!q || `${r.name} ${r.role}`.toLowerCase().includes(q)));
  }, [dept, search]);

  const sel = 'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#1E5E54]';
  const dayIdx = DAYS.indexOf(day);

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">Roster</h1>
          <p className="mt-0.5 text-[14px] text-[#5F6368]">Plan shifts, spot conflicts and fill open slots</p>
        </div>
        <button type="button" onClick={() => setAiOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]">✦ Generate best roster</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#D7DAD8] bg-white px-1 py-0.5">
          <button type="button" onClick={() => show('Previous week (demo)')} className="rounded-md px-2 py-1 text-[13px] text-[#9A9DA1] hover:text-[#1A1C1E]">‹</button>
          <span className="px-1 text-[13px] font-medium text-[#1A1C1E]">{ROSTER.label}</span>
          <button type="button" onClick={() => show('Next week (demo)')} className="rounded-md px-2 py-1 text-[13px] text-[#9A9DA1] hover:text-[#1A1C1E]">›</button>
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value as 'all' | DepartmentName)} className={sel}><option value="all">All departments</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="h-9 min-w-[180px] flex-1 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#1E5E54]" />
        {view === 'day' ? (
          <select value={day} onChange={(e) => setDay(e.target.value)} className={sel}>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        ) : null}
        <div className="inline-flex rounded-lg bg-[#F2F2EF] p-0.5">
          {(['week', 'day'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-[7px] px-3 py-1 text-[12px] font-medium capitalize transition-colors ${view === v ? 'bg-white text-[#1A1C1E] shadow-sm' : 'text-[#9A9DA1]'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Roster grid */}
      <SectionCard title={view === 'week' ? 'Weekly schedule' : `${day} schedule`}>
        {view === 'week' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                  <th className="px-2 py-2 text-left font-medium">Staff</th>
                  {DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-[13px] text-[#9A9DA1]">No staff match your filters.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employeeId} className="border-t border-[#F0F0EC] align-top">
                      <td className="px-2 py-2">
                        <div className="text-[13px] font-medium text-[#1A1C1E]">{r.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#9A9DA1]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DEPARTMENT_COLOR[r.department] }} />{r.department}</div>
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
            const dayRows = rows.filter((r) => r.days[dayIdx].status === 'scheduled');
            if (dayRows.length === 0) return <p className="py-8 text-center text-[13px] text-[#9A9DA1]">No one scheduled for {day} in this view.</p>;
            return (
              <div className="flex flex-col gap-2">
                {dayRows.map((r) => {
                  const sh = r.days[dayIdx];
                  return (
                    <div key={r.employeeId} onClick={() => show('Edit shift (demo)')} className="flex cursor-pointer items-center justify-between rounded-xl border border-[#F0F0EC] bg-white px-3.5 py-2.5 hover:border-[#1E5E54]/30">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLOR[r.department] }} /><span className="text-[14px] font-medium text-[#1A1C1E]">{r.name}</span><span className="text-[12px] text-[#9A9DA1]">{r.department}</span></span>
                      <span className="flex items-center gap-3">{sh.conflict ? <ConflictBadge conflict={sh.conflict} /> : null}<span className="text-[13px] font-medium tabular-nums text-[#1A1C1E]">{sh.time}</span></span>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </SectionCard>

      {/* Open shifts */}
      <SectionCard title="Open shifts" right={<span className="text-[12px] text-[#9A9DA1]">{ROSTER.openShifts.length} unfilled</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROSTER.openShifts.map((o, i) => (
            <div key={i} className="rounded-xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#1A1C1E]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLOR[o.department] }} />{o.department}</div>
              <div className="mt-1 text-[12px] text-[#9A9DA1]">{o.day} · {o.time}</div>
              <button type="button" onClick={() => show('Fill shift (demo)')} className="mt-2.5 w-full rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#184D45]">Fill shift</button>
            </div>
          ))}
        </div>
      </SectionCard>

      <AiRosterModal open={aiOpen} onClose={() => setAiOpen(false)} onGenerate={() => { setAiOpen(false); show('Draft roster generated (demo)'); }} />
    </div>
  );
}

function ShiftCell({ s, onClick }: { s: Shift; onClick: () => void }) {
  if (s.status === 'off') return <div className="flex justify-center rounded-md bg-[#F0F0EC] py-1.5 text-[11px] font-medium text-[#9A9DA1]">Off</div>;
  if (s.status === 'leave') return <div className="flex justify-center rounded-md bg-[#FBEEDA] py-1.5 text-[11px] font-medium text-[#854F0B]">Leave</div>;
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-md border px-1.5 py-1 text-left transition-colors ${s.conflict ? 'border-[#F3C7C7] bg-[#FCF1F1]' : 'border-[#DCEAE5] bg-[#F3F8F6] hover:border-[#1E5E54]/40'}`} title={s.department}>
      <div className="text-[11px] font-semibold text-[#1A1C1E]">{s.time}</div>
      {s.conflict ? <div className="mt-0.5"><ConflictBadge conflict={s.conflict} /></div> : <div className="mt-0.5 text-[10px] text-[#9A9DA1]">{s.department}</div>}
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
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[440px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#1A1C1E]">✦ Generate best roster</h2>
            <p className="mt-0.5 text-[13px] text-[#5F6368]">AI scheduling will build a draft week for you to review.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>
        <div className="mt-4">
          <div className="text-[12px] font-medium text-[#9A9DA1]">It will balance</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AI_INPUTS.map((i) => (<span key={i} className="rounded-full border border-[#E7E7E2] bg-[#FAFAF8] px-2.5 py-1 text-[12px] text-[#5F6368]">{i}</span>))}
          </div>
          <p className="mt-4 rounded-lg bg-[#F6FAF8] px-3 py-2 text-[12px] text-[#5F6368]">Coming soon. It will draft a conflict-free roster that minimises labour cost and overtime while keeping every department covered — then you approve or tweak it.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
          <button type="button" onClick={onGenerate} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">Generate draft</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
