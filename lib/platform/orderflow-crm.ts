/**
 * OrderFlow CRM layer — derives invoices, customer metrics, health, contacts,
 * delivery preferences, timelines and insights. Real order/customer data is the
 * source of truth; everything the backend doesn't store yet is mock-enriched
 * DETERMINISTICALLY from the record id (stable across renders), so the UI is
 * realistic without inventing a database. Strictly customer/order/invoice/CRM —
 * no supplier, stock, procurement or cost concepts.
 */

import {
  invoiceNumber,
  paymentStatusOf,
  type InvoiceStatus,
  type OrderStatus,
  type CustomerHealth,
} from './orderflow';

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness (seeded by id) — stable mock enrichment
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}
function pickN(max: number, seed: string): number {
  return hash(seed) % max;
}
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderLite {
  id: string;
  customer_id: string | null;
  status: OrderStatus;
  invoice_number: string | null;
  created_at: string;
  total: number;
  item_count: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

export interface Invoice {
  id: string;
  number: string;
  orderId: string;
  customerId: string | null;
  customerName: string;
  status: InvoiceStatus;
  issued: string;
  due: string;
  total: number;
  paid: number;
  balance: number;
  payments: Payment[];
}

export interface CustomerContact {
  id: string;
  name: string;
  role: 'Purchasing' | 'Accounts' | 'Receiving' | 'General';
  email: string;
  phone: string;
  primary?: boolean;
}

export interface CustomerNote {
  id: string;
  body: string;
  author: string;
  created_at: string;
}

export interface CustomerDeliveryPreferences {
  address: string;
  days: string[];
  receivingHours: string;
  dock: string;
  notes: string;
}

export interface CustomerMetrics {
  lifetimeRevenue: number;
  outstanding: number;
  orderCount: number;
  lastOrder: string | null;
  aov: number;
  frequencyPerWeek: number;
  monthlySpend: number;
  daysSinceLastOrder: number | null;
  decliningPct: number | null;
}

export interface ActivityEvent {
  id: string;
  kind: 'created' | 'edited' | 'invoiced' | 'emailed' | 'viewed' | 'payment' | 'archived' | 'note' | 'reminder';
  label: string;
  detail?: string;
  date: string;
}

export interface OrderComparisonLine {
  name: string;
  unit: string | null;
  from: number | null;
  to: number | null;
  delta: number;
}

export interface AttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  text: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Customer metrics + health (REAL, from order history)
// ---------------------------------------------------------------------------

/** Aggregate real order history for one customer. `now` is passed for testability. */
export function deriveCustomerMetrics(custOrders: OrderLite[], now: number): CustomerMetrics {
  const active = custOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'draft');
  const lifetimeRevenue = active.reduce((s, o) => s + o.total, 0);
  const outstanding = active
    .filter((o) => o.status === 'invoiced' || o.status === 'partially_paid')
    .reduce((s, o) => s + (o.status === 'partially_paid' ? o.total * 0.6 : o.total), 0);
  const times = active.map((o) => new Date(o.created_at).getTime()).sort((a, b) => a - b);
  const lastTs = times.length ? times[times.length - 1] : null;
  const firstTs = times.length ? times[0] : null;
  const orderCount = active.length;
  const aov = orderCount ? lifetimeRevenue / orderCount : 0;
  const spanWeeks = firstTs != null && lastTs != null ? Math.max(1, (lastTs - firstTs) / (7 * DAY)) : 1;
  const frequencyPerWeek = orderCount > 1 ? (orderCount - 1) / spanWeeks : 0;
  const monthlySpend = active.filter((o) => new Date(o.created_at).getTime() >= now - 30 * DAY).reduce((s, o) => s + o.total, 0);
  const prevMonthSpend = active
    .filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= now - 60 * DAY && t < now - 30 * DAY;
    })
    .reduce((s, o) => s + o.total, 0);
  const decliningPct = prevMonthSpend > 0 ? Math.round(((monthlySpend - prevMonthSpend) / prevMonthSpend) * 100) : null;
  return {
    lifetimeRevenue,
    outstanding,
    orderCount,
    lastOrder: lastTs != null ? new Date(lastTs).toISOString() : null,
    aov,
    frequencyPerWeek,
    monthlySpend,
    daysSinceLastOrder: lastTs != null ? Math.floor((now - lastTs) / DAY) : null,
    decliningPct,
  };
}

