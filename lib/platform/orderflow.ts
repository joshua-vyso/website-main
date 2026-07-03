/**
 * OrderFlow — types + pure display/compute helpers for customers, orders and
 * invoices. Web-only (not in the 3-way-mirrored types.ts).
 */

export type PricingStatus = 'standard' | 'daily' | 'weekly' | 'monthly';
export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'picking'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'invoiced'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credited';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type CustomerHealth = 'excellent' | 'stable' | 'at_risk' | 'needs_attention';

export type AccountStatus = 'active' | 'inactive' | 'on_hold';
export type CustomerType = 'retail' | 'wholesale' | 'hospitality' | 'restaurant' | 'hotel' | 'other';

export interface OfCustomer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pricing_status: PricingStatus;
  notes: string | null;
  created_at: string;
  // Core Data extensions (core-data.sql) — optional so pre-migration selects still type-check.
  trading_name?: string | null;
  vat_number?: string | null;
  registration_number?: string | null;
  account_status?: AccountStatus;
  customer_type?: CustomerType;
  payment_terms_days?: number | null;
  credit_limit?: number | null;
  default_price_list_id?: string | null;
  billing_address?: string | null;
  tags?: string[];
  updated_at?: string;
  // Per-customer AI invoicing parameters (customer-ai-invoicing.sql).
  account_code?: string | null;
  vat_treatment?: VatTreatment;
  invoice_price_basis?: InvoicePriceBasis;
  invoice_quantity_basis?: InvoiceQuantityBasis;
  strip_order_prefixes?: boolean;
  ai_auto_invoice_confidence?: number | null;
  ai_allow_unpriced?: boolean;
  invoice_terms_days_override?: number | null;
  invoice_terms_text?: string | null;
  invoice_note?: string | null;
  ai_invoice_instructions?: string | null;
  /** Standing rebate % (rebates.sql) — auto-deducted from this customer's invoices. */
  rebate_pct?: number | null;
  // Flat imported fields (import-fields.sql) — editable on the profile.
  delivery_address?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  alt_phone?: string | null;
  fax?: string | null;
  opening_balance?: number | null;
  currency?: string | null;
}

// ---------------------------------------------------------------------------
// Per-customer AI invoicing parameters
// ---------------------------------------------------------------------------

export type VatTreatment = 'zero_rated' | 'standard' | 'exempt';
export type InvoicePriceBasis = 'price_list' | 'order_prices';
export type InvoiceQuantityBasis = 'auto' | 'bulk' | 'order_unit';

export const VAT_TREATMENTS: { value: VatTreatment; label: string }[] = [
  { value: 'zero_rated', label: 'Zero-rated (Z)' },
  { value: 'standard', label: 'Standard rate' },
  { value: 'exempt', label: 'Exempt' },
];

export const INVOICE_PRICE_BASES: { value: InvoicePriceBasis; label: string }[] = [
  { value: 'price_list', label: 'Our price list' },
  { value: 'order_prices', label: "Customer's order prices" },
];

export const INVOICE_QUANTITY_BASES: { value: InvoiceQuantityBasis; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'bulk', label: 'Bulk quantity' },
  { value: 'order_unit', label: 'Order unit quantity' },
];

/** The short VAT code printed per line on the classic invoice. */
export function vatCodeFor(t: VatTreatment | null | undefined): string {
  return t === 'standard' ? 'V' : t === 'exempt' ? 'E' : 'Z';
}

/** The VAT rate % an invoice should carry for a customer's treatment. */
export function vatRateForTreatment(t: VatTreatment | null | undefined, standardRate = 15): number {
  return t === 'standard' ? standardRate : 0;
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
  // Core Data extensions (core-data.sql).
  order_number?: string | null;
  delivery_address_id?: string | null;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  customer_po?: string | null;
  delivery_date?: string | null;
  quote_id?: string | null;
  invoice_id?: string | null;
  updated_at?: string;
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
  'picking',
  'packed',
  'out_for_delivery',
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
  picking: { bg: '#FBF3E4', fg: '#8A6D1B', label: 'Picking' },
  packed: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Packed' },
  out_for_delivery: { bg: '#E4F0FB', fg: '#1D5F8A', label: 'Out for delivery' },
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
  'credited',
];

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  sent: { bg: '#E6F1FB', fg: '#0C447C', label: 'Sent' },
  viewed: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Viewed' },
  partially_paid: { bg: '#FBE9D6', fg: '#B45309', label: 'Part-paid' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Paid' },
  overdue: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Overdue' },
  cancelled: { bg: '#F3E7E7', fg: '#8A4A4A', label: 'Cancelled' },
  credited: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Credited' },
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

/** Rand, plain (no cents) — e.g. "R 8 540". en-US grouping (comma) → spaces. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;
}

/** Rand with cents — for invoice balances, e.g. "R 1 234.56". en-US (dot decimal, comma grouping) → spaces, so the decimal separator survives. */
export function zar2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')}`;
}

