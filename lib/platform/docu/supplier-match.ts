/**
 * Supplier auto-matching (feature 2). Resolves a raw/alias supplier string to a
 * canonical name with a confidence. Alias table is seeded + editable.
 */
import type { Document } from '@/lib/platform/types';
import type { SupplierMatch } from './types';
import { findFieldValue } from './extract';

/** alias (lowercased) → canonical display name. */
export const SUPPLIER_ALIASES: Record<string, string> = {
  'metro fresh produce': 'Metro',
  'metro fresh': 'Metro',
  metro: 'Metro',
  'rsa market': 'RSA',
  'rsa group': 'RSA',
  rsa: 'RSA',
  'jhb fresh produce market': 'JHB Fresh Produce Mkt',
  'jhb fresh produce mkt': 'JHB Fresh Produce Mkt',
  'jhb market': 'JHB Fresh Produce Mkt',
  jhb: 'JHB Fresh Produce Mkt',
  'karsten farms': 'Karsten Farms',
  karsten: 'Karsten Farms',
  subtropico: 'Subtropico',
  'dd fruits & veg': 'DD Fruits & Veg',
  'dd fruits and veg': 'DD Fruits & Veg',
  'dd fruits': 'DD Fruits & Veg',
  'dice & dine': 'Dice & Dine',
  'dice and dine': 'Dice & Dine',
};

const CANONICALS = [...new Set(Object.values(SUPPLIER_ALIASES))];

function norm(s: string): string {
  return s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

/** Resolve a raw supplier string → canonical + confidence (0–100). */
export function resolveSupplier(raw: string | null | undefined): SupplierMatch {
  if (!raw || !raw.trim()) return { canonical: null, confidence: 0, matched: false, raw: raw ?? null };
  const n = norm(raw);

  // exact canonical
  const exact = CANONICALS.find((c) => norm(c) === n);
  if (exact) return { canonical: exact, confidence: 100, matched: false, raw };

  // alias hit
  if (SUPPLIER_ALIASES[n]) return { canonical: SUPPLIER_ALIASES[n], confidence: 92, matched: true, raw };

  // alias substring (e.g. "metro fresh produce ltd")
  for (const [alias, canonical] of Object.entries(SUPPLIER_ALIASES)) {
    if (n.includes(alias)) return { canonical, confidence: 84, matched: true, raw };
  }

  // token overlap fuzzy
  const tokens = new Set(n.split(' '));
  let best: { canonical: string; score: number } | null = null;
  for (const c of CANONICALS) {
    const ct = norm(c).split(' ');
    const overlap = ct.filter((t) => tokens.has(t)).length;
    const score = overlap / Math.max(ct.length, 1);
    if (score > 0 && (!best || score > best.score)) best = { canonical: c, score };
  }
  if (best && best.score >= 0.5) {
    return { canonical: best.canonical, confidence: Math.round(60 + best.score * 20), matched: true, raw };
  }

  return { canonical: null, confidence: 0, matched: false, raw };
}

/** Infer a supplier for a document from its extracted "Supplier" field. */
export function inferSupplierFromDoc(doc: Pick<Document, 'extracted_data'>): SupplierMatch {
  return resolveSupplier(findFieldValue(doc, 'supplier', 'from', 'vendor'));
}