/** Customer health from real metrics: recency, overdue balance, declining spend. */
export function customerHealth(m: CustomerMetrics): { health: CustomerHealth; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (m.daysSinceLastOrder == null) {
    return { health: 'needs_attention', reasons: ['No orders yet'] };
  }
  if (m.daysSinceLastOrder <= 10) score += 2;
  else if (m.daysSinceLastOrder <= 21) score += 1;
  else reasons.push(`No order in ${m.daysSinceLastOrder} days`);
  if (m.outstanding <= 0) score += 1;
  else if (m.outstanding > 0 && m.daysSinceLastOrder > 21) reasons.push('Outstanding balance');
  if (m.decliningPct != null && m.decliningPct < -20) reasons.push(`Spend down ${Math.abs(m.decliningPct)}%`);
  else if (m.decliningPct != null && m.decliningPct >= 0) score += 1;
  if (m.frequencyPerWeek >= 1) score += 1;

  let health: CustomerHealth;
  if (score >= 4 && reasons.length === 0) health = 'excellent';
  else if (score >= 3 && reasons.length <= 1) health = 'stable';
  else if (reasons.length >= 2 || (m.daysSinceLastOrder ?? 0) > 30) health = 'needs_attention';
  else health = 'at_risk';
  if (reasons.length === 0) reasons.push('Ordering regularly, no overdue balance');
  return { health, reasons };
}

// ---------------------------------------------------------------------------
// Invoices (derived from orders + mock payment enrichment)
// ---------------------------------------------------------------------------

/** Orders that represent an invoice (have a number or are at/after the invoiced stage). */
export function isInvoiceable(o: { status: OrderStatus; invoice_number: string | null }): boolean {
  return (
    o.invoice_number != null ||
    o.status === 'invoiced' ||
    o.status === 'partially_paid' ||
    o.status === 'paid'
  );
}

export function mockPaymentTermsDays(customerId: string | null): number {
  return pick([7, 14, 30, 30, 30, 45], `terms-${customerId ?? 'none'}`);
}

/** Build an Invoice view from a real order, mock-enriching due date, paid amount and payments. */
export function deriveInvoice(order: OrderLite, customerName: string, seq: number, now: number): Invoice {
  const terms = mockPaymentTermsDays(order.customer_id);
  const issuedTs = new Date(order.created_at).getTime();
  const dueTs = issuedTs + terms * DAY;
  const total = order.total;

  // Confirmed / packed / delivered orders are draft invoices — ready to issue.
  if (order.status !== 'cancelled' && !isInvoiceable(order)) {
    return {
      id: order.id,
      number: order.invoice_number ?? invoiceNumber(seq),
      orderId: order.id,
      customerId: order.customer_id,
      customerName,
      status: 'draft',
      issued: new Date(issuedTs).toISOString(),
      due: new Date(dueTs).toISOString(),
      total,
      paid: 0,
      balance: total,
      payments: [],
    };
  }

  const ps = paymentStatusOf(order.status);

  let paid = 0;
  const payments: Payment[] = [];
  const method = pick(['EFT', 'EFT', 'Card', 'Cash'], `m-${order.id}`);
  if (ps === 'paid') {
    paid = total;
    payments.push({ id: `${order.id}-p1`, date: new Date(Math.min(now, dueTs)).toISOString(), amount: total, method, reference: `PAY-${order.id.slice(0, 6).toUpperCase()}` });
  } else if (ps === 'partial') {
    paid = Math.round(total * 0.4);
    payments.push({ id: `${order.id}-p1`, date: new Date(issuedTs + 3 * DAY).toISOString(), amount: paid, method, reference: `PAY-${order.id.slice(0, 6).toUpperCase()}` });
  }
  const balance = Math.max(0, total - paid);

  let status: InvoiceStatus;
  if (order.status === 'cancelled') status = 'cancelled';
  else if (ps === 'paid') status = 'paid';
  else if (ps === 'partial') status = 'partially_paid';
  else if (now > dueTs) status = 'overdue';
  else status = pick<InvoiceStatus>(['sent', 'sent', 'viewed'], `iv-${order.id}`);

  return {
    id: order.id,
    number: order.invoice_number ?? invoiceNumber(seq),
    orderId: order.id,
    customerId: order.customer_id,
    customerName,
    status,
    issued: new Date(issuedTs).toISOString(),
    due: new Date(dueTs).toISOString(),
    total,
    paid,
    balance,
    payments,
  };
}

