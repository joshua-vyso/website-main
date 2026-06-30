'use client';

import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { Kpi } from '@/components/platform/module-ui';
import { ATTENDANCE, EMPLOYEES } from '@/lib/platform/shiftboard';
import { AttendanceBadge, DeptBadge } from './shared';

export function Attendance() {
  const { node, show } = useToast();

  const clockedIn = ATTENDANCE.filter((a) => a.clockIn != null).length;
  const late = ATTENDANCE.filter((a) => a.status === 'Late').length;
  const absent = ATTENDANCE.filter((a) => a.status === 'Absent').length;
  // Overtime accrued this week (hours over contract) — the daily snapshot is mid-shift.
  const overtime = EMPLOYEES.reduce((s, e) => s + Math.max(0, e.hoursThisWeek - e.contractedHours), 0);
  const pending = ATTENDANCE.filter((a) => a.status === 'Manual review').length + 3;

  return (
    <div className="space-y-5">
      {node}
      <div>
        <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">Attendance</h1>
        <p className="mt-0.5 text-[14px] text-[#5F6368]">Clock-ins, hours worked and timesheet approvals</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Clocked in" value={String(clockedIn)} accent="#0F6E56" />
        <Kpi label="Late today" value={String(late)} accent={late > 0 ? '#854F0B' : undefined} />
        <Kpi label="Absent today" value={String(absent)} accent={absent > 0 ? '#A32D2D' : undefined} />
        <Kpi label="Overtime hours" value={`${overtime.toFixed(1)}`} accent="#5B53C0" sub="this week" />
        <Kpi label="Pending timesheets" value={String(pending)} accent={pending > 0 ? '#854F0B' : undefined} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                {['Employee', 'Department', 'Scheduled', 'Clock in', 'Clock out', 'Hours', 'Overtime', 'Status', ''].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium ${h === 'Hours' || h === 'Overtime' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTENDANCE.map((a) => (
                <tr key={a.employeeId} className="border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                  <td className="px-3 py-3 font-medium text-[#1A1C1E]">{a.name}</td>
                  <td className="px-3 py-3"><DeptBadge department={a.department} /></td>
                  <td className="px-3 py-3 tabular-nums text-[#5F6368]">{a.scheduled}</td>
                  <td className="px-3 py-3 tabular-nums" style={{ color: a.status === 'Late' ? '#854F0B' : '#5F6368' }}>{a.clockIn ?? '—'}</td>
                  <td className="px-3 py-3 tabular-nums text-[#9A9DA1]">{a.clockOut ?? 'On shift'}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#5F6368]">{a.hoursWorked.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right tabular-nums" style={{ color: a.overtime > 0 ? '#5B53C0' : '#9A9DA1' }}>{a.overtime > 0 ? `+${a.overtime.toFixed(1)}` : '—'}</td>
                  <td className="px-3 py-3"><AttendanceBadge status={a.status} /></td>
                  <td className="px-3 py-3 text-right">
                    <RowActionsMenu actions={[
                      { label: 'Adjust time', onClick: () => show('Adjust time (demo)') },
                      { label: 'Mark absent', onClick: () => show('Marked absent (demo)') },
                      { label: 'Approve timesheet', onClick: () => show('Timesheet approved (demo)') },
                      { label: 'View history', onClick: () => show('Attendance history (demo)') },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
