'use client';

import Link from 'next/link';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, Kpi, SectionCard, DataTable } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { zar } from '@/lib/platform/orderflow';
import {
  EMPLOYEES,
  ROSTER,
  DAYS,
  DEPARTMENT_COLOR,
  departmentSnapshots,
  overviewStats,
  OPERATIONAL_ALERTS,
  type Shift,
} from '@/lib/platform/shiftboard';
import { DeptBadge, StatusBadge, CoverageBadge, MobileSnapshotCards } from './shared';

const M = MODULE_META.shiftboard;

function cellTone(s: Shift) {
  if (s.status === 'off') return { bg: '#F0F0EC', fg: '#9A9DA1' };
  if (s.status === 'leave') return { bg: '#FBEEDA', fg: '#854F0B' };
  return { bg: '#E3F0ED', fg: '#1E5E54' };
}

export function ShiftBoardOverview() {
  const { node, show } = useToast();
  const s = overviewStats();
  const snapshots = departmentSnapshots();

  return (
    <div className="space-y-5">
      {node}
      <ModuleHeader icon={M.icon} title={M.name} description="Who's working, where, on what — and whether you're properly staffed today." actions={<PrimaryAction onClick={() => show('Create shift (demo)')}>+ Create shift</PrimaryAction>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Staff on shift today" value={String(s.rostered)} sub="rostered" />
        <Kpi label="Currently working" value={String(s.working)} accent="#0F6E56" sub="clocked in" />
        <Kpi label="Open shifts" value={String(s.openShifts)} accent="#854F0B" sub="this week" />
        <Kpi label="Labour cost today" value={zar(s.labourCost)} sub="projected" />
        <Kpi label="Overtime risk" value={String(s.overtimeRisk)} accent={s.overtimeRisk > 0 ? '#854F0B' : undefined} sub="over contracted" />
        <Kpi label="Attendance issues" value={String(s.attendanceIssues)} accent={s.attendanceIssues > 0 ? '#A32D2D' : undefined} sub="late or absent" />
      </div>

      {/* Weekly roster */}
      <SectionCard title="Weekly roster" right={<span className="text-[12px] text-[#9A9DA1]">{ROSTER.label}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-2 py-2 text-left font-medium">Staff</th>
                {DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
              </tr>
            </thead>
            <tbody>
              {ROSTER.rows.map((r) => (
                <tr key={r.employeeId} className="border-t border-[#F0F0EC]">
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-[#1A1C1E]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DEPARTMENT_COLOR[r.department] }} />{r.name}</span>
                  </td>
                  {r.days.map((sh, i) => {
                    const t = cellTone(sh);
                    return (
                      <td key={i} className="px-1.5 py-2 text-center">
                        <span className="inline-flex w-full justify-center rounded-md px-1.5 py-1 text-[11px] font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{sh.status === 'off' ? 'Off' : sh.status === 'leave' ? 'Leave' : sh.time}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <SectionCard title="Staff">
          <DataTable
            columns={[{ label: 'Name' }, { label: 'Department' }, { label: 'Status' }, { label: 'Next shift' }, { label: 'Hours / wk', align: 'right' }]}
            rows={EMPLOYEES.map((e) => [
              <span key="n" className="font-medium text-[#1A1C1E]">{e.name}<span className="ml-1.5 text-[12px] font-normal text-[#9A9DA1]">{e.role}</span></span>,
              <DeptBadge key="d" department={e.department} />,
              <StatusBadge key="s" status={e.status} />,
              e.nextShift,
              String(e.hoursThisWeek),
            ])}
            empty="No staff yet."
          />
        </SectionCard>

        <div className="space-y-5">
          {/* Today's staffing snapshot */}
          <SectionCard title="Today's staffing snapshot">
            <div className="flex flex-col gap-2">
              {snapshots.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-[#1A1C1E]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] tabular-nums text-[#5F6368]">{d.working}/{d.required}</span>
                    <CoverageBadge status={d.status} />
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Operational alerts */}
          <SectionCard title="Operational alerts">
            <div className="flex flex-col gap-3">
              {OPERATIONAL_ALERTS.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a.tone === 'critical' ? '#A32D2D' : a.tone === 'warning' ? '#854F0B' : '#0C447C' }} />
                  <span className="min-w-0 flex-1 text-[#1A1C1E]">{a.text}</span>
                  {a.module ? (
                    <Link href={MODULE_META[a.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[a.module].accent.bg, color: MODULE_META[a.module].accent.fg }}>{MODULE_META[a.module].name} →</Link>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <MobileSnapshotCards onAction={(l) => show(`${l} (demo)`)} />
    </div>
  );
}