// ---------------------------------------------------------------------------
// Mock CRM enrichment (deterministic)
// ---------------------------------------------------------------------------

const FIRST = ['Thandi', 'Pieter', 'Aisha', 'Sipho', 'Lerato', 'Johan', 'Nomvula', 'David', 'Fatima', 'Andile'];
const LAST = ['Mokoena', 'van der Merwe', 'Patel', 'Dlamini', 'Khumalo', 'Botha', 'Ndlovu', 'Smith', 'Naidoo', 'Mahlangu'];
const TAGS = ['Hotel', 'Restaurant', 'Café', 'Lodge', 'Butchery', 'Caterer', 'Retail'] as const;
const NOTE_POOL = [
  'Chef prefers larger avocados.',
  'Closed Mondays.',
  'Receiving dock after 08:00.',
  'Do not substitute berries.',
  'Invoice must reference their PO number.',
  'Prefers delivery before lunch service.',
];
const HOURS = ['After 08:00', '06:00–11:00', '07:00–14:00', 'Before 10:00'];
const DOCKS = ['Rear loading dock, ring buzzer', 'Loading bay 2', 'Side entrance, ask for chef', 'Kitchen entrance off the alley'];
const DAYS_OPTS = [
  ['Mon', 'Wed', 'Fri'],
  ['Tue', 'Thu'],
  ['Mon', 'Thu'],
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
];

function personName(seed: string): string {
  return `${pick(FIRST, seed + 'f')} ${pick(LAST, seed + 'l')}`;
}
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function customerTag(c: { id: string; name: string }): string {
  return pick(TAGS, `tag-${c.id}`);
}

const PRODUCE = ['Tomatoes', 'Avocados', 'Blueberries', 'Baby spinach', 'Button mushrooms', 'Fresh basil', 'Lemons', 'Carrots', 'Wild rocket', 'Strawberries', 'Cherry tomatoes', 'Cucumber'];

