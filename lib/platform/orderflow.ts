/**
 * OrderFlow — types + pure display/compute helpers for customers, orders and
 * invoices. Web-only (not in the 3-way-mirrored types.ts).
 */

export type PricingStatus = 'standard' | 'daily' | 'weekly' | 'monthly';
export type OrderStatus = 'draft' | 'confirmed' | 'invoiced' | 'paid';

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

export const ORDER_STATUSES: readonly OrderStatus[] = ['draft', 'confirmed', 'invoiced', 'paid'];

export const ORDER_STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  confirmed: { bg: '#E6F1FB', fg: '#0C447C', label: 'Confirmed' },
  invoiced: { bg: '#FBEEDA', fg: '#854F0B', label: 'Invoiced' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Paid' },
};

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

/** Rand, plain. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}
