/**
 * ServiceDen — types + pure helpers for the service-business module (customers,
 * custom services, invoices built from those services). Data access is in
 * serviceden-data.ts; the UI is gated to a single account (see the const below).
 */

/** The only account allowed to see/use ServiceDen (Vyso's own service module). */
export const SERVICEDEN_ACCOUNT_EMAIL = 'joshua@vyso.co.za';

export type SdInvoiceStatus = 'draft' | 'sent' | 'paid';
export type SdServiceUnit = 'hour' | 'day' | 'fixed' | 'project' | 'month' | 'unit';

export const SERVICE_UNITS: { value: SdServiceUnit; label: string }[] = [
  { value: 'hour', label: 'Per hour' },
  { value: 'day', label: 'Per day' },
  { value: 'month', label: 'Per month' },
  { value: 'project', label: 'Per project' },
  { value: 'unit', label: 'Per unit' },
  { value: 'fixed', label: 'Fixed fee' },
];

export function unitLabel(unit: string): string {
  return SERVICE_UNITS.find((u) => u.value === unit)?.label ?? 'Fixed fee';
}

export const INVOICE_STATUS_META: Record<SdInvoiceStatus, { label: string; tone: 'neutral' | 'positive' | 'warning' | 'info' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  paid: { label: 'Paid', tone: 'positive' },
};

export interface SdCustomer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

export interface SdService {
  id: string;
  name: string;
  description: string | null;
  unit: SdServiceUnit;
  unitPrice: number;
  active: boolean;
}

export interface SdInvoiceItem {
  id: string;
  invoiceId: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SdInvoice {
  id: string;
  customerId: string | null;
  invoiceNumber: string;
  status: SdInvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  taxRate: number;
  notes: string | null;
  items: SdInvoiceItem[];
}

export interface ServiceDenData {
  customers: SdCustomer[];
  services: SdService[];
  invoices: SdInvoice[];
}

// ---------------------------------------------------------------------------
// Pure invoice maths
// ---------------------------------------------------------------------------

export function lineAmount(item: { quantity: number; unitPrice: number }): number {
  return Math.round(item.quantity * item.unitPrice * 100) / 100;
}
export function invoiceSubtotal(items: { quantity: number; unitPrice: number }[]): number {
  return Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;
}
export function invoiceTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}
export function invoiceTotal(items: { quantity: number; unitPrice: number }[], taxRate: number): number {
  const sub = invoiceSubtotal(items);
  return Math.round((sub + invoiceTax(sub, taxRate)) * 100) / 100;
}

/** Next sequential invoice number, e.g. INV-0004, from existing invoices. */
export function nextInvoiceNumber(invoices: { invoiceNumber: string }[]): string {
  let max = 0;
  for (const inv of invoices) {
    const m = /(\d+)\s*$/.exec(inv.invoiceNumber || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, '0')}`;
}
