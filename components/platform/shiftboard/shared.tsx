'use client';

import { ModuleWidgetCard } from '@/components/platform/module-ui';
import { widgetsFor, type ModuleWidget } from '@/lib/platform/module-widgets';
import {
  EMPLOYEE_STATUS_STYLE,
  COVERAGE_STYLE,
  ATTENDANCE_STYLE,
  overviewStats,
  departmentSnapshots,
  type DepartmentName,
  type EmployeeStatus,
  type CoverageStatus,
  type AttendanceStatus,
  type ShiftConflict,
} from '@/lib/platform/shiftboard';
import { useShiftBoard } from './context';

export function DeptBadge({ department }: { department: DepartmentName }) {
  const { deptColor } = useShiftBoard();
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[#5F6368]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: deptColor(department) }} />
      {department}
    </span>
  );
}

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  const s = EMPLOYEE_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Working' ? 'animate-pulse' : ''}`} style={{ backgroundColor: s.fg }} />
      {status}
    </span>
  );
}

export function CoverageBadge({ status }: { status: CoverageStatus }) {
  const s = COVERAGE_STYLE[status];
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>;
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const s = ATTENDANCE_STYLE[status];
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{status}</span>;
}

export function ConflictBadge({ conflict }: { conflict: ShiftConflict }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FCEBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#A32D2D]" title={conflict}>
      <span className="text-[9px]">▲</span>
      {conflict}
    </span>
  );
}

/** Simple 0–5 skill rating as filled dots. */
export function SkillStars({ rating, color = '#1E5E54' }: { rating: number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: i < rating ? color : '#E7E7E2' }} />
      ))}
    </span>
  );
}

export function MobileSnapshotCards({ onAction }: { onAction?: (label: string) => void }) {
  const sb = useShiftBoard();
  // Override the static registry values with the org's live numbers so the
  // companion-app preview matches the page KPIs.
  const stats = overviewStats(sb);
  const snaps = departmentSnapshots(sb.employees, sb.departments);
  const worstShort = snaps.filter((s) => s.status === 'short').sort((a, b) => b.required - b.working - (a.required - a.working))[0];
  const pendingLeave = sb.leave.filter((l) => l.status === 'Pending').length;
  const override: Record<string, Partial<ModuleWidget>> = {
    'shift-working': { value: String(stats.working), subtitle: `of ${stats.rostered} rostered` },
    'shift-open': { value: String(stats.openShifts) },
    'shift-ot': { value: String(stats.overtimeRisk) },
    'shift-attendance': { value: String(stats.attendanceIssues) },
    'shift-dispatch': worstShort
      ? { title: `${worstShort.name} short today`, value: `−${worstShort.required - worstShort.working}`, subtitle: `${worstShort.working} of ${worstShort.required}` }
      : { title: 'Departments', value: 'Covered', subtitle: 'all on target' },
    'shift-leave': { value: String(pendingLeave) },
  };
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {widgetsFor('shiftboard').map((w) => (
          <ModuleWidgetCard key={w.id} widget={{ ...w, ...override[w.id] }} onAction={(widget) => onAction?.(widget.actionLabel ?? widget.title)} />
        ))}
      </div>
    </div>
  );
}
