/**
 * Smart search (feature 8). Parses natural-ish queries into a structured filter
 * and applies it client-side. `parseSearch` is isolated so a future
 * `/api/ai/search` (semantic) can replace it without touching callers.
 */
import type { DocumentType, DocumentWithSupplier } from '@/lib/platform/types';
import type { FlagKind, ParsedSearch } from './types';
import { docTotal } from './extract';

export const SEARCH_EXAMPLES = [
  'Metro invoices above R50k',
  'delivery notes from last week',
  'statements mentioning credit',
  'documents with price spikes',
];

const TYPE_WORDS: [RegExp, DocumentType][] = [
  [/delivery\s*notes?/, 'delivery_note'],
  [/price\s*lists?/, 'price_list'],
  [/invoices?/, 'invoice'],
  [/statements?/, 'statement'],
  [/orders?/, 'order'],
];

const OPERATOR_WORDS =
  /(invoices?|statements?|delivery\s*notes?|price\s*lists?|orders?|above|over|more\s*than|with|price\s*spikes?|duplicates?|credit\s*notes?|from|last\s*(?:week|month)|mentioning|r?\s*[\d.,]+\s*[km]?)/g;

export function parseSearch(query: string): ParsedSearch {
  const text = query.trim();
  const lower = text.toLowerCase();
  const parsed: ParsedSearch = { text };

  for (const [re, type] of TYPE_WORDS) {
    if (re.test(lower)) {
      parsed.docType = type;
      break;
    }
  }

  const amt = lower.match(/(?:above|over|more than|>)\s*r?\s*([\d.,]+)\s*(k|m)?/);
  if (amt) {
    let n = Number(amt[1].replace(/,/g, ''));
    if (amt[2] === 'k') n *= 1000;
    if (amt[2] === 'm') n *= 1_000_000;
    if (Number.isFinite(n)) parsed.minAmount = n;
  }

  if (/price\s*spikes?/.test(lower)) parsed.flag = 'price_spike';
  else if (/duplicates?/.test(lower)) parsed.flag = 'duplicate_invoice';
  else if (/credit/.test(lower)) parsed.flag = 'credit_note';

  return parsed;
}

/** Free-text remainder once operators are stripped — the "what" of the query. */
function freeTerms(parsed: ParsedSearch): string[] {
  return parsed.text
    .toLowerCase()
    .replace(OPERATOR_WORDS, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/**
 * Apply the parsed query. Flag filtering (`parsed.flag`) is left to the caller,
 * which already computes per-row flags for the table.
 */
export function applySearch(
  docs: DocumentWithSupplier[],
  parsed: ParsedSearch,
): DocumentWithSupplier[] {
  const terms = freeTerms(parsed);
  return docs.filter((d) => {
    if (parsed.docType && d.document_type !== parsed.docType) return false;
    if (parsed.minAmount != null) {
      const t = docTotal(d);
      if (t == null || t < parsed.minAmount) return false;
    }
    if (terms.length > 0) {
      const hay = [
        d.filename,
        d.supplier?.name ?? '',
        ...(d.extracted_data?.fields ?? []).map((f) => `${f.label} ${f.value}`),
        ...(d.extracted_data?.line_items ?? []).map((l) => l.description),
      ]
        .join(' ')
        .toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export type { FlagKind };
