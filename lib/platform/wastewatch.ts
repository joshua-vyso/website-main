/**
 * WasteWatch — operational waste intelligence. Types + mock data connecting
 * Employee → Device → Recipe → Ingredient → Waste → Cost → Recommendation.
 * Devices automatically measure waste; every event eventually knows which device
 * measured it, who was using it, which recipe they prepared and which ingredient
 * became waste. Recipe definitions, ingredient costs and batches will later come
 * from ProcurePulse; shifts from ShiftBoard. Everything here is illustrative mock.
 */

import type { VysoModuleKey } from './module-meta';

export type WasteCategory = 'Produce' | 'Meat' | 'Dairy' | 'Bakery' | 'Seafood' | 'Other';
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

export const WASTE_EVENTS: WasteEvent[] = [
  { id: 'w1', date: '29 Jun', time: '09:29', item: 'Strawberries', category: 'Produce', qty: 1.8, unit: 'kg', cost: 320, reason: 'Over-portioned', recipe: 'Berry Parfait', employee: 'Thandi Mokoena', device: 'Bench Scale 1', location: 'Cold prep', preventable: true, ingredient: 'Strawberries', supplier: 'Cape Fresh Produce', batch: 'CF-2291', expectedQty: 1.2 },
  { id: 'w2', date: '29 Jun', time: '09:18', item: 'Baby spinach', category: 'Produce', qty: 3, unit: 'kg', cost: 210, reason: 'Wilted', recipe: 'Caesar Salad', employee: 'Sipho Dlamini', device: 'Kitchen Scale 2', location: 'Cold prep', preventable: true, ingredient: 'Baby spinach', supplier: 'Cape Fresh Produce', batch: 'CF-2287', expectedQty: 2.2 },
  { id: 'w3', date: '28 Jun', time: '17:42', item: 'Rump steak', category: 'Meat', qty: 2, unit: 'kg', cost: 540, reason: 'Over-portioned', recipe: 'Steak & Chips', employee: 'Johan Botha', device: 'Bench Scale 1', location: 'Grill', preventable: true, ingredient: 'Rump steak', supplier: 'Express Meats', batch: 'EM-1180', expectedQty: 1.6 },
  { id: 'w4', date: '28 Jun', time: '08:05', item: 'Full cream milk', category: 'Dairy', qty: 6, unit: 'L', cost: 90, reason: 'Expired', recipe: null, employee: 'Aisha Patel', device: 'Floor Scale 1', location: 'Receiving', preventable: false, ingredient: 'Milk', supplier: 'RSA Dairy Co', batch: 'RD-0455' },
  { id: 'w5', date: '27 Jun', time: '15:10', item: 'Bread rolls', category: 'Bakery', qty: 24, unit: 'units', cost: 120, reason: 'Day-old', recipe: null, employee: 'Lerato Khumalo', device: 'Camera Station 1', location: 'Bakery', preventable: false },
  { id: 'w6', date: '27 Jun', time: '11:34', item: 'Tomatoes', category: 'Produce', qty: 2.4, unit: 'kg', cost: 168, reason: 'Trim', recipe: 'Napoletana Sauce', employee: 'Thandi Mokoena', device: 'Kitchen Scale 2', location: 'Hot prep', preventable: true, ingredient: 'Tomatoes', supplier: 'Cape Fresh Produce', expectedQty: 1.9 },
  { id: 'w7', date: '26 Jun', time: '12:22', item: 'Salmon trim', category: 'Seafood', qty: 1.1, unit: 'kg', cost: 430, reason: 'Trim', recipe: 'Salmon Bowl', employee: 'Sipho Dlamini', device: 'Bench Scale 1', location: 'Cold prep', preventable: false, ingredient: 'Salmon', supplier: 'Two Oceans Seafood', batch: 'TO-0091' },
  { id: 'w8', date: '26 Jun', time: '09:48', item: 'Croutons', category: 'Bakery', qty: 1.5, unit: 'kg', cost: 95, reason: 'Prep error', recipe: 'Caesar Salad', employee: 'Johan Botha', device: 'Kitchen Scale 2', location: 'Hot prep', preventable: true },
  { id: 'w9', date: '25 Jun', time: '14:03', item: 'Cheddar', category: 'Dairy', qty: 0.9, unit: 'kg', cost: 160, reason: 'Spoiled', recipe: null, employee: 'Aisha Patel', device: 'Floor Scale 1', location: 'Cold store', preventable: false },
  { id: 'w10', date: '25 Jun', time: '10:15', item: 'Mince', category: 'Meat', qty: 1.3, unit: 'kg', cost: 195, reason: 'Over-portioned', recipe: 'Lasagne', employee: 'Lerato Khumalo', device: 'Bench Scale 1', location: 'Hot prep', preventable: true, ingredient: 'Beef mince', supplier: 'Express Meats', expectedQty: 1.0 },
  { id: 'w11', date: '24 Jun', time: '08:31', item: 'Avocados', category: 'Produce', qty: 12, unit: 'units', cost: 240, reason: 'Spoiled', recipe: null, employee: 'Thandi Mokoena', device: 'Camera Station 1', location: 'Cold store', preventable: false, ingredient: 'Avocados', supplier: 'Cape Fresh Produce' },
  { id: 'w12', date: '24 Jun', time: '16:55', item: 'Pizza dough', category: 'Bakery', qty: 8, unit: 'units', cost: 110, reason: 'Prep error', recipe: 'Margherita Pizza', employee: 'Sipho Dlamini', device: 'Kitchen Scale 2', location: 'Bakery', preventable: true },
  { id: 'w13', date: '23 Jun', time: '13:20', item: 'Used cooking oil', category: 'Other', qty: 5, unit: 'L', cost: 210, reason: 'Other', recipe: null, employee: 'Aisha Patel', device: 'Floor Scale 1', location: 'Receiving', preventable: false },
];