// ============================================================================
// OrderFlow v2 — real quotes / invoices / credit notes / delivery notes /
// payments / activity (tables in supabase/core-data.sql). Rows are kept in
// snake_case to match the rest of this module.
// ============================================================================

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type CreditNoteStatus = 'draft' | 'issued';
export type DeliveryNoteStatus = 'draft' | 'out_for_delivery' | 'delivered';
export type PaymentMethod = 'eft' | 'cash' | 'card' | 'other';

/** A generic line item shared by quotes, invoices and credit notes. */
export interface OfDocItem {
  id: string;
  org_id: string;
  stock_item_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
  override_note?: string | null;
  sort_order?: number;
  created_at: string;
}

export interface OfInvoice {
  id: string;
  org_id: string;
  customer_id: string | null;
  order_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  vat_rate: number;
  /** Absolute discount in rands, applied to the subtotal before VAT. */
  discount: number;
  /** Customer rebate % snapshotted at creation, deducted after discount, before VAT. */
  rebate_pct?: number;
  customer_po: string | null;
  billing_address: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  notes: string | null;
  terms: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfInvoiceItem extends OfDocItem {
  invoice_id: string;
}

export interface OfQuote {
  id: string;
  org_id: string;
  customer_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  vat_rate: number;
  customer_po: string | null;
  delivery_address: string | null;
  notes: string | null;
  converted_order_id: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfQuoteItem extends OfDocItem {
  quote_id: string;
}

export interface OfCreditNote {
  id: string;
  org_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  credit_number: string;
  status: CreditNoteStatus;
  reason: string | null;
  notes: string | null;
  issue_date: string;
  vat_rate: number;
  created_at: string;
}

export interface OfCreditNoteItem extends OfDocItem {
  credit_note_id: string;
  invoice_item_id: string | null;
}

export interface OfDeliveryNote {
  id: string;
  org_id: string;
  order_id: string | null;
  invoice_id: string | null;
  customer_id: string | null;
  dn_number: string;
  status: DeliveryNoteStatus;
  delivery_address: string | null;
  instructions: string | null;
  driver_name: string | null;
  vehicle: string | null;
  delivered_at: string | null;
  signed_by: string | null;
  pod_document_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface OfDeliveryNoteItem {
  id: string;
  org_id: string;
  delivery_note_id: string;
  name: string;
  qty: number;
  unit: string | null;
  created_at: string;
}

export interface OfPayment {
  id: string;
  org_id: string;
  invoice_id: string;
  customer_id: string | null;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  reference: string | null;
  notes: string | null;
  receipt_document_id: string | null;
  created_at: string;
}

export interface OfActivityEvent {
  id: string;
  org_id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string | null;
  customer_id: string | null;
  event: string;
  description: string | null;
  created_at: string;
}

export interface OfSettings {
  org_id: string;
  invoice_prefix: string;
  invoice_next: number;
  quote_prefix: string;
  quote_next: number;
  order_prefix: string;
  order_next: number;
  credit_prefix: string;
  credit_next: number;
  dn_prefix: string;
  dn_next: number;
  number_pad: number;
  default_payment_terms_days: number;
  default_vat_rate: number;
  updated_at: string;
}

export const DEFAULT_OF_SETTINGS: OfSettings = {
  org_id: '',
  invoice_prefix: 'INV-',
  invoice_next: 1,
  quote_prefix: 'QTE-',
  quote_next: 1,
  order_prefix: 'ORD-',
  order_next: 1,
  credit_prefix: 'CN-',
  credit_next: 1,
  dn_prefix: 'DN-',
  dn_next: 1,
  number_pad: 4,
  default_payment_terms_days: 30,
  default_vat_rate: 15,
  updated_at: '',
};

export const QUOTE_STATUS_STYLE: Record<QuoteStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  sent: { bg: '#E6F1FB', fg: '#0C447C', label: 'Sent' },
  accepted: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Accepted' },
  rejected: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Rejected' },
  expired: { bg: '#F3E7E7', fg: '#8A4A4A', label: 'Expired' },
};

export const CREDIT_NOTE_STATUS_STYLE: Record<CreditNoteStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  issued: { bg: '#EDE9FB', fg: '#5B3FA8', label: 'Issued' },
};

export const DELIVERY_NOTE_STATUS_STYLE: Record<DeliveryNoteStatus, Style> = {
  draft: { bg: '#F0F0EC', fg: '#5F6368', label: 'Draft' },
  out_for_delivery: { bg: '#E4F0FB', fg: '#1D5F8A', label: 'Out for delivery' },
  delivered: { bg: '#E8F3E8', fg: '#2F6B2F', label: 'Delivered' },
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'eft', label: 'EFT' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const ACCOUNT_STATUS_STYLE: Record<AccountStatus, Style> = {
  active: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Active' },
  inactive: { bg: '#F0F0EC', fg: '#5F6368', label: 'Inactive' },
  on_hold: { bg: '#FCEBEB', fg: '#A32D2D', label: 'On hold' },
};

export const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'other', label: 'Other' },
];

