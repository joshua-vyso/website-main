'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/platform/orderflow/ui';
import { Kpi, Badge } from '@/components/platform/module-ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { LEAVE_TYPE_TONE, type LeaveRequest, type LeaveStatus } from '@/lib/platform/shiftboard';
import { DeptBadge } from './shared';
import { useShiftBoard } from './context';

const MODAL_RADIUS = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export function LeaveWorkspace() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const { org } = usePlatform();
  // Optimistic overrides so the card flips immediately; the DB write + refresh follow.
  const [overrides, setOverrides] = useState<Record<string, LeaveStatus>>({});
  const [confirm, setConfirm] = useState<LeaveRequest | null>(null);

  const requests = useMemo(() => sb.leave.map((r) => ({ ...r, status: overrides[r.id] ?? r.status })), [sb.leave, overrides]);

  const pending = requests.filter((r) => r.status === 'Pending').length;
  const approvedThisMonth = requests.filter((r) => r.status === 'Approved').length;
  const sickDays = sb.leave.filter((r) => r.type === 'Sick leave').reduce((s, r) => s + r.days, 0);
  const annualDays = sb.leave.filter((r) => r.type === 'Annual leave').reduce((s, r) => s + r.days, 0);
  const coverageRisk = requests.filter((r) => r.status === 'Pending' && r.coverageRisk === 'high').length;

  async function setStatus(r: LeaveRequest, status: LeaveStatus) {
    setOverrides((o) => ({ ...o, [r.id]: status })); // optimistic
    show(status === 'Approved' ? 'Leave approved' : 'Leave declined');
    const supabase = createClient();
    if (!supabase || !org) return;
    const { error } = await supabase.from('sb_leave_requests').update({ status }).eq('id', r.id);
    if (error) {
      setOverrides((o) => { const { [r.id]: _drop, ...rest } = o; return rest; }); // revert
      show(`Couldn't save: ${error.message}`);
      return;
    }
    router.refresh();
  }

  function approve(r: LeaveRequest) {
    if (r.coverageRisk === 'high') {
      setConfirm(r);
      return;
    }
    void setStatus(r, 'Approved');
  }
  function decline(r: LeaveRequest) {
    void setStatus(r, 'Declined');
  }

  return (
    <div className="space-y-5">
      {node}
      <div>
        <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">Leave</h1>
        <p className="mt-0.5 text-[14px] text-[#5F6368]">Requests, balances and the coverage impact of time off</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Pending requests" value={String(pending)} accent={pending > 0 ? '#854F0B' : undefined} />
        <Kpi label="Approved this month" value={String(approvedThisMonth)} accent="#0F6E56" />
        <Kpi label="Sick leave (days)" value={String(sickDays)} />
        <Kpi label="Annual leave (days)" value={String(annualDays)} />
        <Kpi label="Coverage risk" value={String(coverageRisk)} accent={coverageRisk > 0 ? '#A32D2D' : undefined} sub="high-impact" />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-10 text-center text-[13px] text-[#5F6368]">No leave requests right now.</div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold text-[#1A1C1E]">{r.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#9A9DA1]"><DeptBadge department={r.department} /></div>
              </div>
              <Badge label={r.type} tone={LEAVE_TYPE_TONE[r.type]} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[#5F6368]">
              <span className="tabular-nums">{r.start}{r.end !== r.start ? ` – ${r.end}` : ''}</span>
              <span className="text-[#C4C7CA]">·</span>
              <span>{r.days} day{r.days > 1 ? 's' : ''}</span>
            </div>
            <div className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: r.coverageRisk === 'high' ? '#FCEBEB' : r.coverageRisk === 'low' ? '#FBF5E9' : '#F4F7F5', color: r.coverageRisk === 'high' ? '#A32D2D' : r.coverageRisk === 'low' ? '#854F0B' : '#0F6E56' }}>
              <span className="mt-0.5 text-[10px]">{r.coverageRisk === 'none' ? '✓' : '▲'}</span>
              <span>{r.coverageImpact}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {r.status === 'Pending' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => approve(r)} className="rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#184D45]">Approve</button>
                  <button type="button" onClick={() => decline(r)} className="rounded-lg border border-[#D7DAD8] px-3 py-1.5 text-[12px] font-medium text-[#5F6368] hover:border-[#1E5E54]/40">Decline</button>
                </div>
              ) : (
                <span className="text-[12px] text-[#9A9DA1]">No actions</span>
              )}
              <Badge label={r.status} tone={r.status === 'Approved' ? 'positive' : r.status === 'Declined' ? 'critical' : 'warning'} />
            </div>
          </div>
        ))}
      </div>

      <CoverageWarningModal
        request={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void setStatus(confirm, 'Approved');
          setConfirm(null);
        }}
      />
    </div>
  );
}

function CoverageWarningModal({ request, onClose, onConfirm }: { request: LeaveRequest | null; onClose: () => void; onConfirm: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onClose]);
  if (!mounted || !request) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_RADIUS}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[420px] rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCEBEB] text-[#A32D2D]">▲</span>
          <h2 className="text-[16px] font-semibold text-[#1A1C1E]">Coverage warning</h2>
        </div>
        <p className="mt-3 text-[14px] text-[#1A1C1E]">{request.coverageImpact}</p>
        <p className="mt-2 text-[13px] text-[#5F6368]">Approving {request.name}&rsquo;s {request.type.toLowerCase()} will reduce {request.department} cover. Make sure you can fill the gap before confirming.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-[#A32D2D] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#8a2626]">Approve anyway</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
