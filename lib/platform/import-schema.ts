/**
 * Core Data import schema — the target fields each import entity can map to,
 * with header aliases for auto-mapping and value coercion. Shared by the import
 * wizard (grid + mapping), the AI assist endpoint, and the confirm-write.
 *
 * Mapping is many-source → one-target: several spreadsheet columns can map to the
 * same field (e.g. "Bill to 1".."Bill to 5" → billing_address), in which case
 * their non-empty values are JOINED. A column can also be dropped (mapped to '').
 */

export type ImportEntity = 'customers' | 'products';
export type ImportFieldType = 'text' | 'number' | 'boolean' | 'vat_treatment' | 'account_status' | 'vat_rate';

export interface ImportField {
  /** Column on the DB row (of_customers / pp_stock_items). */
  key: string;
  label: string;
  type: ImportFieldType;
  required?: boolean;
  /** How joined multi-column values are separated (default ', '). */
  join?: string;
  /** Lowercased header aliases (QuickBooks names) for auto-mapping. */
  aliases: string[];
}

export interface ImportEntityDef {
  entity: ImportEntity;
  label: string;
  table: string;
  /** Field key used to skip rows that already exist (by normalized value). */
  dedupeKey: string;
  fields: ImportField[];
}

export const IMPORT_ENTITIES: Record<ImportEntity, ImportEntityDef> = {
  customers: {
    entity: 'customers',
    label: 'Customers',
    table: 'of_customers',
    dedupeKey: 'name',
    fields: [
      { key: 'name', label: 'Customer name', type: 'text', required: true, aliases: ['customer', 'name', 'customer name', 'client'] },
      { key: 'trading_name', label: 'Trading / company name', type: 'text', aliases: ['company', 'trading name', 'trading as'] },
      { key: 'account_status', label: 'Account status', type: 'account_status', aliases: ['active status', 'status', 'active'] },
      { key: 'email', label: 'Email', type: 'text', aliases: ['main email', 'email', 'e-mail'] },
      { key: 'phone', label: 'Phone', type: 'text', aliases: ['main phone', 'phone', 'telephone', 'tel'] },
      { key: 'alt_phone', label: 'Alt. phone', type: 'text', aliases: ['alt. phone', 'alt phone', 'alternate phone', 'mobile', 'cell'] },
      { key: 'fax', label: 'Fax', type: 'text', aliases: ['fax'] },
      { key: 'contact_name', label: 'Contact name', type: 'text', join: ' ', aliases: ['first name', 'last name', 'primary contact', 'contact', 'contact name', 'm.i.'] },
      { key: 'contact_title', label: 'Contact title', type: 'text', aliases: ['job title', 'title', 'role'] },
      { key: 'billing_address', label: 'Billing address', type: 'text', join: ', ', aliases: ['bill to 1', 'bill to 2', 'bill to 3', 'bill to 4', 'bill to 5', 'billing address', 'address'] },
      { key: 'delivery_address', label: 'Delivery address', type: 'text', join: ', ', aliases: ['ship to 1', 'ship to 2', 'ship to 3', 'ship to 4', 'ship to 5', 'delivery address', 'shipping address'] },
      { key: 'invoice_terms_text', label: 'Payment terms', type: 'text', aliases: ['terms', 'payment terms'] },
      { key: 'vat_treatment', label: 'VAT treatment', type: 'vat_treatment', aliases: ['vat code', 'vat', 'tax code'] },
      { key: 'vat_number', label: 'VAT number', type: 'text', aliases: ['vat registration number', 'vat number', 'vat reg', 'vat #', 'vat#'] },
      { key: 'account_code', label: 'Account code', type: 'text', aliases: ['account no.', 'account no', 'account number', 'account code'] },
      { key: 'credit_limit', label: 'Credit limit', type: 'number', aliases: ['credit limit'] },
      { key: 'opening_balance', label: 'Opening balance', type: 'number', aliases: ['balance (zar)', 'balance total (zar)', 'balance', 'balance total', 'opening balance'] },
      { key: 'currency', label: 'Currency', type: 'text', aliases: ['currency'] },
      { key: 'notes', label: 'Notes', type: 'text', aliases: ['notes', 'note', 'comments'] },
    ],
  },
  products: {
    entity: 'products',
    label: 'Products',
    table: 'pp_stock_items',
    dedupeKey: 'name',
    fields: [
      { key: 'name', label: 'Product name', type: 'text', required: true, aliases: ['item', 'name', 'product', 'product name'] },
      { key: 'notes', label: 'Description', type: 'text', aliases: ['description', 'purchase description', 'desc'] },
      { key: 'active', label: 'Active', type: 'boolean', aliases: ['active status', 'active', 'status'] },
      { key: 'unit', label: 'Unit', type: 'text', aliases: ['unit', 'uom', 'unit of measure'] },
      { key: 'vat_rate', label: 'VAT rate', type: 'vat_rate', aliases: ['vat code', 'vat', 'tax code'] },
      { key: 'avg_unit_price', label: 'Selling price', type: 'number', aliases: ['price', 'sales price', 'sell price', 'unit price'] },
      { key: 'cost', label: 'Cost', type: 'number', aliases: ['cost', 'purchase cost', 'buy price'] },
      { key: 'sku', label: 'SKU', type: 'text', aliases: ['sku', 'code', 'item code'] },
      { key: 'category', label: 'Category', type: 'text', aliases: ['category', 'type', 'group'] },
    ],
  },
};

/** Normalise a value for dedupe / matching. */
export function normImport(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A header → field-key auto-guess using the field aliases (many-source → one-target OK). */
export function guessFieldForHeader(header: string, def: ImportEntityDef): string {
  const h = normImport(header);
  if (!h) return '';
  for (const f of def.fields) {
    for (const a of [f.key, f.label, ...f.aliases]) {
      if (normImport(a) === h) return f.key;
    }
  }
  // loose contains match
  for (const f of def.fields) {
    for (const a of f.aliases) {
      const na = normImport(a);
      if (na.length >= 3 && (h.includes(na) || na.includes(h))) return f.key;
    }
  }
  return '';
}

/** Coerce a raw cell string to the DB value for a field type. Empty → null. */
export function coerceField(raw: unknown, type: ImportFieldType): string | number | boolean | null {
  const v = String(raw ?? '').trim();
  if (v === '') return null;
  switch (type) {
    case 'number': {
      const n = Number(v.replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean':
      return /^(active|1|true|yes|y)$/i.test(v);
    case 'account_status':
      return /^(active|1|true|yes)$/i.test(v) ? 'active' : 'inactive';
    case 'vat_treatment':
      return /^z/i.test(v) ? 'zero_rated' : /^e/i.test(v) ? 'exempt' : 'standard';
    case 'vat_rate':
      return /^z/i.test(v) ? 0 : /^e/i.test(v) ? 0 : /^s/i.test(v) ? 15 : Number(v.replace(/[^0-9.\-]/g, '')) || 0;
    default:
      return v;
  }
}
