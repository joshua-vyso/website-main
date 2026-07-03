/**
 * OrderFlow v2 data access — server-side fetchers, one per page. Pages
 * server-fetch and pass props (NO shared layout provider: a detail page must
 * always see a just-created record, and layout providers go stale on soft
 * navigation). Org-scoped by RLS; missing tables degrade to empty.
 */

import { createServerSupabase } from './supabase-server';
import type {
  OfCustomer,
  OfOrder,
  OfOrderItem,
  OfQuote,
  OfQuoteItem,
  OfInvoice,
  OfInvoiceItem,
  OfCreditNote,
  OfCreditNoteItem,
  OfDeliveryNote,
  OfDeliveryNoteItem,
  OfPayment,
  OfActivityEvent,
  OfSettings,
} from './orderflow';
import { DEFAULT_OF_SETTINGS } from './orderflow';
import type { CdContact, CdDeliveryAddress, CdProduct, CdPriceList, CdPriceOverride, CdPaymentTerm, CdCompanyProfile } from './coredata';

/* eslint-disable @typescript-eslint/no-explicit-any */
function rows<T>(res: { data: unknown }): T[] {
  return ((res.data as any[]) ?? []) as T[];
}

function one<T>(res: { data: unknown }): T | null {
  return (res.data as T | null) ?? null;
}

/** A document row attached to an OrderFlow entity (Doc-U link). */
export interface LinkedDocument {
  id: string;
  filename: string;
  document_type: string | null;
  status: string;
  storage_path: string | null;
  entity_type: string | null;
  entity_id: string | null;
  customer_id: string | null;
  created_at: string;
}

const LINKED_DOC_COLS = 'id, filename, document_type, status, storage_path, entity_type, entity_id, customer_id, created_at';

