/**
 * Core Data — the shared operational source of truth across Vyso modules.
 *
 * Core Data is a lib-level abstraction over physical tables that keep their
 * historical names (no data duplication):
 *   Customers            → of_customers        (OfCustomer in orderflow.ts)
 *   Contacts             → cd_contacts
 *   Delivery addresses   → cd_delivery_addresses
 *   Products & services  → pp_stock_items      (CdProduct = StockItem + extensions)
 *   Price lists          → pl_price_lists / pl_overrides (pricepilot.ts + extensions)
 *   Payment terms        → cd_payment_terms
 *   VAT settings         → cd_vat_rates
 *   Company profile      → cd_company_profile
 *   Document templates   → cd_doc_templates
 *
 * Doc-U (Databases pages) is the governance interface; OrderFlow and other
 * modules read from and write back to these tables — never to module-private
 * copies. Schema: supabase/core-data.sql.
 */

import type { StockItem } from '@/lib/platform/types';
import type { PlPriceList, PlOverride } from '@/lib/platform/pricepilot';
import { sellPrice } from '@/lib/platform/pricepilot';
import type { OfCustomer } from '@/lib/platform/orderflow';

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export interface CdContact {
  id: string;
  org_id: string;
  customer_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CdDeliveryAddress {
  id: string;
  org_id: string;
  customer_id: string;
  nickname: string | null;
  street: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  instructions: string | null;
  is_default: boolean;
  created_at: string;
}

/** One printable line for an address (nickname omitted). */
export function formatAddress(a: Pick<CdDeliveryAddress, 'street' | 'suburb' | 'city' | 'province' | 'postal_code'>): string {
  return [a.street, a.suburb, a.city, a.province, a.postal_code].filter(Boolean).join(', ');
}

/** Products & services live in pp_stock_items; core-data.sql adds these columns. */
export interface CdProduct extends StockItem {
  subcategory?: string | null;
  sku?: string | null;
  /** Null = the org default VAT rate applies. */
  vat_rate?: number | null;
  active?: boolean;
  /** 'product' | 'service' */
  kind?: string;
  notes?: string | null;
}

export type ProductKind = 'product' | 'service';

export const PRODUCT_UNIT_TYPES = ['kg', 'box', 'punnet', 'bag', 'each', 'bunch', 'litre', 'service', 'other'] as const;

export interface CdPaymentTerm {
  id: string;
  org_id: string;
  name: string;
  days: number;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface CdVatRate {
  id: string;
  org_id: string;
  name: string;
  rate: number;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface CdCompanyProfile {
  org_id: string;
  company_name: string | null;
  vat_number: string | null;
  registration_number: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  /** Logo as a base64 data URL (bounded client-side before upload). */
  logo_data: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  swift: string | null;
  invoice_footer: string | null;
  terms: string | null;
  updated_at: string;
}

export const EMPTY_COMPANY_PROFILE: CdCompanyProfile = {
  org_id: '',
  company_name: null,
  vat_number: null,
  registration_number: null,
  address: null,
  email: null,
  phone: null,
  logo_data: null,
  bank_name: null,
  account_name: null,
  account_number: null,
  branch_code: null,
  swift: null,
  invoice_footer: null,
  terms: null,
  updated_at: '',
};

/** True when any banking field is filled in (controls the document "pay to" block). */
export function hasBankDetails(p: CdCompanyProfile | null | undefined): boolean {
  return !!(p && (p.bank_name || p.account_name || p.account_number || p.branch_code || p.swift));
}

export type DocTemplateType = 'invoice' | 'quote' | 'delivery_note' | 'credit_note' | 'statement';

export interface CdDocTemplate {
  id: string;
  org_id: string;
  template_type: DocTemplateType;
  name: string;
  /** 'left' | 'right' | 'center' */
  logo_placement: string;
  footer_text: string | null;
  terms: string | null;
  is_default: boolean;
  created_at: string;
}

export const DOC_TEMPLATE_TYPES: { value: DocTemplateType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'delivery_note', label: 'Delivery note' },
  { value: 'credit_note', label: 'Credit note' },
  { value: 'statement', label: 'Statement' },
];

// ---------------------------------------------------------------------------
// Price lists — extensions over pricepilot.ts types
// ---------------------------------------------------------------------------

/** pl_price_lists + core-data.sql extensions. */
export interface CdPriceList extends PlPriceList {
  notes?: string | null;
}

/** pl_overrides + core-data.sql's absolute-price column. */
export interface CdPriceOverride extends PlOverride {
  /** Absolute selling price in rands. When set it wins over margin pricing. */
  custom_price?: number | null;
}

export type PriceListStatus = 'active' | 'scheduled' | 'expired';

/** Active / Scheduled / Expired from the validity window (no window = always active). */
export function priceListStatus(list: Pick<CdPriceList, 'valid_from' | 'valid_until'>, now: Date = new Date()): PriceListStatus {
  const today = now.toISOString().slice(0, 10);
  if (list.valid_from && list.valid_from > today) return 'scheduled';
  if (list.valid_until && list.valid_until < today) return 'expired';
  return 'active';
}

export const PRICE_LIST_STATUS_STYLE: Record<PriceListStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Active' },
  scheduled: { bg: '#E6F1FB', fg: '#0C447C', label: 'Scheduled' },
  expired: { bg: '#F3E7E7', fg: '#8A4A4A', label: 'Expired' },
};

// ---------------------------------------------------------------------------
// Price resolution — the ONE way a selling price is derived everywhere
// (quote/order/invoice builders, price-list pages, doc-driven order sync).
// ---------------------------------------------------------------------------

export type PriceSource = 'custom' | 'override_margin' | 'list_margin' | 'base' | 'none';

export interface ResolvedPrice {
  price: number;
  source: PriceSource;
  /** The price list the price came from, when any. */
  listId: string | null;
  listName: string | null;
}

/**
 * The price list that applies to a customer: their explicit default list if it
 * is currently valid, else the newest currently-valid list linked to them,
 * else the org's base list (standard/oldest, per PricePilot's pickBaseList).
 */
export function customerPriceList(
  customer: Pick<OfCustomer, 'id' | 'default_price_list_id'> | null,
  lists: CdPriceList[],
  now: Date = new Date(),
): CdPriceList | null {
  if (customer?.default_price_list_id) {
    const explicit = lists.find((l) => l.id === customer.default_price_list_id);
    if (explicit && priceListStatus(explicit, now) === 'active') return explicit;
  }
  if (customer) {
    const own = lists
      .filter((l) => l.customer_id === customer.id && priceListStatus(l, now) === 'active')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (own[0]) return own[0];
  }
  const active = lists.filter((l) => !l.customer_id && priceListStatus(l, now) === 'active');
  const standard = active.find((l) => l.cadence === 'standard');
  if (standard) return standard;
  return active.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0] ?? null;
}

