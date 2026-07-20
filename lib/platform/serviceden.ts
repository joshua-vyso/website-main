/**
 * ServiceDen — types + pure helpers for the service-business module (customers,
 * custom services, invoices built from those services). Data access is in
 * serviceden-data.ts; the UI is gated to a single account (see the const below).
 */

/** The only account allowed to see/use ServiceDen (Vyso's own service module). */
export const SERVICEDEN_ACCOUNT_EMAIL = 'joshua@vyso.co.za';

export type SdInvoiceStatus = 'draft' | 'sent' | 'paid';
export type SdServiceUnit = 'hour' | 'day' | 'fixed' | 'project' | 'month' | 'unit';
export type SdLeadStage =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'discovery'
  | 'pilot_proposed'
  | 'founding_customer'
  | 'nurture'
  | 'won'
  | 'lost';
export type SdLeadReviewStatus = 'suggested' | 'accepted' | 'rejected';
export type SdLeadSource = 'manual' | 'gmail_agent' | 'gmail_label' | 'referral' | 'website' | 'other';

export const LEAD_STAGE_META: Record<SdLeadStage, { label: string; tone: 'neutral' | 'positive' | 'warning' | 'info' }> = {
  new: { label: 'New', tone: 'neutral' },
  contacted: { label: 'Contacted', tone: 'info' },
  replied: { label: 'Replied', tone: 'positive' },
  discovery: { label: 'Discovery', tone: 'positive' },
  pilot_proposed: { label: 'Pilot proposed', tone: 'warning' },
  founding_customer: { label: 'Founding customer', tone: 'positive' },
  nurture: { label: 'Nurture', tone: 'neutral' },
  won: { label: 'Won', tone: 'positive' },
  lost: { label: 'Lost', tone: 'neutral' },
};

export const LEAD_STAGES = Object.entries(LEAD_STAGE_META).map(([value, meta]) => ({
  value: value as SdLeadStage,
  label: meta.label,
}));

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

export interface SdSettings {
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  vatNumber: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branchCode: string | null;
  swift: string | null;
  paymentReference: string | null;
  /** Logo as a base64 data URL (data:image/...;base64,...). */
  logoData: string | null;
}

export interface SdLead {
  id: string;
  ownerUserId: string;
  gmailConnectionId: string | null;
  convertedCustomerId: string | null;
  contactName: string;
  company: string | null;
  email: string;
  phone: string | null;
  source: SdLeadSource;
  stage: SdLeadStage;
  reviewStatus: SdLeadReviewStatus;
  primaryPain: string | null;
  summary: string | null;
  agentNextAction: string | null;
  agentConfidence: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  nextFollowUpAt: string | null;
  followUpCount: number;
  notes: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SdGmailConnection {
  id: string;
  emailAddress: string;
  scopes: string[];
  status: 'connected' | 'syncing' | 'error' | 'reauth_required' | 'disconnected';
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SdLeadPageData {
  leads: SdLead[];
  gmailConnection: SdGmailConnection | null;
  gmailConfigured: boolean;
  schemaReady: boolean;
}

export interface SdMailMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  sentAt: string;
  snippet: string | null;
  bodyText: string | null;
}

export interface SdMailThread {
  id: string;
  providerThreadId: string;
  subject: string | null;
  participants: string[];
  latestMessageAt: string | null;
  messages: SdMailMessage[];
}

export interface SdLeadDetail {
  lead: SdLead;
  threads: SdMailThread[];
}

export const EMPTY_SD_SETTINGS: SdSettings = {
  businessName: null,
  businessEmail: null,
  businessPhone: null,
  businessAddress: null,
  vatNumber: null,
  bankName: null,
  accountName: null,
  accountNumber: null,
  branchCode: null,
  swift: null,
  paymentReference: null,
  logoData: null,
};

/** True when any banking field is filled in (controls the invoice "pay to" block). */
export function hasBankDetails(s: SdSettings | null | undefined): boolean {
  return !!(s && (s.bankName || s.accountName || s.accountNumber || s.branchCode || s.swift || s.paymentReference));
}

export interface ServiceDenData {
  customers: SdCustomer[];
  services: SdService[];
  invoices: SdInvoice[];
  settings: SdSettings | null;
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