/** Mock "favourite products" for a customer (deterministic). */
export function mockFavourites(c: { id: string }): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < 3 && i < 8; i++) {
    const p = PRODUCE[hash(`${c.id}-fav-${i}`) % PRODUCE.length];
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function mockContacts(c: { id: string; name: string; email: string | null; phone: string | null }): CustomerContact[] {
  const domain = `${slug(c.name).slice(0, 14) || 'customer'}.co.za`;
  const purchasing = personName(`pur-${c.id}`);
  const accounts = personName(`acc-${c.id}`);
  return [
    {
      id: `${c.id}-c1`,
      name: purchasing,
      role: 'Purchasing',
      email: c.email ?? `${slug(purchasing.split(' ')[0])}@${domain}`,
      phone: c.phone ?? `0${pickN(90, `ph1-${c.id}`) + 10} ${100 + pickN(900, `ph2-${c.id}`)} ${1000 + pickN(9000, `ph3-${c.id}`)}`,
      primary: true,
    },
    {
      id: `${c.id}-c2`,
      name: accounts,
      role: 'Accounts',
      email: `accounts@${domain}`,
      phone: `0${pickN(90, `ph4-${c.id}`) + 10} ${100 + pickN(900, `ph5-${c.id}`)} ${1000 + pickN(9000, `ph6-${c.id}`)}`,
    },
  ];
}

export function mockDelivery(c: { id: string; name: string }): CustomerDeliveryPreferences {
  return {
    address: `${pickN(200, `addr-${c.id}`) + 1} ${pick(['Long', 'Main', 'Church', 'Loop', 'Bree', 'Rivonia'], `st-${c.id}`)} Street, ${pick(['Cape Town', 'Sandton', 'Rosebank', 'Pretoria', 'Durban'], `city-${c.id}`)}`,
    days: pick(DAYS_OPTS, `days-${c.id}`),
    receivingHours: pick(HOURS, `hrs-${c.id}`),
    dock: pick(DOCKS, `dock-${c.id}`),
    notes: pick(['Call on arrival.', 'Use the service lift.', 'Park in the rear bay.', 'Security will direct you.'], `dnote-${c.id}`),
  };
}

export function mockNotes(c: { id: string; name: string; notes: string | null }): CustomerNote[] {
  const out: CustomerNote[] = [];
  if (c.notes && c.notes.trim()) {
    out.push({ id: `${c.id}-n0`, body: c.notes.trim(), author: 'You', created_at: new Date(Date.now() - 20 * DAY).toISOString() });
  }
  const count = 1 + pickN(2, `nc-${c.id}`);
  for (let i = 0; i < count; i++) {
    out.push({
      id: `${c.id}-n${i + 1}`,
      body: pick(NOTE_POOL, `note-${c.id}-${i}`),
      author: personName(`na-${c.id}-${i}`),
      created_at: new Date(Date.now() - (5 + i * 9) * DAY).toISOString(),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Activity / timeline / comparison
// ---------------------------------------------------------------------------

/** Activity feed for a single order — real anchors (created/invoiced/paid) + mock comms. */
export function orderActivity(order: OrderLite, customerName: string): ActivityEvent[] {
  const created = new Date(order.created_at).getTime();
  const out: ActivityEvent[] = [{ id: `${order.id}-a0`, kind: 'created', label: 'Order created', date: new Date(created).toISOString() }];
  const seen = ['confirmed', 'packed', 'delivered', 'invoiced', 'partially_paid', 'paid'];
  if (seen.indexOf(order.status) >= 1) out.push({ id: `${order.id}-a1`, kind: 'edited', label: 'Order confirmed', date: new Date(created + DAY).toISOString() });
  if (isInvoiceable(order)) {
    out.push({ id: `${order.id}-a2`, kind: 'invoiced', label: 'Invoice generated', detail: order.invoice_number ?? undefined, date: new Date(created + 2 * DAY).toISOString() });
    out.push({ id: `${order.id}-a3`, kind: 'emailed', label: `Invoice emailed to ${customerName}`, date: new Date(created + 2 * DAY + 3600_000).toISOString() });
    out.push({ id: `${order.id}-a4`, kind: 'viewed', label: 'Customer viewed invoice', date: new Date(created + 3 * DAY).toISOString() });
  }
  if (order.status === 'paid' || order.status === 'partially_paid') {
    out.push({ id: `${order.id}-a5`, kind: 'payment', label: order.status === 'paid' ? 'Payment recorded — paid in full' : 'Part-payment recorded', date: new Date(created + 5 * DAY).toISOString() });
  }
  if (order.status === 'cancelled') out.push({ id: `${order.id}-a6`, kind: 'archived', label: 'Order cancelled', date: new Date(created + DAY).toISOString() });
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Compare this order's items to the customer's previous order (by item name). Real diff. */
export function compareOrders(
  current: { name: string; qty: number; unit: string | null }[],
  previous: { name: string; qty: number; unit: string | null }[],
): OrderComparisonLine[] {
  const prevMap = new Map(previous.map((p) => [p.name.toLowerCase(), p]));
  const curMap = new Map(current.map((p) => [p.name.toLowerCase(), p]));
  const names = new Set([...prevMap.keys(), ...curMap.keys()]);
  const out: OrderComparisonLine[] = [];
  for (const key of names) {
    const cur = curMap.get(key);
    const prev = prevMap.get(key);
    const to = cur ? Number(cur.qty) : null;
    const from = prev ? Number(prev.qty) : null;
    const delta = (to ?? 0) - (from ?? 0);
    if (delta !== 0) out.push({ name: (cur ?? prev)!.name, unit: (cur ?? prev)!.unit, from, to, delta });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Mock delivery date for an order (1–2 days after it was created). */
export function mockDeliveryDate(o: { id: string; created_at: string }): string {
  const days = 1 + (hash(o.id) % 2);
  return new Date(new Date(o.created_at).getTime() + days * DAY).toISOString();
}

/** "Orders needing attention" — uninvoiced confirmed orders, overdue invoices, missed cadence. */
export function orderAttention(orders: (OrderLite & { customer_name: string })[], now: number): AttentionItem[] {
  const out: AttentionItem[] = [];
  const seenUninvoiced = new Set<string>();
  for (const o of orders) {
    if ((o.status === 'confirmed' || o.status === 'packed' || o.status === 'delivered') && !seenUninvoiced.has(o.customer_name)) {
      seenUninvoiced.add(o.customer_name);
      out.push({ id: `unin-${o.id}`, severity: 'medium', text: `${o.customer_name} has a ${o.status} order not yet invoiced.`, href: `/app/orderflow/orders/${o.id}` });
    }
  }
  for (const o of orders) {
    if (o.status === 'invoiced') {
      const terms = mockPaymentTermsDays(o.customer_id);
      const dueTs = new Date(o.created_at).getTime() + terms * DAY;
      if (now > dueTs) {
        const days = Math.floor((now - dueTs) / DAY);
        out.push({ id: `over-${o.id}`, severity: 'high', text: `${o.customer_name} has an invoice overdue by ${days} day${days === 1 ? '' : 's'}.`, href: `/app/orderflow/invoicing` });
      }
    }
  }
  // Missed-cadence (mock): regular customers (3+ orders) gone quiet 7–20 days.
  const byCustomer = new Map<string, (OrderLite & { customer_name: string })[]>();
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'draft') continue;
    const k = o.customer_id ?? o.customer_name;
    (byCustomer.get(k) ?? byCustomer.set(k, []).get(k)!).push(o);
  }
  for (const [, list] of byCustomer) {
    if (list.length < 3) continue;
    const last = Math.max(...list.map((o) => new Date(o.created_at).getTime()));
    const days = Math.floor((now - last) / DAY);
    if (days >= 7 && days <= 20) {
      const name = list[0].customer_name;
      out.push({ id: `cad-${name}`, severity: 'low', text: `${name} usually orders weekly — none received this week.`, href: '/app/orderflow/customers' });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
}

export interface TimelineEvent {
  id: string;
  kind: 'order' | 'invoice' | 'payment' | 'note' | 'warning';
  label: string;
  detail?: string;
  date: string;
}

/** Customer-level timeline woven from their real orders/invoices + mock notes. */
export function customerTimeline(custOrders: OrderLite[], customerName: string, metrics: CustomerMetrics): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const o of custOrders) {
    out.push({ id: `${o.id}-t-o`, kind: 'order', label: `Order placed`, detail: o.invoice_number ?? undefined, date: o.created_at });
    if (isInvoiceable(o)) out.push({ id: `${o.id}-t-i`, kind: 'invoice', label: 'Invoice sent', detail: o.invoice_number ?? undefined, date: new Date(new Date(o.created_at).getTime() + 2 * DAY).toISOString() });
    if (o.status === 'paid') out.push({ id: `${o.id}-t-p`, kind: 'payment', label: 'Invoice paid', date: new Date(new Date(o.created_at).getTime() + 5 * DAY).toISOString() });
  }
  if (metrics.daysSinceLastOrder != null && metrics.daysSinceLastOrder > 21) {
    out.push({ id: 'inactive-warn', kind: 'warning', label: `No order in ${metrics.daysSinceLastOrder} days`, detail: 'Customer may be going quiet', date: new Date().toISOString() });
  }
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 14);
}