/**
 * Resolve a product's selling price for a customer:
 *   1. override custom_price on the customer's list  (absolute, wins outright;
 *      a null/zero/negative custom_price is treated as UNSET and falls through)
 *   2. override margin_pct on the customer's list    (base cost × (1 + margin))
 *   3. the list's default_margin_pct
 *   4. the product's own avg_unit_price              (no list applies)
 */
export function resolvePrice(
  product: Pick<CdProduct, 'id' | 'avg_unit_price'>,
  list: CdPriceList | null,
  overrides: CdPriceOverride[],
): ResolvedPrice {
  const base = Number(product.avg_unit_price) || 0;
  if (list) {
    const ov = overrides.find((o) => o.price_list_id === list.id && o.stock_item_id === product.id);
    if (ov && ov.custom_price != null && Number(ov.custom_price) > 0) {
      return { price: round2(Number(ov.custom_price)), source: 'custom', listId: list.id, listName: list.name };
    }
    if (ov) {
      return { price: round2(sellPrice(base, Number(ov.margin_pct))), source: 'override_margin', listId: list.id, listName: list.name };
    }
    return { price: round2(sellPrice(base, Number(list.default_margin_pct))), source: 'list_margin', listId: list.id, listName: list.name };
  }
  if (base > 0) return { price: round2(base), source: 'base', listId: null, listName: null };
  return { price: 0, source: 'none', listId: null, listName: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Doc-U Databases registry — drives the Databases index + per-entity pages
// ---------------------------------------------------------------------------

export type DbEntityKey =
  | 'customers'
  | 'contacts'
  | 'addresses'
  | 'products'
  | 'price-lists'
  | 'payment-terms'
  | 'vat'
  | 'company'
  | 'templates';

export interface DbEntityMeta {
  key: DbEntityKey;
  label: string;
  description: string;
  /** Physical table(s), shown on the card for transparency. */
  tables: string;
  csv: boolean;
}

export const DB_ENTITIES: DbEntityMeta[] = [
  { key: 'customers', label: 'Customers', description: 'Companies you sell to — billing details, terms, credit and tags.', tables: 'of_customers', csv: true },
  { key: 'contacts', label: 'Contacts', description: 'People at each customer — buyers, accounts, WhatsApp numbers.', tables: 'cd_contacts', csv: true },
  { key: 'addresses', label: 'Delivery addresses', description: 'Where each customer receives goods, with delivery instructions.', tables: 'cd_delivery_addresses', csv: true },
  { key: 'products', label: 'Products & services', description: 'Everything you sell — units, categories, SKUs and default prices.', tables: 'pp_stock_items', csv: true },
  { key: 'price-lists', label: 'Price lists', description: 'Customer-specific pricing with margins, custom prices and validity.', tables: 'pl_price_lists · pl_overrides', csv: true },
  { key: 'payment-terms', label: 'Payment terms', description: 'Named terms (COD, 30 days…) that drive invoice due dates.', tables: 'cd_payment_terms', csv: false },
  { key: 'vat', label: 'VAT settings', description: 'Tax rates and categories applied on documents.', tables: 'cd_vat_rates', csv: false },
  { key: 'company', label: 'Company profile', description: 'Your business identity, banking details and logo on documents.', tables: 'cd_company_profile', csv: false },
  { key: 'templates', label: 'Document templates', description: 'Layout, footer text and terms per document type.', tables: 'cd_doc_templates', csv: false },
];

export const DB_ENTITY_BY_KEY: Record<string, DbEntityMeta> = Object.fromEntries(DB_ENTITIES.map((e) => [e.key, e]));
