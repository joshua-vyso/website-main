/**
 * ShiftBoard data access — fetches the org's people data from Supabase
 * (sb_departments, sb_employees, sb_roster_shifts, sb_attendance,
 * sb_leave_requests) and maps the rows to the TS shapes the views render.
 * Org-scoped by RLS; an org with no rows returns empty collections so unseeded
 * accounts render clean empty states.
 */

import { createServerSupabase } from './supabase-server';
import {
  SKILL_NAMES,
  type ShiftBoardData,
  type Employee,
  type DepartmentInfo,
  type EmployeeStatus,
  type RosterRow,
  type RosterWeek,
  type Shift,
  type OpenShift,
  type AttendanceRecord,
  type AttendanceStatus,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
} from './shiftboard';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function strArr(v: any): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
/** sb_employees.skills jsonb { "Receiving": 0..5, ... } → number[] in SKILL_NAMES order. */
function skillsArray(obj: any): number[] {
  if (!obj || typeof obj !== 'object') return SKILL_NAMES.map(() => 0);
  return SKILL_NAMES.map((s) => num((obj as Record<string, unknown>)[s]));
}

export async function getShiftBoardData(orgId: string): Promise<ShiftBoardData> {
  const sb = await createServerSupabase();
  const [dep, emp, ros, att, lev] = await Promise.all([
    sb.from('sb_departments').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_employees').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_roster_shifts').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_attendance').select('*').eq('org_id', orgId).order('department'),
    sb.from('sb_leave_requests').select('*').eq('org_id', orgId).order('start_date'),
  ]);

  const departments: DepartmentInfo[] = ((dep.data as any[]) ?? []).map((r) => ({ name: r.name, required: num(r.required), color: r.color ?? '#5F6368' }));

  const employees: Employee[] = ((emp.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role ?? '',
    department: r.department ?? '',
    status: (r.status as EmployeeStatus) ?? 'Scheduled',
    nextShift: r.next_shift ?? '',
    shiftTime: r.shift_time ?? '',
    hoursThisWeek: num(r.hours_this_week),
    contractedHours: num(r.contracted_hours),
    rate: num(r.rate),
    attendanceScore: num(r.attendance_score),
    leaveBalance: num(r.leave_balance),
    skills: skillsArray(r.skills),
    availableDays: strArr(r.available_days),
    unavailableDays: strArr(r.unavailable_days),
    preferredShifts: r.preferred_shifts ?? '',
    devices: strArr(r.devices),
    currentDepartment: r.current_department ?? undefined,
    currentTask: r.current_task ?? undefined,
    currentRecipe: r.current_recipe ?? undefined,
    assignedDevice: r.assigned_device ?? undefined,
  }));

  const rosterRows: RosterRow[] = ((ros.data as any[]) ?? []).map((r) => ({
    employeeId: r.employee_id ?? '',
    name: r.name,
    role: r.role ?? '',
    department: r.department ?? '',
    days: Array.isArray(r.days) ? (r.days as Shift[]) : [],
  }));
  const firstRoster = ((ros.data as any[]) ?? [])[0];
  const roster: RosterWeek = {
    label: firstRoster?.label ?? '',
    rows: rosterRows,
    openShifts: Array.isArray(firstRoster?.open_shifts) ? (firstRoster.open_shifts as OpenShift[]) : [],
  };

  const attendance: AttendanceRecord[] = ((att.data as any[]) ?? []).map((r) => ({
    id: r.id,
    employeeId: r.employee_id ?? '',
    name: r.name,
    department: r.department ?? '',
    scheduled: r.scheduled ?? '',
    clockIn: r.clock_in ?? null,
    clockOut: r.clock_out ?? null,
    hoursWorked: num(r.hours_worked),
    status: (r.status as AttendanceStatus) ?? 'On time',
    overtime: num(r.overtime),
  }));

  const leave: LeaveRequest[] = ((lev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    employeeId: r.employee_id ?? '',
    name: r.name,
    department: r.department ?? '',
    type: (r.type as LeaveType) ?? 'Annual leave',
    start: r.start_label ?? '',
    end: r.end_label ?? '',
    days: num(r.days),
    coverageImpact: r.coverage_impact ?? '',
    coverageRisk: (r.coverage_risk as LeaveRequest['coverageRisk']) ?? 'none',
    status: (r.status as LeaveStatus) ?? 'Pending',
  }));

  return { employees, departments, roster, attendance, leave };
}
