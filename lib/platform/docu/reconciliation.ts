import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { DocuExtractedData, StatementSummary } from './types';

/** Format a number as Rand, or "—" when absent. */
export function fmtZar(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Ordered labels for the statement totals card. */
export const SUMMARY_ROWS: { key: keyof StatementSummary; label: string }[] = [
  { key: 'opening_balance', label: 'Opening balance' },
  { key: 'payments', label: 'Payments' },
  { key: 'total_purchases', label: 'Total purchases (incl. VAT)' },
  { key: 'total_pallet_refunds', label: 'Total pallet refunds' },
  { key: 'total_pallet_usage', label: 'Total pallet usage' },
  { key: 'vat', label: 'VAT on purchases' },
  { key: 'total_charges', label: 'Total charges' },
  { key: 'closing_balance', label: 'Closing balance' },
];

/** One reconciliation row, derived from a statement document's parsed summary. */
export interface ReconRow {
  id: string;
  date: string;
  supplier: string;
  opening: number | null;
  payments: number | null;
  purchases: number | null;
  palletRefunds: number | null;
  palletUsage: number | null;
  vat: number | null;
  closing: number | null;
  /** The statement's own audit error ("check in balance"); ~0 when balanced. */
  check: number | null;
}

function abs(n: number | null): number | null {
  return n == null ? null : Math.abs(n);
}

/** Build a reconciliation row from a document, or null if it has no summary. */
export function toReconRow(doc: DocumentWithSupplier): ReconRow | null {
  const s = (doc.extracted_data as DocuExtractedData | null)?.summary;
  if (!s) return null;
  return {
    id: doc.id,
    date: s.statement_date ?? doc.created_at,
    supplier: doc.supplier?.name ?? '—',
    opening: s.opening_balance,
    payments: s.payments,
    purchases: abs(s.total_purchases),
    palletRefunds: abs(s.total_pallet_refunds),
    palletUsage: abs(s.total_pallet_usage),
    vat: abs(s.vat),
    closing: s.closing_balance,
    check: s.audit_error,
  };
}

const CSV_HEADERS = [
  'Date',
  'Supplier',
  'Opening Balance',
  'Payments',
  'Total Purchases',
  'Total Pallet Refunds',
  'Total Pallet Usage',
  'VAT on Purchases',
  'Closing Balance',
  'Check in Balance',
];

function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(v) : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build the purchases-summary CSV (one row per statement, sorted by date). */
export function buildReconciliationCsv(rows: ReconRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.supplier,
        r.opening,
        r.payments,
        r.purchases,
        r.palletRefunds,
        r.palletUsage,
        r.vat,
        r.closing,
        r.check,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}
