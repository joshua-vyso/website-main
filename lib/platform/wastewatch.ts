/**
 * WasteWatch — operational waste intelligence. Types + mock data connecting
 * Employee → Device → Recipe → Ingredient → Waste → Cost → Recommendation.
 * Devices automatically measure waste; every event eventually knows which device
 * measured it, who was using it, which recipe they prepared and which ingredient
 * became waste. Recipe definitions, ingredient costs and batches will later come
 * from ProcurePulse; shifts from ShiftBoard. Everything here is illustrative mock.
 */

import type { VysoModuleKey } from './module-meta';

/** Org-defined waste category label (from ww_waste_categories). */
export type WasteCategory = string;
export type WasteReason = 'Spoiled' | 'Expired' | 'Wilted' | 'Day-old' | 'Over-portioned' | 'Damaged' | 'Trim' | 'Prep error' | 'Other';
export type DeviceType = 'Bluetooth Scale' | 'Bench Scale' | 'Floor Scale' | 'Kitchen Scale' | 'IoT Sensor' | 'Barcode Station' | 'Camera Station' | 'Custom Device';
export type DeviceStatus = 'online' | 'offline' | 'calibrating' | 'attention';

// ---------------------------------------------------------------------------
// Waste events
// ---------------------------------------------------------------------------

export interface WasteEvent {
  id: string;
  date: string;
  time: string;
  item: string;
  category: WasteCategory;
  qty: number;
  unit: string;
  cost: number;
  reason: WasteReason;
  recipe: string | null;
  employee: string;
  device: string;
  location: string;
  preventable: boolean;
  notes?: string;
  // ProcurePulse-integration placeholders (populated once linked):
  ingredient?: string;
  supplier?: string;
  batch?: string;
  expectedQty?: number;
}

export const WASTE_REASONS: WasteReason[] = ['Spoiled', 'Expired', 'Wilted', 'Day-old', 'Over-portioned', 'Damaged', 'Trim', 'Prep error', 'Other'];

/** A waste category row (ww_waste_categories) — carries its own stats. */
export interface WasteCategoryRow {
  id: string;
  name: string;
  color: string;
  cost: number;
  pct: number;
  trend: number[];
}

export interface CategoryStat {
  key: WasteCategory;
  cost: number;
  pct: number;
  color: string;
  trend: number[];
}

// ---------------------------------------------------------------------------
// Analytics aggregates
// ---------------------------------------------------------------------------

export interface EmployeeStat {
  name: string;
  cost: number;
  events: number;
  trend: 'up' | 'down' | 'flat';
  vsTeamPct: number; // +above / -below team average
}
export interface RecipeStat {
  recipe: string;
  wastePct: number;
  avgCost: number;
  frequency: number;
}

export const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const HEATMAP: { period: string; values: number[] }[] = [
  { period: 'Morning', values: [78, 64, 71, 66, 82, 90, 40] },
  { period: 'Lunch', values: [55, 48, 52, 50, 60, 72, 35] },
  { period: 'Dinner', values: [42, 38, 45, 44, 58, 80, 30] },
];

export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';
export const COST_TIMELINE: Record<TimePeriod, number[]> = {
  today: [120, 260, 180, 320, 410, 380, 290, 340],
  week: [3800, 4100, 3600, 4400, 4000, 4280, 3900],
  month: [16800, 17400, 15900, 18200, 17600, 18900],
  quarter: [52000, 49000, 54000, 51000],
  year: [180000, 172000, 168000, 190000, 176000, 184000, 179000, 188000, 181000, 175000, 192000, 186000],
};
export const TIME_PERIODS: { key: TimePeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

// Splits the period's total waste cost (sum of CATEGORY_STATS) into avoidable vs not.
export const PREVENTABLE = { preventable: 4760, unavoidable: 5680 };

export interface WasteInsight {
  id: string;
  text: string;
  module?: VysoModuleKey;
}
export const INSIGHTS: WasteInsight[] = [
  { id: 'i1', text: 'Strawberries are consistently over-ordered — reduce next order by ~30%.', module: 'procurepulse' },
  { id: 'i2', text: 'Tomatoes regularly exceed recipe quantities during prep.', module: 'procurepulse' },
  { id: 'i3', text: 'Three staff members generate above-average waste — worth a quick refresher.', module: 'shiftboard' },
  { id: 'i4', text: 'Waste during breakfast prep is 22% higher than other services.' },
  { id: 'i5', text: 'Caesar Salad has the highest recipe waste at 18% — review portioning.' },
];

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface DeviceMeasurement {
  time: string;
  item: string;
  qty: number;
  unit: string;
}
export interface DeviceHistoryEvent {
  kind: 'connected' | 'assigned' | 'recipe' | 'calibration' | 'disconnected';
  label: string;
  time: string;
}
export interface DeviceAssignment {
  name: string;
  role: string;
  startedAt: string;
  shift: string;
}
export interface DeviceRecipe {
  name: string;
  expected: string[];
  currentWaste?: { item: string; qty: string };
}
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  status: DeviceStatus;
  battery: number | null;
  lastSync: string;
  firmware: string;
  calibration: string;
  eventsToday: number;
  currentUser: DeviceAssignment | null;
  currentRecipe: DeviceRecipe | null;
  measurements: DeviceMeasurement[];
  history: DeviceHistoryEvent[];
}

export const DEVICE_TYPES: DeviceType[] = ['Bluetooth Scale', 'Bench Scale', 'Floor Scale', 'Kitchen Scale', 'IoT Sensor', 'Barcode Station', 'Camera Station', 'Custom Device'];

export const DEVICE_STATUS_STYLE: Record<DeviceStatus, { bg: string; fg: string; label: string }> = {
  online: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Online' },
  offline: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Offline' },
  calibrating: { bg: '#E6F1FB', fg: '#0C447C', label: 'Calibrating' },
  attention: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Needs attention' },
};

// ---------------------------------------------------------------------------
// Per-org payload (fetched in wastewatch-data.ts)
// ---------------------------------------------------------------------------

export interface WasteWatchData {
  categories: WasteCategoryRow[];
  events: WasteEvent[];
  devices: Device[];
  employeeStats: EmployeeStat[];
  recipeStats: RecipeStat[];
  preventable: { preventable: number; unavoidable: number };
}
