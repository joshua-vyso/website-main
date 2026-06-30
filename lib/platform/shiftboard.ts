/**
 * ShiftBoard — people operations command centre. Types + mock data connecting
 * Employee → Shift → Department → Task → Device → Attendance → Labour cost →
 * Operational insight. Device/recipe/task fields prepare the future WasteWatch
 * link (a scale needs to know who is using it, in which department, on which
 * recipe). Shifts/labour will later come from a real backend; everything here is
 * illustrative mock and intentionally reuses WasteWatch staff + device names.
 */

import type { VysoModuleKey } from './module-meta';

export type DepartmentName = 'Prep Kitchen' | 'Receiving' | 'Dispatch' | 'Sales' | 'Drivers' | 'Warehouse' | 'Admin';
export type EmployeeStatus = 'Working' | 'On break' | 'Scheduled' | 'Off' | 'On leave' | 'Absent';
export type SkillName = 'Receiving' | 'Dispatch' | 'Prep Kitchen' | 'Driving' | 'Customer Service' | 'Stock Handling' | 'Device Operation';
export type CoverageStatus = 'covered' | 'short' | 'overstaffed';

export const DEPARTMENTS: DepartmentName[] = ['Prep Kitchen', 'Receiving', 'Dispatch', 'Sales', 'Drivers', 'Warehouse', 'Admin'];
export const SKILL_NAMES: SkillName[] = ['Receiving', 'Dispatch', 'Prep Kitchen', 'Driving', 'Customer Service', 'Stock Handling', 'Device Operation'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEPARTMENT_COLOR: Record<DepartmentName, string> = {
  'Prep Kitchen': '#0F6E56',
  Receiving: '#0C447C',
  Dispatch: '#D9730D',
  Sales: '#5B53C0',
  Drivers: '#2C7A8A',
  Warehouse: '#854F0B',
  Admin: '#5F6368',
};

/** Target headcount per department for "right now" (drives covered/short status). */
export const DEPARTMENT_REQUIRED: Record<DepartmentName, number> = {
  'Prep Kitchen': 4,
  Receiving: 2,
  Dispatch: 3,
  Sales: 2,
  Drivers: 2,
  Warehouse: 2,
  Admin: 1,
};

export const EMPLOYEE_STATUS_STYLE: Record<EmployeeStatus, { bg: string; fg: string }> = {
  Working: { bg: '#E1F5EE', fg: '#0F6E56' },
  'On break': { bg: '#FBEFDD', fg: '#9A6314' },
  Scheduled: { bg: '#E6F1FB', fg: '#0C447C' },
  Off: { bg: '#F0F0EC', fg: '#9A9DA1' },
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
// Employees
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

export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Thandi Mokoena', role: 'Prep lead', department: 'Prep Kitchen', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–16:00', hoursThisWeek: 38, contractedHours: 40, rate: 65, attendanceScore: 96, leaveBalance: 8, skills: [2, 1, 5, 0, 3, 3, 4], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Mornings', devices: ['Bench Scale 1'], currentDepartment: 'Prep Kitchen', currentTask: 'Expediting & prep lead' },
  { id: 'e2', name: 'Joshua Moreira', role: 'Kitchen prep', department: 'Prep Kitchen', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–16:00', hoursThisWeek: 41, contractedHours: 40, rate: 55, attendanceScore: 92, leaveBalance: 6, skills: [1, 0, 4, 0, 2, 2, 4], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Mornings', devices: ['Bench Scale 1'], currentDepartment: 'Prep Kitchen', currentTask: 'Chicken Caesar prep', currentRecipe: 'Chicken Caesar Salad', assignedDevice: 'Bench Scale 1' },
  { id: 'e3', name: 'Sipho Dlamini', role: 'Line chef', department: 'Prep Kitchen', status: 'Working', nextShift: 'Tomorrow 10:00', shiftTime: '10:00–18:00', hoursThisWeek: 43, contractedHours: 40, rate: 60, attendanceScore: 88, leaveBalance: 4, skills: [1, 1, 5, 0, 2, 3, 5], availableDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat', 'Sun'], unavailableDays: ['Thu'], preferredShifts: 'Late mornings', devices: ['Kitchen Scale 2'], currentDepartment: 'Prep Kitchen', currentTask: 'Napoletana sauce', currentRecipe: 'Napoletana Sauce', assignedDevice: 'Kitchen Scale 2' },
  { id: 'e4', name: 'Lerato Khumalo', role: 'Baker', department: 'Prep Kitchen', status: 'Scheduled', nextShift: 'Today 14:00', shiftTime: '14:00–20:00', hoursThisWeek: 36, contractedHours: 40, rate: 52, attendanceScore: 94, leaveBalance: 9, skills: [1, 0, 4, 0, 2, 2, 3], availableDays: ['Mon', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], unavailableDays: ['Tue'], preferredShifts: 'Afternoons', devices: ['Camera Station 1'], currentDepartment: 'Prep Kitchen', currentTask: 'Afternoon bake (from 14:00)' },
  { id: 'e5', name: 'Aisha Patel', role: 'Receiving clerk', department: 'Receiving', status: 'Working', nextShift: 'Tomorrow 07:00', shiftTime: '07:00–15:00', hoursThisWeek: 33, contractedHours: 40, rate: 50, attendanceScore: 90, leaveBalance: 7, skills: [5, 2, 1, 0, 2, 4, 4], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Early mornings', devices: ['Floor Scale 1'], currentDepartment: 'Receiving', currentTask: 'Goods-in check', assignedDevice: 'Floor Scale 1' },
  { id: 'e6', name: 'Naledi Mahlangu', role: 'Receiving assistant', department: 'Receiving', status: 'Working', nextShift: 'Tomorrow 07:00', shiftTime: '07:00–15:00', hoursThisWeek: 30, contractedHours: 32, rate: 45, attendanceScore: 97, leaveBalance: 10, skills: [4, 2, 1, 0, 2, 4, 3], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Mornings', devices: ['Barcode Station 3'], currentDepartment: 'Receiving', currentTask: 'Barcode scanning', assignedDevice: 'Barcode Station 3' },
  { id: 'e7', name: 'Kabelo Nkosi', role: 'Dispatch lead', department: 'Dispatch', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–16:00', hoursThisWeek: 40, contractedHours: 40, rate: 58, attendanceScore: 95, leaveBalance: 6, skills: [3, 5, 1, 2, 3, 4, 2], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Dispatch', currentTask: 'Order picking' },
  { id: 'e8', name: 'Riaan van Wyk', role: 'Dispatch clerk', department: 'Dispatch', status: 'Working', nextShift: 'Tomorrow 09:00', shiftTime: '09:00–17:00', hoursThisWeek: 37, contractedHours: 40, rate: 48, attendanceScore: 85, leaveBalance: 5, skills: [3, 4, 1, 2, 2, 4, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Dispatch', currentTask: 'Load planning' },
  { id: 'e9', name: 'Zinhle Khoza', role: 'Sales rep', department: 'Sales', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–16:00', hoursThisWeek: 39, contractedHours: 40, rate: 52, attendanceScore: 93, leaveBalance: 8, skills: [1, 1, 0, 0, 5, 2, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Sales', currentTask: 'Customer orders' },
  { id: 'e10', name: 'Pieter Steyn', role: 'Sales rep', department: 'Sales', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–16:00', hoursThisWeek: 35, contractedHours: 40, rate: 50, attendanceScore: 89, leaveBalance: 7, skills: [1, 1, 0, 1, 4, 2, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Sales', currentTask: 'Phone enquiries' },
  { id: 'e11', name: 'David Maluleke', role: 'Driver', department: 'Drivers', status: 'Working', nextShift: 'Tomorrow 06:00', shiftTime: '06:00–14:00', hoursThisWeek: 42, contractedHours: 45, rate: 55, attendanceScore: 91, leaveBalance: 5, skills: [2, 3, 0, 5, 2, 3, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Early', devices: [], currentDepartment: 'Drivers', currentTask: 'Delivery — Northern suburbs' },
  { id: 'e12', name: 'Johan Botha', role: 'Driver', department: 'Drivers', status: 'On leave', nextShift: '2 Jul 06:00', shiftTime: '06:00–14:00', hoursThisWeek: 0, contractedHours: 45, rate: 55, attendanceScore: 87, leaveBalance: 3, skills: [2, 2, 0, 5, 1, 3, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Early', devices: [] },
  { id: 'e13', name: 'Fanie Pretorius', role: 'Driver', department: 'Drivers', status: 'Absent', nextShift: 'Tomorrow 06:00', shiftTime: '06:00–14:00', hoursThisWeek: 12, contractedHours: 45, rate: 53, attendanceScore: 72, leaveBalance: 4, skills: [2, 2, 0, 4, 1, 2, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Early', devices: [] },
  { id: 'e14', name: 'Themba Zulu', role: 'Warehouse lead', department: 'Warehouse', status: 'Working', nextShift: 'Tomorrow 07:00', shiftTime: '07:00–15:00', hoursThisWeek: 38, contractedHours: 40, rate: 50, attendanceScore: 94, leaveBalance: 9, skills: [3, 3, 1, 1, 1, 5, 2], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], unavailableDays: ['Sun'], preferredShifts: 'Days', devices: ['Floor Scale 1'], currentDepartment: 'Warehouse', currentTask: 'Stock rotation' },
  { id: 'e15', name: 'Bongani Sithole', role: 'Warehouse assistant', department: 'Warehouse', status: 'Working', nextShift: 'Tomorrow 07:00', shiftTime: '07:00–15:00', hoursThisWeek: 34, contractedHours: 40, rate: 44, attendanceScore: 96, leaveBalance: 11, skills: [3, 2, 1, 1, 1, 5, 2], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Warehouse', currentTask: 'Putaway' },
  { id: 'e16', name: 'Megan Daniels', role: 'Operations admin', department: 'Admin', status: 'Working', nextShift: 'Tomorrow 08:00', shiftTime: '08:00–17:00', hoursThisWeek: 40, contractedHours: 40, rate: 62, attendanceScore: 98, leaveBalance: 12, skills: [2, 2, 1, 0, 4, 2, 1], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], unavailableDays: ['Sat', 'Sun'], preferredShifts: 'Days', devices: [], currentDepartment: 'Admin', currentTask: 'Timesheets & approvals' },
];

export const EMPLOYEE_BY_ID: Record<string, Employee> = Object.fromEntries(EMPLOYEES.map((e) => [e.id, e]));

/** People physically present in a department right now (working or on break). */
export function presentInDepartment(d: DepartmentName): Employee[] {
  return EMPLOYEES.filter((e) => e.currentDepartment === d && (e.status === 'Working' || e.status === 'On break'));
}

export interface DepartmentSnapshot {
  name: DepartmentName;
  color: string;
  required: number;
  working: number;
  status: CoverageStatus;
  staff: Employee[];
}

export function departmentSnapshots(): DepartmentSnapshot[] {
  return DEPARTMENTS.map((name) => {
    const staff = presentInDepartment(name);
    const required = DEPARTMENT_REQUIRED[name];
    return { name, color: DEPARTMENT_COLOR[name], required, working: staff.length, status: coverageStatus(staff.length, required), staff };
  });
}

/** Live device→user→department→recipe links — the WasteWatch foundation. */
export function liveDeviceAssignments(): (EmployeeDeviceAssignment & { employee: string })[] {
  return EMPLOYEES.filter((e) => e.assignedDevice).map((e) => ({ device: e.assignedDevice!, department: e.currentDepartment ?? e.department, task: e.currentTask, recipe: e.currentRecipe, at: e.shiftTime, employee: e.name }));
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

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

// Compact 7-day patterns ('' = off, 'L' = leave, otherwise a time window).
const PATTERN: Record<string, string[]> = {
  e1: ['08–16', '08–16', 'off', '08–16', '08–16', '10–18', 'off'],
  e2: ['08–16', '08–16', '08–16', '08–16', '08–16', 'off', 'off'],
  e3: ['10–18', '10–18', '10–18', 'off', '10–18', '12–20', '12–20'],
  e4: ['off', '14–20', '14–20', '14–20', '14–20', '10–18', 'off'],
  e5: ['07–15', '07–15', '07–15', '07–15', '07–15', 'off', 'off'],
  e6: ['07–15', '07–15', '07–15', '07–15', '07–15', 'off', 'off'],
  e7: ['08–16', '08–16', '08–16', '08–16', '08–16', '08–14', 'off'],
  e8: ['09–17', '09–17', '09–17', '09–17', '09–17', 'off', 'off'],
  e9: ['08–16', '08–16', '08–16', '08–16', '08–16', 'off', 'off'],
  e10: ['08–16', '08–16', '08–16', '08–16', '08–16', '09–13', 'off'],
  e11: ['06–14', '06–14', '06–14', '06–14', '06–14', '06–12', 'off'],
  e12: ['L', 'L', 'off', '06–14', '06–14', 'off', 'off'],
  e13: ['06–14', '06–14', '06–14', '06–14', '06–14', 'off', 'off'],
  e14: ['07–15', '07–15', '07–15', '07–15', '07–15', '08–14', 'off'],
  e15: ['07–15', '07–15', '07–15', '07–15', '07–15', 'off', 'off'],
  e16: ['08–17', '08–17', '08–17', '08–17', '08–17', 'off', 'off'],
};

// A few illustrative conflicts keyed by `${employeeId}:${dayIndex}`.
const CONFLICTS: Record<string, ShiftConflict> = {
  'e3:4': 'Overtime risk', // Sipho already at 43h
  'e2:4': 'Overtime risk', // Joshua over contracted
  'e12:3': 'Leave conflict', // Johan rostered right after leave
  'e8:1': 'Department short', // Dispatch thin on Tue
  'e11:5': 'Double booked',
};

export const ROSTER: RosterWeek = {
  label: 'Week of 30 Jun',
  rows: EMPLOYEES.map((e) => ({
    employeeId: e.id,
    name: e.name,
    role: e.role,
    department: e.department,
    days: PATTERN[e.id].map((code, i): Shift => {
      if (code === 'L') return { time: '', status: 'leave' };
      if (code === 'off') return { time: '', status: 'off' };
      return { time: code, department: e.department, status: 'scheduled', conflict: CONFLICTS[`${e.id}:${i}`] };
    }),
  })),
  openShifts: [
    { day: 'Wed', department: 'Dispatch', time: '13–21' },
    { day: 'Thu', department: 'Prep Kitchen', time: '06–12' },
    { day: 'Fri', department: 'Drivers', time: '06–14' },
  ],
};

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'On time' | 'Late' | 'Absent' | 'Early leave' | 'Overtime' | 'Manual review';

export const ATTENDANCE_STYLE: Record<AttendanceStatus, { bg: string; fg: string }> = {
  'On time': { bg: '#E1F5EE', fg: '#0F6E56' },
  Late: { bg: '#FBEFDD', fg: '#9A6314' },
  Absent: { bg: '#FCEBEB', fg: '#A32D2D' },
  'Early leave': { bg: '#FBEEDA', fg: '#854F0B' },
  Overtime: { bg: '#EAE7FB', fg: '#5B53C0' },
  'Manual review': { bg: '#F0F0EC', fg: '#5F6368' },
};

export interface AttendanceRecord {
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

export const ATTENDANCE: AttendanceRecord[] = [
  { employeeId: 'e1', name: 'Thandi Mokoena', department: 'Prep Kitchen', scheduled: '08:00–16:00', clockIn: '07:56', clockOut: null, hoursWorked: 4.1, status: 'On time', overtime: 0 },
  { employeeId: 'e2', name: 'Joshua Moreira', department: 'Prep Kitchen', scheduled: '08:00–16:00', clockIn: '08:01', clockOut: null, hoursWorked: 4.0, status: 'On time', overtime: 0 },
  { employeeId: 'e3', name: 'Sipho Dlamini', department: 'Prep Kitchen', scheduled: '10:00–18:00', clockIn: '09:58', clockOut: null, hoursWorked: 2.0, status: 'On time', overtime: 0 },
  { employeeId: 'e5', name: 'Aisha Patel', department: 'Receiving', scheduled: '07:00–15:00', clockIn: '06:55', clockOut: null, hoursWorked: 5.1, status: 'On time', overtime: 0 },
  { employeeId: 'e6', name: 'Naledi Mahlangu', department: 'Receiving', scheduled: '07:00–15:00', clockIn: '07:02', clockOut: null, hoursWorked: 5.0, status: 'On time', overtime: 0 },
  { employeeId: 'e7', name: 'Kabelo Nkosi', department: 'Dispatch', scheduled: '08:00–16:00', clockIn: '07:59', clockOut: null, hoursWorked: 4.0, status: 'On time', overtime: 0 },
  { employeeId: 'e8', name: 'Riaan van Wyk', department: 'Dispatch', scheduled: '09:00–17:00', clockIn: '09:18', clockOut: null, hoursWorked: 2.7, status: 'Late', overtime: 0 },
  { employeeId: 'e9', name: 'Zinhle Khoza', department: 'Sales', scheduled: '08:00–16:00', clockIn: '07:54', clockOut: null, hoursWorked: 4.1, status: 'On time', overtime: 0 },
  { employeeId: 'e10', name: 'Pieter Steyn', department: 'Sales', scheduled: '08:00–16:00', clockIn: '08:04', clockOut: null, hoursWorked: 4.0, status: 'On time', overtime: 0 },
  { employeeId: 'e11', name: 'David Maluleke', department: 'Drivers', scheduled: '06:00–14:00', clockIn: '05:58', clockOut: null, hoursWorked: 6.0, status: 'On time', overtime: 0 },
  { employeeId: 'e13', name: 'Fanie Pretorius', department: 'Drivers', scheduled: '06:00–14:00', clockIn: null, clockOut: null, hoursWorked: 0, status: 'Absent', overtime: 0 },
  { employeeId: 'e14', name: 'Themba Zulu', department: 'Warehouse', scheduled: '07:00–15:00', clockIn: '06:51', clockOut: null, hoursWorked: 5.2, status: 'Manual review', overtime: 0 },
  { employeeId: 'e15', name: 'Bongani Sithole', department: 'Warehouse', scheduled: '07:00–15:00', clockIn: '06:58', clockOut: null, hoursWorked: 5.0, status: 'On time', overtime: 0 },
  { employeeId: 'e16', name: 'Megan Daniels', department: 'Admin', scheduled: '08:00–17:00', clockIn: '07:49', clockOut: null, hoursWorked: 4.2, status: 'On time', overtime: 0 },
];

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

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

export const LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'l1', employeeId: 'e5', name: 'Aisha Patel', department: 'Receiving', type: 'Sick leave', start: '3 Jul', end: '3 Jul', days: 1, coverageImpact: 'Receiving stays covered (Naledi on shift).', coverageRisk: 'low', status: 'Pending' },
  { id: 'l2', employeeId: 'e11', name: 'David Maluleke', department: 'Drivers', type: 'Annual leave', start: 'Fri 4 Jul', end: 'Fri 4 Jul', days: 1, coverageImpact: 'Approving this leave will leave Drivers short by 1 person on Friday.', coverageRisk: 'high', status: 'Pending' },
  { id: 'l3', employeeId: 'e4', name: 'Lerato Khumalo', department: 'Prep Kitchen', type: 'Family responsibility', start: '5 Jul', end: '5 Jul', days: 1, coverageImpact: 'Prep Kitchen tight on Saturday morning.', coverageRisk: 'low', status: 'Pending' },
  { id: 'l4', employeeId: 'e12', name: 'Johan Botha', department: 'Drivers', type: 'Annual leave', start: '30 Jun', end: '1 Jul', days: 2, coverageImpact: 'Drivers thin today — David is the only driver on shift (Fanie absent).', coverageRisk: 'low', status: 'Approved' },
  { id: 'l5', employeeId: 'e9', name: 'Zinhle Khoza', department: 'Sales', type: 'Annual leave', start: '18 Jun', end: '20 Jun', days: 3, coverageImpact: 'Covered.', coverageRisk: 'none', status: 'Approved' },
];

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface DepartmentCoverage {
  department: DepartmentName;
  avgRequired: number;
  avgStaffed: number;
  shortDays: number; // out of 7
}

export const DEPARTMENT_COVERAGE_HISTORY: DepartmentCoverage[] = [
  { department: 'Dispatch', avgRequired: 3, avgStaffed: 2.2, shortDays: 5 },
  { department: 'Drivers', avgRequired: 2, avgStaffed: 1.5, shortDays: 4 },
  { department: 'Prep Kitchen', avgRequired: 4, avgStaffed: 3.4, shortDays: 3 },
  { department: 'Receiving', avgRequired: 2, avgStaffed: 2.0, shortDays: 1 },
  { department: 'Sales', avgRequired: 2, avgStaffed: 2.1, shortDays: 0 },
  { department: 'Warehouse', avgRequired: 2, avgStaffed: 1.9, shortDays: 1 },
];

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
  { id: 'li6', text: 'Overtime is concentrated in Prep Kitchen (Sipho, Joshua) — rebalance the late shift.' },
];

export const LABOUR_COST_TREND = [7800, 8200, 7900, 8600, 8450, 8100, 7700];
export const OVERTIME_TREND = [4, 6, 5, 8, 7, 9, 6];
export const ATTENDANCE_TREND = { lateArrivals: [2, 1, 3, 1, 2, 1, 0], absences: [0, 1, 0, 1, 1, 0, 0] };

// ---------------------------------------------------------------------------
// Overview aggregates
// ---------------------------------------------------------------------------

export const LABOUR_COST_TODAY = 8450;

export function overviewStats() {
  const working = EMPLOYEES.filter((e) => e.status === 'Working').length;
  const rostered = EMPLOYEES.filter((e) => e.status !== 'Off' && e.status !== 'On leave').length;
  const overtimeRisk = EMPLOYEES.filter((e) => e.hoursThisWeek > e.contractedHours).length;
  const attendanceIssues = ATTENDANCE.filter((a) => a.status === 'Late' || a.status === 'Absent').length;
  const openShifts = ROSTER.openShifts.length;
  return { working, rostered, overtimeRisk, attendanceIssues, openShifts, labourCost: LABOUR_COST_TODAY };
}

export interface OperationalAlert {
  id: string;
  text: string;
  tone: 'warning' | 'critical' | 'info';
  module?: VysoModuleKey;
}

export const OPERATIONAL_ALERTS: OperationalAlert[] = [
  { id: 'a1', text: 'Dispatch is understaffed this afternoon — 2 of 3 covered.', tone: 'warning' },
  { id: 'a2', text: 'Sipho Dlamini is approaching overtime (43h this week).', tone: 'warning' },
  { id: 'a3', text: 'Two drivers are unavailable today (Johan on leave, Fanie absent).', tone: 'critical' },
  { id: 'a4', text: 'Kitchen prep is short by 1 tomorrow morning — open shift unfilled.', tone: 'warning' },
  { id: 'a5', text: 'Delivery volume up 18% on Friday — consider another driver.', tone: 'info', module: 'orderflow' },
];
