/**
 * Minimal CSV parse/serialize for Core Data import/export (RFC 4180-ish:
 * quoted fields, escaped quotes, CRLF/LF, trailing newline). No dependency —
 * QuickBooks/Excel exports are simple enough that a real parser lib is overkill.
 */

export interface ParsedCsv {
  headers: string[];
  /** Rows as arrays aligned to headers (short rows padded with ''). */
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 BOM (Excel adds one).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  // Drop fully-empty trailing rows.
  while (rows.length && rows[rows.length - 1].every((f) => f.trim() === '')) rows.pop();
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1).map((r) => {
    const out = r.map((f) => f.trim());
    while (out.length < headers.length) out.push('');
    return out.slice(0, headers.length);
  });
  return { headers, rows: body };
}

function escapeField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const r of rows) lines.push(r.map((v) => escapeField(v == null ? '' : String(v))).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Trigger a client-side download of a CSV file. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Column mapping — a target field an import wants, with alias guessing so
// QuickBooks/Excel headers map themselves ("Company Name" → name, etc.)
// ---------------------------------------------------------------------------

export interface CsvField {
  /** Target key on the imported record. */
  key: string;
  label: string;
  required?: boolean;
  /** Lowercased header aliases that auto-map to this field. */
  aliases?: string[];
  /** 'text' (default) | 'number' | 'boolean' */
  type?: 'text' | 'number' | 'boolean';
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Guess header → field mapping. Returns { [field.key]: headerIndex | -1 }. */
export function guessMapping(headers: string[], fields: CsvField[]): Record<string, number> {
  const normed = headers.map(norm);
  const used = new Set<number>();
  const out: Record<string, number> = {};
  for (const f of fields) {
    const wants = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    let idx = -1;
    for (const w of wants) {
      const exact = normed.findIndex((h, i) => !used.has(i) && h === w);
      if (exact >= 0) { idx = exact; break; }
    }
    if (idx < 0) {
      for (const w of wants) {
        const partial = normed.findIndex((h, i) => !used.has(i) && w.length >= 3 && (h.includes(w) || w.includes(h)) && h.length > 0);
        if (partial >= 0) { idx = partial; break; }
      }
    }
    if (idx >= 0) used.add(idx);
    out[f.key] = idx;
  }
  return out;
}

/** Apply a mapping to a row → record of field key → raw string value. */
export function applyMapping(row: string[], mapping: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, idx] of Object.entries(mapping)) out[key] = idx >= 0 ? (row[idx] ?? '') : '';
  return out;
}

/** Parse a raw CSV value by field type. Empty → null. */
export function coerceValue(raw: string, type: CsvField['type']): string | number | boolean | null {
  const v = raw.trim();
  if (v === '') return null;
  if (type === 'number') {
    const n = Number(v.replace(/[R\s,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') return /^(1|true|yes|y)$/i.test(v);
  return v;
}