export async function getOfSettings(orgId: string): Promise<OfSettings> {
  const sb = await createServerSupabase();
  const res = await sb.from('of_settings').select('*').eq('org_id', orgId).maybeSingle();
  return (res.data as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface OrderFlowSnapshot {
  customers: OfCustomer[];
  orders: OfOrder[];
  quotes: OfQuote[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  activity: OfActivityEvent[];
  settings: OfSettings;
}

export async function getOrderFlowSnapshot(orgId: string): Promise<OrderFlowSnapshot> {
  const sb = await createServerSupabase();
  const [cus, ord, qts, inv, itm, pay, cns, cni, act, set] = await Promise.all([
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoice_items').select('*').eq('org_id', orgId),
    sb.from('of_payments').select('*').eq('org_id', orgId).order('paid_on', { ascending: false }),
    sb.from('of_credit_notes').select('*').eq('org_id', orgId),
    sb.from('of_credit_note_items').select('*').eq('org_id', orgId),
    sb.from('of_activity').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(40),
    sb.from('of_settings').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  return {
    customers: rows<OfCustomer>(cus),
    orders: rows<OfOrder>(ord),
    quotes: rows<OfQuote>(qts),
    invoices: rows<OfInvoice>(inv),
    invoiceItems: rows<OfInvoiceItem>(itm),
    payments: rows<OfPayment>(pay),
    creditNotes: rows<OfCreditNote>(cns),
    creditNoteItems: rows<OfCreditNoteItem>(cni),
    activity: rows<OfActivityEvent>(act),
    settings: (set.data as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId },
  };
}

// ---------------------------------------------------------------------------
// Customers + full profile
// ---------------------------------------------------------------------------

export interface CustomersData {
  customers: OfCustomer[];
  invoices: OfInvoice[];
  payments: OfPayment[];
  orders: OfOrder[];
  priceLists: CdPriceList[];
  paymentTerms: CdPaymentTerm[];
}

export async function getCustomersData(orgId: string): Promise<CustomersData> {
  const sb = await createServerSupabase();
  const [cus, inv, pay, ord, pls, terms] = await Promise.all([
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('of_invoices').select('*').eq('org_id', orgId),
    sb.from('of_payments').select('*').eq('org_id', orgId),
    sb.from('of_orders').select('*').eq('org_id', orgId),
    sb.from('pl_price_lists').select('*').eq('org_id', orgId),
    sb.from('cd_payment_terms').select('*').eq('org_id', orgId).order('days'),
  ]);
  return {
    customers: rows<OfCustomer>(cus),
    invoices: rows<OfInvoice>(inv),
    payments: rows<OfPayment>(pay),
    orders: rows<OfOrder>(ord),
    priceLists: rows<CdPriceList>(pls),
    paymentTerms: rows<CdPaymentTerm>(terms),
  };
}

export interface CustomerProfileData {
  customer: OfCustomer | null;
  contacts: CdContact[];
  addresses: CdDeliveryAddress[];
  quotes: OfQuote[];
  orders: OfOrder[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  activity: OfActivityEvent[];
  documents: LinkedDocument[];
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  paymentTerms: CdPaymentTerm[];
  settings: OfSettings;
}

export async function getCustomerProfile(orgId: string, customerId: string): Promise<CustomerProfileData> {
  const sb = await createServerSupabase();
  const [cus, con, adr, qts, ord, inv, itm, pay, cns, cni, act, docs, pls, ovr, terms, set] = await Promise.all([
    sb.from('of_customers').select('*').eq('org_id', orgId).eq('id', customerId).maybeSingle(),
    sb.from('cd_contacts').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('is_primary', { ascending: false }),
    sb.from('cd_delivery_addresses').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('is_default', { ascending: false }),
    sb.from('of_quotes').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    sb.from('of_orders').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    sb.from('of_invoices').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    sb.from('of_invoice_items').select('*').eq('org_id', orgId),
    sb.from('of_payments').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('paid_on', { ascending: false }),
    sb.from('of_credit_notes').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    sb.from('of_credit_note_items').select('*').eq('org_id', orgId),
    sb.from('of_activity').select('*').eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }).limit(60),
    sb.from('documents').select(LINKED_DOC_COLS).eq('org_id', orgId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    sb.from('pl_price_lists').select('*').eq('org_id', orgId),
    sb.from('pl_overrides').select('*').eq('org_id', orgId),
    sb.from('cd_payment_terms').select('*').eq('org_id', orgId).order('days'),
    sb.from('of_settings').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  const invoices = rows<OfInvoice>(inv);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const creditNotes = rows<OfCreditNote>(cns);
  const creditNoteIds = new Set(creditNotes.map((c) => c.id));
  return {
    customer: one<OfCustomer>(cus),
    contacts: rows<CdContact>(con),
    addresses: rows<CdDeliveryAddress>(adr),
    quotes: rows<OfQuote>(qts),
    orders: rows<OfOrder>(ord),
    invoices,
    invoiceItems: rows<OfInvoiceItem>(itm).filter((i) => invoiceIds.has(i.invoice_id)),
    payments: rows<OfPayment>(pay),
    creditNotes,
    creditNoteItems: rows<OfCreditNoteItem>(cni).filter((i) => creditNoteIds.has(i.credit_note_id)),
    activity: rows<OfActivityEvent>(act),
    documents: rows<LinkedDocument>(docs),
    priceLists: rows<CdPriceList>(pls),
    overrides: rows<CdPriceOverride>(ovr),
    paymentTerms: rows<CdPaymentTerm>(terms),
    settings: (set.data as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId },
  };
}

// ---------------------------------------------------------------------------
// Builder context — everything a quote/order/invoice builder needs
// ---------------------------------------------------------------------------

export interface BuilderContext {
  customers: OfCustomer[];
  addresses: CdDeliveryAddress[];
  products: CdProduct[];
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  paymentTerms: CdPaymentTerm[];
  settings: OfSettings;
}

export async function getBuilderContext(orgId: string): Promise<BuilderContext> {
  const sb = await createServerSupabase();
  const [cus, adr, prod, pls, ovr, terms, set] = await Promise.all([
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('cd_delivery_addresses').select('*').eq('org_id', orgId),
    sb.from('pp_stock_items').select('*').eq('org_id', orgId).order('name'),
    sb.from('pl_price_lists').select('*').eq('org_id', orgId),
    sb.from('pl_overrides').select('*').eq('org_id', orgId),
    sb.from('cd_payment_terms').select('*').eq('org_id', orgId).order('days'),
    sb.from('of_settings').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  return {
    customers: rows<OfCustomer>(cus),
    addresses: rows<CdDeliveryAddress>(adr),
    products: rows<CdProduct>(prod),
    priceLists: rows<CdPriceList>(pls),
    overrides: rows<CdPriceOverride>(ovr),
    paymentTerms: rows<CdPaymentTerm>(terms),
    settings: (set.data as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId },
  };
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export interface QuotesData {
  quotes: OfQuote[];
  items: OfQuoteItem[];
  customers: OfCustomer[];
}

export async function getQuotesData(orgId: string): Promise<QuotesData> {
  const sb = await createServerSupabase();
  const [qts, itm, cus] = await Promise.all([
    sb.from('of_quotes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_quote_items').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
  ]);
  return { quotes: rows<OfQuote>(qts), items: rows<OfQuoteItem>(itm), customers: rows<OfCustomer>(cus) };
}

export interface QuoteDetailData {
  quote: OfQuote | null;
  items: OfQuoteItem[];
  customer: OfCustomer | null;
  companyProfile: CdCompanyProfile | null;
}

export async function getQuoteDetail(orgId: string, id: string): Promise<QuoteDetailData> {
  const sb = await createServerSupabase();
  const [q, itm, profile] = await Promise.all([
    sb.from('of_quotes').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
    sb.from('of_quote_items').select('*').eq('quote_id', id).order('sort_order'),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  const quote = one<OfQuote>(q);
  const customer = quote?.customer_id
    ? one<OfCustomer>(await sb.from('of_customers').select('*').eq('id', quote.customer_id).maybeSingle())
    : null;
  return { quote, items: rows<OfQuoteItem>(itm), customer, companyProfile: one<CdCompanyProfile>(profile) };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrdersData {
  orders: OfOrder[];
  items: OfOrderItem[];
  customers: OfCustomer[];
}

export async function getOrdersData(orgId: string): Promise<OrdersData> {
  const sb = await createServerSupabase();
  const [ord, itm, cus] = await Promise.all([
    sb.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_order_items').select('*').eq('org_id', orgId),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
  ]);
  return { orders: rows<OfOrder>(ord), items: rows<OfOrderItem>(itm), customers: rows<OfCustomer>(cus) };
}

export interface OrderDetailData {
  order: OfOrder | null;
  items: OfOrderItem[];
  customer: OfCustomer | null;
  invoice: OfInvoice | null;
  /** The linked invoice's line items + payments (empty when no invoice). */
  invoiceItems: OfInvoiceItem[];
  invoicePayments: OfPayment[];
  deliveryNotes: OfDeliveryNote[];
  documents: LinkedDocument[];
  activity: OfActivityEvent[];
  settings: OfSettings;
}

export async function getOrderDetail(orgId: string, id: string): Promise<OrderDetailData> {
  const sb = await createServerSupabase();
  const [o, itm, dns, docs, act, set] = await Promise.all([
    sb.from('of_orders').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
    sb.from('of_order_items').select('*').eq('order_id', id),
    sb.from('of_delivery_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    sb.from('documents').select(LINKED_DOC_COLS).eq('org_id', orgId).eq('entity_type', 'order').eq('entity_id', id),
    sb.from('of_activity').select('*').eq('org_id', orgId).eq('entity_type', 'order').eq('entity_id', id).order('created_at', { ascending: false }),
    sb.from('of_settings').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  const order = one<OfOrder>(o);
  const [customer, invoice, invItm, invPay] = await Promise.all([
    order?.customer_id ? sb.from('of_customers').select('*').eq('id', order.customer_id).maybeSingle().then(one<OfCustomer>) : Promise.resolve(null),
    order?.invoice_id ? sb.from('of_invoices').select('*').eq('id', order.invoice_id).maybeSingle().then(one<OfInvoice>) : Promise.resolve(null),
    order?.invoice_id
      ? sb.from('of_invoice_items').select('*').eq('invoice_id', order.invoice_id).order('sort_order').then((r) => rows<OfInvoiceItem>(r))
      : Promise.resolve([] as OfInvoiceItem[]),
    order?.invoice_id
      ? sb.from('of_payments').select('*').eq('invoice_id', order.invoice_id).order('paid_on').then((r) => rows<OfPayment>(r))
      : Promise.resolve([] as OfPayment[]),
  ]);
  return {
    order,
    items: rows<OfOrderItem>(itm),
    customer,
    invoice,
    invoiceItems: invItm,
    invoicePayments: invPay,
    deliveryNotes: rows<OfDeliveryNote>(dns),
    documents: rows<LinkedDocument>(docs),
    activity: rows<OfActivityEvent>(act),
    settings: (set.data as OfSettings | null) ?? { ...DEFAULT_OF_SETTINGS, org_id: orgId },
  };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoicesData {
  invoices: OfInvoice[];
  items: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  customers: OfCustomer[];
}

export async function getInvoicesData(orgId: string): Promise<InvoicesData> {
  const sb = await createServerSupabase();
  const [inv, itm, pay, cns, cni, cus] = await Promise.all([
    sb.from('of_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoice_items').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('of_payments').select('*').eq('org_id', orgId),
    sb.from('of_credit_notes').select('*').eq('org_id', orgId),
    sb.from('of_credit_note_items').select('*').eq('org_id', orgId),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
  ]);
  return {
    invoices: rows<OfInvoice>(inv),
    items: rows<OfInvoiceItem>(itm),
    payments: rows<OfPayment>(pay),
    creditNotes: rows<OfCreditNote>(cns),
    creditNoteItems: rows<OfCreditNoteItem>(cni),
    customers: rows<OfCustomer>(cus),
  };
}

export interface InvoiceDetailData {
  invoice: OfInvoice | null;
  items: OfInvoiceItem[];
  payments: OfPayment[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  customer: OfCustomer | null;
  order: OfOrder | null;
  companyProfile: CdCompanyProfile | null;
  documents: LinkedDocument[];
  activity: OfActivityEvent[];
}

export async function getInvoiceDetail(orgId: string, id: string): Promise<InvoiceDetailData> {
  const sb = await createServerSupabase();
  const [i, itm, pay, cns, profile, docs, act] = await Promise.all([
    sb.from('of_invoices').select('*').eq('org_id', orgId).eq('id', id).maybeSingle(),
    sb.from('of_invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    sb.from('of_payments').select('*').eq('invoice_id', id).order('paid_on'),
    sb.from('of_credit_notes').select('*').eq('invoice_id', id),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
    sb.from('documents').select(LINKED_DOC_COLS).eq('org_id', orgId).eq('entity_type', 'invoice').eq('entity_id', id),
    sb.from('of_activity').select('*').eq('org_id', orgId).eq('entity_type', 'invoice').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);
  const invoice = one<OfInvoice>(i);
  const creditNotes = rows<OfCreditNote>(cns);
  const cnIds = creditNotes.map((c) => c.id);
  const [customer, order, cni] = await Promise.all([
    invoice?.customer_id ? sb.from('of_customers').select('*').eq('id', invoice.customer_id).maybeSingle().then(one<OfCustomer>) : Promise.resolve(null),
    invoice?.order_id ? sb.from('of_orders').select('*').eq('id', invoice.order_id).maybeSingle().then(one<OfOrder>) : Promise.resolve(null),
    cnIds.length ? sb.from('of_credit_note_items').select('*').in('credit_note_id', cnIds).then((r) => rows<OfCreditNoteItem>(r)) : Promise.resolve([] as OfCreditNoteItem[]),
  ]);
  return {
    invoice,
    items: rows<OfInvoiceItem>(itm),
    payments: rows<OfPayment>(pay),
    creditNotes,
    creditNoteItems: cni,
    customer,
    order,
    companyProfile: one<CdCompanyProfile>(profile),
    documents: rows<LinkedDocument>(docs),
    activity: rows<OfActivityEvent>(act),
  };
}

// ---------------------------------------------------------------------------
// Delivery notes / credit notes / payments / price lists
// ---------------------------------------------------------------------------

export interface DeliveryNotesData {
  deliveryNotes: OfDeliveryNote[];
  items: OfDeliveryNoteItem[];
  customers: OfCustomer[];
  orders: OfOrder[];
  invoices: OfInvoice[];
  companyProfile: CdCompanyProfile | null;
}

export async function getDeliveryNotesData(orgId: string): Promise<DeliveryNotesData> {
  const sb = await createServerSupabase();
  const [dns, itm, cus, ord, inv, profile] = await Promise.all([
    sb.from('of_delivery_notes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_delivery_note_items').select('*').eq('org_id', orgId),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  return {
    deliveryNotes: rows<OfDeliveryNote>(dns),
    items: rows<OfDeliveryNoteItem>(itm),
    customers: rows<OfCustomer>(cus),
    orders: rows<OfOrder>(ord),
    invoices: rows<OfInvoice>(inv),
    companyProfile: one<CdCompanyProfile>(profile),
  };
}

export interface CreditNotesData {
  creditNotes: OfCreditNote[];
  items: OfCreditNoteItem[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  payments: OfPayment[];
  customers: OfCustomer[];
  companyProfile: CdCompanyProfile | null;
}

export async function getCreditNotesData(orgId: string): Promise<CreditNotesData> {
  const sb = await createServerSupabase();
  const [cns, itm, inv, invItm, pay, cus, profile] = await Promise.all([
    sb.from('of_credit_notes').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_credit_note_items').select('*').eq('org_id', orgId),
    sb.from('of_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoice_items').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('of_payments').select('*').eq('org_id', orgId),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    sb.from('cd_company_profile').select('*').eq('org_id', orgId).maybeSingle(),
  ]);
  return {
    creditNotes: rows<OfCreditNote>(cns),
    items: rows<OfCreditNoteItem>(itm),
    invoices: rows<OfInvoice>(inv),
    invoiceItems: rows<OfInvoiceItem>(invItm),
    payments: rows<OfPayment>(pay),
    customers: rows<OfCustomer>(cus),
    companyProfile: one<CdCompanyProfile>(profile),
  };
}

export interface PaymentsData {
  payments: OfPayment[];
  invoices: OfInvoice[];
  invoiceItems: OfInvoiceItem[];
  creditNotes: OfCreditNote[];
  creditNoteItems: OfCreditNoteItem[];
  customers: OfCustomer[];
}

export async function getPaymentsData(orgId: string): Promise<PaymentsData> {
  const sb = await createServerSupabase();
  const [pay, inv, itm, cns, cni, cus] = await Promise.all([
    sb.from('of_payments').select('*').eq('org_id', orgId).order('paid_on', { ascending: false }),
    sb.from('of_invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('of_invoice_items').select('*').eq('org_id', orgId),
    sb.from('of_credit_notes').select('*').eq('org_id', orgId),
    sb.from('of_credit_note_items').select('*').eq('org_id', orgId),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
  ]);
  return {
    payments: rows<OfPayment>(pay),
    invoices: rows<OfInvoice>(inv),
    invoiceItems: rows<OfInvoiceItem>(itm),
    creditNotes: rows<OfCreditNote>(cns),
    creditNoteItems: rows<OfCreditNoteItem>(cni),
    customers: rows<OfCustomer>(cus),
  };
}

/** The latest positive unit price a market-statement document quoted for a
 *  product, with its provenance (statement date + source filename). */
export interface StatementPrice {
  price: number;
  date: string | null;
  source: string | null;
}

export interface PriceListsData {
  priceLists: CdPriceList[];
  overrides: CdPriceOverride[];
  products: CdProduct[];
  customers: OfCustomer[];
  /** Latest market-statement price per product, keyed by stock_item_id. Empty
   *  for any product with no matching statement line. */
  latestStatementPrices: Record<string, StatementPrice>;
}

/** Positive unit price from a loose string ("R 78,50", "1 240.00"), else null. */
function statementUnitPrice(raw: unknown): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getPriceListsData(orgId: string): Promise<PriceListsData> {
  const sb = await createServerSupabase();
  const [pls, ovr, prod, cus, aliasRes, docRes] = await Promise.all([
    sb.from('pl_price_lists').select('*').eq('org_id', orgId).order('created_at'),
    sb.from('pl_overrides').select('*').eq('org_id', orgId),
    sb.from('pp_stock_items').select('*').eq('org_id', orgId).order('name'),
    sb.from('of_customers').select('*').eq('org_id', orgId).order('name'),
    // Confirmed name aliases (raw description → canonical stock item). Table may
    // not exist pre-migration; PostgREST returns an error, so default to [].
    sb.from('pp_name_aliases').select('raw_name, stock_item_id').eq('org_id', orgId).eq('status', 'confirmed'),
    // Market-statement documents, newest first. Tolerate a missing/odd table.
    sb
      .from('documents')
      .select('id, filename, created_at, extracted_data')
      .eq('org_id', orgId)
      .eq('document_type', 'statement')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const products = rows<CdProduct>(prod);

  // Matcher: lowercased/trimmed product name → stock_item_id, then overlay the
  // confirmed aliases (aliases win, being a deliberate human link).
  const matcher = new Map<string, string>();
  for (const p of products) {
    const key = (p.name ?? '').trim().toLowerCase();
    if (key) matcher.set(key, p.id);
  }
  const aliasRows = aliasRes.error ? [] : ((aliasRes.data as { raw_name: string; stock_item_id: string | null }[] | null) ?? []);
  for (const a of aliasRows) {
    const key = (a.raw_name ?? '').trim().toLowerCase();
    if (key && a.stock_item_id) matcher.set(key, a.stock_item_id);
  }

  // Walk statement docs newest→oldest; first positive price per item wins.
  const latestStatementPrices: Record<string, StatementPrice> = {};
  const docs = docRes.error
    ? []
    : ((docRes.data as { id: string; filename: string | null; created_at: string | null; extracted_data: any }[] | null) ?? []);
  for (const doc of docs) {
    const ed = doc.extracted_data ?? null;
    const lineItems: any[] = Array.isArray(ed?.line_items) ? ed.line_items : [];
    if (lineItems.length === 0) continue;
    const statementDate: string | null =
      (typeof ed?.summary?.statement_date === 'string' && ed.summary.statement_date) ||
      (doc.created_at ? doc.created_at.slice(0, 10) : null);
    for (const li of lineItems) {
      const price = statementUnitPrice(li?.unit_price);
      if (price == null) continue;
      const desc = (li?.description ?? '').toString().trim().toLowerCase();
      if (!desc) continue;
      const stockItemId = matcher.get(desc);
      if (!stockItemId || stockItemId in latestStatementPrices) continue;
      latestStatementPrices[stockItemId] = {
        price,
        date: statementDate,
        source: doc.filename ?? null,
      };
    }
  }

  return {
    priceLists: rows<CdPriceList>(pls),
    overrides: rows<CdPriceOverride>(ovr),
    products,
    customers: rows<OfCustomer>(cus),
    latestStatementPrices,
  };
}
