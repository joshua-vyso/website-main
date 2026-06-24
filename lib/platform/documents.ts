/**
 * Document-type metadata driving the Doc-U Hub tiles, type-filter tabs/chips,
 * and KPI computations. Tints sampled from the Figma "Doc-U Mobile / Hub" screen.
 * Mirrored into each app's lib folder.
 */
import type { Document, DocumentType } from './types';

export interface DocTypeMeta {
  /** null = the "All" pseudo-type. */
  key: DocumentType | null;
  /** Plural label for tiles/tabs. */
  label: string;
  /** Tinted tile background. */
  tint: string;
  /** Icon chip background. */
  iconBg: string;
}

export const DOC_TYPES: readonly DocTypeMeta[] = [
  { key: null, label: 'All', tint: '#E9EFEC', iconBg: '#1E5E54' },
  { key: 'invoice', label: 'Invoices', tint: '#E6F1FB', iconBg: '#0C447C' },
  { key: 'statement', label: 'Statements', tint: '#E1F5EE', iconBg: '#0F6E56' },
  { key: 'delivery_note', label: 'Delivery notes', tint: '#FBEEDA', iconBg: '#854F0B' },
  { key: 'price_list', label: 'Price lists', tint: '#ECEAFB', iconBg: '#5B4FD6' },
  { key: 'order', label: 'Orders', tint: '#FBE7EC', iconBg: '#C0345A' },
];

/**
 * Vyso's built-in "default" folders — the document categories every account
 * gets, mirroring the document types. Custom folders are anything a user creates
 * whose name isn't one of these. (Folders are matched by name.)
 */
export const DEFAULT_FOLDERS: readonly { name: string; color: string }[] = DOC_TYPES.filter(
  (t) => t.key !== null,
).map((t) => ({ name: t.label, color: t.iconBg }));

export const DEFAULT_FOLDER_NAMES: readonly string[] = DEFAULT_FOLDERS.map((f) => f.name);

/** Is this folder name one of the built-in default categories? */
export function isDefaultFolderName(name: string): boolean {
  return DEFAULT_FOLDER_NAMES.includes(name);
}

/** Singular, human-readable label for a document type (table "Type" column). */
export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Invoice',
  statement: 'Statement',
  delivery_note: 'Delivery note',
  price_list: 'Price list',
  order: 'Order',
};

/**
 * Display label for a document's type, preferring a user-set custom type
 * (extracted_data.custom_type) over the built-in category. Falls back to the
 * raw value title-cased, then "—".
 */
export function documentTypeLabel(doc: Pick<Document, 'document_type' | 'extracted_data'>): string {
  const custom = (doc.extracted_data as { custom_type?: string } | null)?.custom_type?.trim();
  if (custom) return custom;
  const t = doc.document_type;
  if (!t) return '—';
  return (DOC_TYPE_LABEL as Record<string, string>)[t] ?? t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** KPI roll-ups computed from a document set — shared by web + mobile. */
export interface DocKpis {
  total: number;
  awaiting: number;
  flagged: number;
  avgConfidence: number | null;
}

export function computeKpis(docs: Pick<Document, 'status' | 'confidence'>[]): DocKpis {
  const withConfidence = docs.filter(
    (d): d is typeof d & { confidence: number } => typeof d.confidence === 'number',
  );
  const avg =
    withConfidence.length > 0
      ? Math.round(
          withConfidence.reduce((sum, d) => sum + d.confidence, 0) / withConfidence.length,
        )
      : null;
  return {
    total: docs.length,
    // "Awaiting review" = extracted + pending (per the Figma KPI sublabel).
    awaiting: docs.filter((d) => d.status === 'extracted' || d.status === 'pending').length,
    // "Flagged" = error status (needs attention).
    flagged: docs.filter((d) => d.status === 'error').length,
    avgConfidence: avg,
  };
}

/** Count documents per type, including the `null` ("All") bucket. */
export function countByType(
  docs: Pick<Document, 'document_type'>[],
  type: DocumentType | null,
): number {
  if (type === null) return docs.length;
  return docs.filter((d) => d.document_type === type).length;
}
