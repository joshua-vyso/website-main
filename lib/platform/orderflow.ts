/**
 * OrderFlow — types + pure display/compute helpers for customers, orders and
 * invoices. Web-only (not in the 3-way-mirrored types.ts).
 */

export type PricingStatus = 'standard' | 'daily' | 'weekly' | 'monthly';
export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'packed'
  | 'delivered'
  | 'invoiced'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type CustomerHealth = 'excellent' | 'stable' | 'at_risk' | 'needs_attention';

export interface OfCustomer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pricing_status: PricingStatus;
  notes: string | null;
  created_at: string;
}

export interface OfOrder {
  id: string;
  org_id: string;
  customer_id: string | null;
  status: OrderStatus;
  invoice_number: string | null;
  notes: string | null;
  /** The Doc-U document this order was created from (uploaded customer order), or null. */
  source_document_id?: string | null;
  created_at: string;
}

export interface OfOrderItem {
  id: string;
  org_id: string;
  order_id: string;
  stock_item_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  created_at: string;
}

export const PRICING_STATUSES: readonly PricingStatus[] = ['standard', 'daily', 'weekly', 'monthly'];

export const PRICING_STATUS_LABEL: Record<PricingStatus, string> = {
  standard: 'Standard',
  daily: 'Daily prices',
  weekly: 'Weekly prices',
  monthly: 'Monthly prices',
};

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'draft',
  'confirmed',
  'packed',
  'delivered',
  'invoiced',
  'partially_paid',
  'paid',
  'cancelled',
];

type Style = { bg: string; fg: string; label: string };

export const ORDER_STATUS_STYLE: Record<OrderStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  confirmed: { bg: '#E6F1FB', fg: '#0C447C', label: 'Confirmed' },
  packed: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Packed' },
  delivered: { bg: '#E8F3E8', fg: '#2F6B2F', label: 'Delivered' },
  invoiced: { bg: '#FBEEDA', fg: '#854F0B', label: 'Invoiced' },
  partially_paid: { bg: '#FBE9D6', fg: '#B45309', label: 'Part-paid' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Paid' },
  cancelled: { bg: '#F3E7E7', fg: '#8A4A4A', label: 'Cancelled' },
};

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
];

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  sent: { bg: '#E6F1FB', fg: '#0C447C', label: 'Sent' },
  viewed: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Viewed' },
  partially_paid: { bg: '#FBE9D6', fg: '#B45309', label: 'Part-paid' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Paid' },
  overdue: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Overdue' },
  cancelled: { bg: '#F3E7E7', fg: '#8A4A4A', label: 'Cancelled' },
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, Style> = {
  unpaid: { bg: '#F0F0EC', fg: '#5F6368', label: 'Unpaid' },
  partial: { bg: '#FBE9D6', fg: '#B45309', label: 'Partial' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Paid' },
};

export const CUSTOMER_HEALTH_STYLE: Record<CustomerHealth, Style> = {
  excellent: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Excellent' },
  stable: { bg: '#E6F1FB', fg: '#0C447C', label: 'Stable' },
  at_risk: { bg: '#FBEEDA', fg: '#854F0B', label: 'At risk' },
  needs_attention: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Needs attention' },
};

/** Payment status implied by an order's status (no payments table yet). */
export function paymentStatusOf(status: OrderStatus): PaymentStatus {
  if (status === 'paid') return 'paid';
  if (status === 'partially_paid') return 'partial';
  return 'unpaid';
}

export function lineTotal(i: Pick<OfOrderItem, 'qty' | 'unit_price'>): number {
  return (Number(i.qty) || 0) * (Number(i.unit_price) || 0);
}

export function orderTotal(items: Pick<OfOrderItem, 'qty' | 'unit_price'>[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

const VAT_RATE = 0.15;
export function withVat(subtotal: number): { subtotal: number; vat: number; total: number } {
  const vat = subtotal * VAT_RATE;
  return { subtotal, vat, total: subtotal + vat };
}

/** Format an invoice number from a running count, e.g. 1 → "INV-0001". */
export function invoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(4, '0')}`;
}

/** Rand, plain (no cents) — e.g. "R 8 540". */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ')}`;
}

/** Rand with cents — for invoice balances. */
export function zar2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')}`;
}
