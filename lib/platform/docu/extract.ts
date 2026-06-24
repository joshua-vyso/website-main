/**
 * Small readers over a document's extracted_data — shared by the flags,
 * confidence, supplier-match and supplier-intel derivations.
 */
import type { Document } from '@/lib/platform/types';

type HasExtract = Pick<Document, 'extracted_data'>;

/** Value of the first extracted field whose label matches any pattern (case-insensitive substring). */
export function findFieldValue(doc: HasExtract, ...patterns: string[]): string | null {
  const fields = doc.extracted_data?.fields ?? [];
  for (const p of patterns) {
    const hit = fields.find((f) => f.label.toLowerCase().includes(p.toLowerCase()));
    if (hit?.value) return hit.value;
  }
  return null;
}

/** Confidence of the first extracted field whose label matches any pattern. */
export function findFieldConfidence(doc: HasExtract, ...patterns: string[]): number | null {
  const fields = doc.extracted_data?.fields ?? [];
  for (const p of patterns) {
    const hit = fields.find((f) => f.label.toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit.confidence;
  }
  return null;
}

/** Parse a Rand-ish string ("R8 240.00", "R 16,640", "1 234.50") to a number. */
export function parseAmount(s: string | null | undefined): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Document total: prefer an extracted "Total" field, else sum line-item amounts. */
export function docTotal(doc: HasExtract): number | null {
  const t = parseAmount(findFieldValue(doc, 'total', 'amount due', 'grand total'));
  if (t != null) return t;
  const lines = doc.extracted_data?.line_items ?? [];
  if (lines.length === 0) return null;
  const sum = lines.reduce((acc, l) => acc + (parseAmount(l.amount) ?? 0), 0);
  return sum || null;
}

/** Mean confidence across extracted fields (0–100), or null. */
export function avgFieldConfidence(doc: HasExtract): number | null {
  const fields = doc.extracted_data?.fields ?? [];
  if (fields.length === 0) return null;
  return Math.round(fields.reduce((s, f) => s + (f.confidence ?? 0), 0) / fields.length);
}