/** Subtotal / discount / VAT / total for a document with a VAT rate and rand discount. */
export function docTotals(
  items: Pick<OfDocItem, 'qty' | 'unit_price'>[],
  vatRate: number,
  discount = 0,
  rebatePct = 0,
): { subtotal: number; discount: number; rebate: number; vat: number; total: number } {
  const subtotal = round2(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0));
  const disc = Math.min(round2(Number(discount) || 0), subtotal);
  const afterDisc = round2(subtotal - disc);
  // Rebate is a % off what's left after any absolute discount, before VAT.
  const rebate = round2(afterDisc * (Math.max(0, Number(rebatePct) || 0) / 100));
  const net = round2(afterDisc - rebate);
  const vat = round2(net * ((Number(vatRate) || 0) / 100));
  return { subtotal, discount: disc, rebate, vat, total: round2(net + vat) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Total recorded against an invoice across its payments. */
export function paymentsTotal(payments: Pick<OfPayment, 'amount'>[]): number {
  return round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
}

/** Amount still owed on an invoice (never negative). */
export function balanceDue(total: number, paid: number, credited = 0): number {
  return Math.max(0, round2(total - paid - credited));
}

/**
 * The status an invoice should display/store given its payments: overdue is
 * DERIVED (a sent/viewed invoice past its due date), paid/partially_paid come
 * from recorded payments. Draft/cancelled/credited are respected as-is.
 */
export function effectiveInvoiceStatus(
  inv: Pick<OfInvoice, 'status' | 'due_date'>,
  paid: number,
  total: number,
  now: Date = new Date(),
): InvoiceStatus {
  if (inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'credited') return inv.status;
  if (total > 0 && paid >= total - 0.005) return 'paid';
  if (paid > 0.005) return 'partially_paid';
  if (inv.due_date) {
    const due = new Date(`${inv.due_date}T23:59:59`);
    if (now > due) return 'overdue';
  }
  return inv.status;
}

/** A quote past its valid-until date reads as expired (unless already decided). */
export function effectiveQuoteStatus(q: Pick<OfQuote, 'status' | 'valid_until'>, now: Date = new Date()): QuoteStatus {
  if (q.status === 'accepted' || q.status === 'rejected' || q.status === 'expired') return q.status;
  if (q.valid_until && now > new Date(`${q.valid_until}T23:59:59`)) return 'expired';
  return q.status;
}

/** Client-side preview of the next number, e.g. ("TNS-INV-", 123, 6) → "TNS-INV-000123". */
export function formatDocNumber(prefix: string, n: number, pad: number): string {
  return `${prefix}${String(n).padStart(Math.max(pad, String(n).length), '0')}`;
}

/** ISO date (yyyy-mm-dd) offset `days` from a base date — for due-date defaults. */
export function isoDatePlusDays(base: string | Date, days: number): string {
  const d = typeof base === 'string' ? new Date(`${base}T12:00:00`) : new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// Setup detection — the v2 tables/columns live in supabase/core-data.sql. Until
// it's run, PostgREST returns "could not find the table … in the schema cache"
// (or a missing-column variant). Turn those into a clear, actionable message.
// ============================================================================

/** True when a Supabase error really means core-data.sql hasn't been run (missing table/column). */
export function isSetupError(msg: string | null | undefined): boolean {
  return !!msg && /could not find the table|schema cache|does not exist|could not find the '.*?' column|relation .*? does not exist/i.test(msg);
}

/** Map a missing-table/column error to a clear setup note; pass anything else through unchanged. */
export function setupMessage(msg: string): string {
  return isSetupError(msg)
    ? 'OrderFlow needs a one-time setup — run supabase/core-data.sql in your Supabase SQL editor to enable invoices, quotes, credit notes, payments and delivery notes.'
    : msg;
}