export const WASTE_CATEGORIES: WasteCategory[] = ['Produce', 'Meat', 'Dairy', 'Bakery', 'Seafood', 'Other'];
export const WASTE_REASONS: WasteReason[] = ['Spoiled', 'Expired', 'Wilted', 'Day-old', 'Over-portioned', 'Damaged', 'Trim', 'Prep error', 'Other'];

export const CATEGORY_COLOR: Record<WasteCategory, string> = {
  Produce: '#0F6E56',
  Meat: '#A32D2D',
  Dairy: '#854F0B',
  Bakery: '#0C447C',
  Seafood: '#2C7A8A',
  Other: '#9A9DA1',
};

export interface CategoryStat {
  key: WasteCategory;
  cost: number;
  pct: number;
  color: string;
  trend: number[];
}
export const CATEGORY_STATS: CategoryStat[] = [
  { key: 'Produce', cost: 4280, pct: 41, color: CATEGORY_COLOR.Produce, trend: [28, 31, 26, 34, 30, 38, 41] },
  { key: 'Meat', cost: 2820, pct: 27, color: CATEGORY_COLOR.Meat, trend: [22, 20, 25, 24, 26, 27, 27] },
  { key: 'Dairy', cost: 1460, pct: 14, color: CATEGORY_COLOR.Dairy, trend: [12, 14, 13, 15, 14, 14, 14] },
  { key: 'Bakery', cost: 1150, pct: 11, color: CATEGORY_COLOR.Bakery, trend: [10, 11, 12, 10, 11, 11, 11] },
  { key: 'Seafood', cost: 520, pct: 5, color: CATEGORY_COLOR.Seafood, trend: [4, 5, 5, 6, 5, 5, 5] },
  { key: 'Other', cost: 210, pct: 2, color: CATEGORY_COLOR.Other, trend: [3, 2, 2, 3, 2, 2, 2] },
];

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
export const EMPLOYEE_STATS: EmployeeStat[] = [
  { name: 'Thandi Mokoena', cost: 728, events: 9, trend: 'up', vsTeamPct: 34 },
  { name: 'Sipho Dlamini', cost: 640, events: 7, trend: 'flat', vsTeamPct: 18 },
  { name: 'Johan Botha', cost: 540, events: 5, trend: 'down', vsTeamPct: 0 },
  { name: 'Lerato Khumalo', cost: 305, events: 4, trend: 'down', vsTeamPct: -22 },
  { name: 'Aisha Patel', cost: 250, events: 3, trend: 'down', vsTeamPct: -31 },
];

export interface RecipeStat {
  recipe: string;
  wastePct: number;
  avgCost: number;
  frequency: number;
}
export const RECIPE_STATS: RecipeStat[] = [
  { recipe: 'Caesar Salad', wastePct: 18, avgCost: 152, frequency: 42 },
  { recipe: 'Steak & Chips', wastePct: 14, avgCost: 270, frequency: 31 },
  { recipe: 'Berry Parfait', wastePct: 22, avgCost: 160, frequency: 18 },
  { recipe: 'Napoletana Sauce', wastePct: 9, avgCost: 84, frequency: 26 },
  { recipe: 'Lasagne', wastePct: 12, avgCost: 98, frequency: 15 },
];

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
  offline: { bg: '#F0F0EC', fg: '#5F6368', label: 'Offline' },
  calibrating: { bg: '#E6F1FB', fg: '#0C447C', label: 'Calibrating' },
  attention: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Needs attention' },
};

