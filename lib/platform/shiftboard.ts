/**
 * ShiftBoard — people operations command centre. Types, style maps, derived
 * helpers and illustrative constants. The org's people data (employees,
 * departments, roster, attendance, leave) is fetched per-org from Supabase in
 * `shiftboard-data.ts` and provided to the views; the helpers here operate on
 * that data. Departments are org-defined (from sb_departments), so DepartmentName
 * is a free string and colours come from the DB rows (with a fallback palette).
 */

import type { VysoModuleKey } from './module-meta';

/** Org-defined department label (from sb_departments). */
export type DepartmentName = string;
export type EmployeeStatus = 'Working' | 'On break' | 'Scheduled' | 'Off' | 'On leave' | 'Absent';
export type SkillName = 'Receiving' | 'Dispatch' | 'Prep Kitchen' | 'Driving' | 'Customer Service' | 'Stock Handling' | 'Device Operation';
export type CoverageStatus = 'covered' | 'short' | 'overstaffed';

export const SKILL_NAMES: SkillName[] = ['Receiving', 'Dispatch', 'Prep Kitchen', 'Driving', 'Customer Service', 'Stock Handling', 'Device Operation'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Fallback colours for departments not carrying their own colour. */
const FALLBACK_PALETTE = ['#0F6E56', '#0C447C', '#D9730D', '#5B53C0', '#2C7A8A', '#854F0B', '#6B6F68', '#A32D2D', '#2E7D67', '#3A4DB0'];

/** Resolve a department's colour: the DB row's colour, else a stable fallback. */
export function deptColor(name: string, departments?: DepartmentInfo[]): string {
  const d = departments?.find((x) => x.name === name);
  if (d?.color) return d.color;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

export const EMPLOYEE_STATUS_STYLE: Record<EmployeeStatus, { bg: string; fg: string }> = {
  Working: { bg: '#E1F5EE', fg: '#0F6E56' },
  'On break': { bg: '#FBEFDD', fg: '#9A6314' },
  Scheduled: { bg: '#E6F1FB', fg: '#0C447C' },
  Off: { bg: '#EEF1F5', fg: '#8A8E86' },
  'On leave': { bg: '#FBEEDA', fg: '#854F0B' },
  Absent: { bg: '#FCEBEB', fg: '#A32D2D' },
};

export const COVERAGE_STYLE: Record<CoverageStatus, { bg: string; fg: string; label: string }> = {
  covered: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Covered' },
  short: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Short' },
  overstaffed: { bg: '#E6F1FB', fg: '#0C447C', label: 'Overstaffed' },
};

export function coverageStatus(working: number, required: number): CoverageStatus {
  if (working < required) return 'short';
  if (working > required) return 'overstaffed';
  return 'covered';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillRating {
  skill: SkillName;
  rating: number; // 0–5
}

export interface EmployeeDeviceAssignment {
  device: string;
  department: DepartmentName;
  task?: string;
  recipe?: string;
  at: string;
}

export interface ActivityEvent {
  time: string;
  label: string;
  kind: 'clock' | 'assign' | 'recipe' | 'device' | 'break' | 'task';
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: DepartmentName;
  status: EmployeeStatus;
  nextShift: string;
  /** Current/next shift window. */
  shiftTime: string;
  hoursThisWeek: number;
  contractedHours: number;
  rate: number; // R / hour
  attendanceScore: number; // 0–100
  leaveBalance: number; // days
  /** 7 ratings (0–5) indexed by SKILL_NAMES. */
  skills: number[];
  availableDays: string[];
  unavailableDays: string[];
  preferredShifts: string;
  /** Recent WasteWatch device assignments (names) — drawer "Assigned devices". */
  devices: string[];
  // Live-ops / WasteWatch device foundation (populated when working):
  currentDepartment?: DepartmentName;
  currentTask?: string;
  currentRecipe?: string;
  assignedDevice?: string;
}

/** A department as defined for the org (sb_departments). */
export interface DepartmentInfo {
  name: DepartmentName;
  required: number;
  color: string;
}

export type ShiftStatus = 'scheduled' | 'open' | 'off' | 'leave';
export type ShiftConflict = 'Overtime risk' | 'Leave conflict' | 'Department short' | 'Double booked';

export interface Shift {
  time: string; // '08–16' or '' for off/leave
  department?: DepartmentName;
  status: ShiftStatus;
  conflict?: ShiftConflict;
}

export interface RosterRow {
  employeeId: string;
  name: string;
  role: string;
  department: DepartmentName;
  days: Shift[]; // 7
}

export interface OpenShift {
  day: string;
  department: DepartmentName;
  time: string;
}

export interface RosterWeek {
  label: string;
  rows: RosterRow[];
  openShifts: OpenShift[];
}

export type AttendanceStatus = 'On time' | 'Late' | 'Absent' | 'Early leave' | 'Overtime' | 'Manual review';

export const ATTENDANCE_STYLE: Record<AttendanceStatus, { bg: string; fg: string }> = {
  'On time': { bg: '#E1F5EE', fg: '#0F6E56' },
  Late: { bg: '#FBEFDD', fg: '#9A6314' },
  Absent: { bg: '#FCEBEB', fg: '#A32D2D' },
  'Early leave': { bg: '#FBEEDA', fg: '#854F0B' },
  Overtime: { bg: '#EAE7FB', fg: '#5B53C0' },
  'Manual review': { bg: '#EEF1F5', fg: '#6B6F68' },
};

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  department: DepartmentName;
  scheduled: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number;
  status: AttendanceStatus;
  overtime: number; // hours
}

export type LeaveType = 'Annual leave' | 'Sick leave' | 'Family responsibility' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Declined';

export const LEAVE_TYPE_TONE: Record<LeaveType, 'neutral' | 'positive' | 'warning' | 'critical' | 'info'> = {
  'Annual leave': 'info',
  'Sick leave': 'warning',
  'Family responsibility': 'neutral',
  Unpaid: 'neutral',
};

export interface LeaveRequest {
  id: string;
  employeeId: string;
  name: string;
  department: DepartmentName;
  type: LeaveType;
  start: string;
  end: string;
  days: number;
  coverageImpact: string;
  coverageRisk: 'none' | 'low' | 'high';
  status: LeaveStatus;
}

/** The full per-org ShiftBoard payload (fetched in shiftboard-data.ts). */
export interface ShiftBoardData {
  employees: Employee[];
  departments: DepartmentInfo[];
  roster: RosterWeek;
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
}

// ---------------------------------------------------------------------------
// Derived helpers (operate on fetched data)
// ---------------------------------------------------------------------------

/** People physically present in a department right now (working or on break). */
export function presentInDepartment(employees: Employee[], d: DepartmentName): Employee[] {
  return employees.filter((e) => e.currentDepartment === d && (e.status === 'Working' || e.status === 'On break'));
}

export interface DepartmentSnapshot {
  name: DepartmentName;
  color: string;
  required: number;
  working: number;
  status: CoverageStatus;
  staff: Employee[];
}

export function departmentSnapshots(employees: Employee[], departments: DepartmentInfo[]): DepartmentSnapshot[] {
  return departments.map((d) => {
    const staff = presentInDepartment(employees, d.name);
    return { name: d.name, color: d.color, required: d.required, working: staff.length, status: coverageStatus(staff.length, d.required), staff };
  });
}

/** Live device→user→department→recipe links — the WasteWatch foundation. */
export function liveDeviceAssignments(employees: Employee[]): (EmployeeDeviceAssignment & { employee: string })[] {
  return employees.filter((e) => e.assignedDevice).map((e) => ({ device: e.assignedDevice!, department: e.currentDepartment ?? e.department, task: e.currentTask, recipe: e.currentRecipe, at: e.shiftTime, employee: e.name }));
}

export const LABOUR_COST_TODAY = 8450;

export function overviewStats(data: ShiftBoardData) {
  const { employees, attendance, roster } = data;
  const working = employees.filter((e) => e.status === 'Working').length;
  const rostered = employees.filter((e) => e.status !== 'Off' && e.status !== 'On leave').length;
  const overtimeRisk = employees.filter((e) => e.hoursThisWeek > e.contractedHours).length;
  const attendanceIssues = attendance.filter((a) => a.status === 'Late' || a.status === 'Absent').length;
  const openShifts = roster.openShifts.length;
  const labourCost = Math.round(employees.filter((e) => e.status === 'Working' || e.status === 'On break').reduce((s, e) => s + e.rate * 8, 0)) || LABOUR_COST_TODAY;
  return { working, rostered, overtimeRisk, attendanceIssues, openShifts, labourCost };
}

// ---------------------------------------------------------------------------
// Illustrative constants (module narrative — not per-org data yet)
// ---------------------------------------------------------------------------

export interface LabourInsight {
  id: string;
  text: string;
  module?: VysoModuleKey;
}

export const LABOUR_INSIGHTS: LabourInsight[] = [
  { id: 'li1', text: 'Breakfast prep waste is highest when only 2 prep staff are scheduled — keep 3 on early mornings.', module: 'wastewatch' },
  { id: 'li2', text: 'Large receiving day tomorrow (4 deliveries) — add one receiving clerk from 07:00.', module: 'procurepulse' },
  { id: 'li3', text: 'Delivery volume is 18% higher on Fridays — schedule another driver.', module: 'orderflow' },
  { id: 'li4', text: 'Labour cost is tracking 7% above plan this month.', module: 'insightgen' },
  { id: 'li5', text: 'Dispatch is consistently short on weekday afternoons — recurring open shift.' },
  { id: 'li6', text: 'Overtime is concentrated in prep & packing — rebalance the late shift.' },
];

export const LABOUR_COST_TREND = [7800, 8200, 7900, 8600, 8450, 8100, 7700];
export const OVERTIME_TREND = [4, 6, 5, 8, 7, 9, 6];
export const ATTENDANCE_TREND = { lateArrivals: [2, 1, 3, 1, 2, 1, 0], absences: [0, 1, 0, 1, 1, 0, 0] };

export interface OperationalAlert {
  id: string;
  text: string;
  tone: 'warning' | 'critical' | 'info';
  module?: VysoModuleKey;
}

/** Derive a few operational alerts from the live data (falls back to none). */
export function operationalAlerts(data: ShiftBoardData): OperationalAlert[] {
  const dynamic: OperationalAlert[] = [];
  const snaps = departmentSnapshots(data.employees, data.departments);
  for (const s of snaps.filter((x) => x.status === 'short')) {
    dynamic.push({ id: `short-${s.name}`, text: `${s.name} is understaffed — ${s.working} of ${s.required} on shift.`, tone: s.required - s.working > 1 ? 'critical' : 'warning' });
  }
  const ot = data.employees.filter((e) => e.hoursThisWeek > e.contractedHours);
  if (ot[0]) dynamic.push({ id: 'ot', text: `${ot[0].name} is approaching overtime (${ot[0].hoursThisWeek}h this week).`, tone: 'warning' });
  const away = data.employees.filter((e) => e.status === 'On leave' || e.status === 'Absent');
  if (away.length >= 2) dynamic.push({ id: 'away', text: `${away.length} staff unavailable today (${away.slice(0, 2).map((e) => e.name).join(', ')}${away.length > 2 ? '…' : ''}).`, tone: 'critical' });
  // Keep the cross-module chip guaranteed by appending it after capping the
  // dynamic alerts (otherwise many short departments would crowd it out).
  return [...dynamic.slice(0, 4), { id: 'a5', text: 'Delivery volume up 18% on Friday — consider another driver.', tone: 'info', module: 'orderflow' }];
}