export const DEVICES: Device[] = [
  {
    id: 'd1', name: 'Bench Scale 1', type: 'Bench Scale', location: 'Cold prep', status: 'online', battery: 86, lastSync: '2m ago', firmware: 'v2.4.1', calibration: 'OK · 6 days ago', eventsToday: 14,
    currentUser: { name: 'Joshua Moreira', role: 'Kitchen prep', startedAt: '09:18', shift: 'Morning' },
    currentRecipe: { name: 'Chicken Caesar Salad', expected: ['Chicken', 'Lettuce', 'Parmesan', 'Croutons', 'Dressing'], currentWaste: { item: 'Lettuce', qty: '320g' } },
    measurements: [
      { time: '09:29', item: 'Strawberries', qty: 1.8, unit: 'kg' },
      { time: '09:24', item: 'Spinach', qty: 220, unit: 'g' },
      { time: '09:18', item: 'Tomatoes', qty: 430, unit: 'g' },
    ],
    history: [
      { kind: 'recipe', label: 'Recipe changed to Chicken Caesar Salad', time: '09:18' },
      { kind: 'assigned', label: 'Assigned to Joshua Moreira', time: '09:18' },
      { kind: 'connected', label: 'Connected', time: '08:02' },
    ],
  },
  {
    id: 'd2', name: 'Kitchen Scale 2', type: 'Kitchen Scale', location: 'Hot prep', status: 'online', battery: 62, lastSync: '5m ago', firmware: 'v2.4.1', calibration: 'OK · 2 days ago', eventsToday: 9,
    currentUser: { name: 'Sipho Dlamini', role: 'Line chef', startedAt: '10:02', shift: 'Morning' },
    currentRecipe: { name: 'Napoletana Sauce', expected: ['Tomatoes', 'Garlic', 'Basil', 'Olive oil'], currentWaste: { item: 'Tomatoes', qty: '180g' } },
    measurements: [
      { time: '11:34', item: 'Tomatoes', qty: 2.4, unit: 'kg' },
      { time: '11:10', item: 'Garlic', qty: 60, unit: 'g' },
    ],
    history: [
      { kind: 'assigned', label: 'Assigned to Sipho Dlamini', time: '10:02' },
      { kind: 'connected', label: 'Connected', time: '07:55' },
    ],
  },
  {
    id: 'd3', name: 'Floor Scale 1', type: 'Floor Scale', location: 'Receiving', status: 'attention', battery: 18, lastSync: '40m ago', firmware: 'v2.3.0', calibration: 'Due · 31 days ago', eventsToday: 3,
    currentUser: null,
    currentRecipe: null,
    measurements: [{ time: '08:05', item: 'Milk crate', qty: 12, unit: 'kg' }],
    history: [
      { kind: 'calibration', label: 'Calibration due', time: 'Today' },
      { kind: 'connected', label: 'Connected', time: '07:40' },
    ],
  },
  {
    id: 'd4', name: 'Camera Station 1', type: 'Camera Station', location: 'Bakery', status: 'online', battery: null, lastSync: 'Just now', firmware: 'v1.2.0', calibration: 'N/A', eventsToday: 6,
    currentUser: { name: 'Lerato Khumalo', role: 'Baker', startedAt: '06:30', shift: 'Early' },
    currentRecipe: null,
    measurements: [{ time: '15:10', item: 'Bread rolls', qty: 24, unit: 'units' }],
    history: [
      { kind: 'assigned', label: 'Assigned to Lerato Khumalo', time: '06:30' },
      { kind: 'connected', label: 'Connected', time: '06:25' },
    ],
  },
  {
    id: 'd5', name: 'IoT Sensor — Cold store', type: 'IoT Sensor', location: 'Cold store', status: 'calibrating', battery: 74, lastSync: '1m ago', firmware: 'v3.0.2', calibration: 'In progress', eventsToday: 0,
    currentUser: null,
    currentRecipe: null,
    measurements: [],
    history: [{ kind: 'calibration', label: 'Calibration started', time: '12:40' }],
  },
  {
    id: 'd6', name: 'Bluetooth Scale 3', type: 'Bluetooth Scale', location: 'Grill', status: 'offline', battery: 0, lastSync: '3h ago', firmware: 'v2.4.0', calibration: 'OK · 11 days ago', eventsToday: 0,
    currentUser: null,
    currentRecipe: null,
    measurements: [],
    history: [
      { kind: 'disconnected', label: 'Disconnected — battery flat', time: '11:05' },
      { kind: 'connected', label: 'Connected', time: '07:30' },
    ],
  },
];
