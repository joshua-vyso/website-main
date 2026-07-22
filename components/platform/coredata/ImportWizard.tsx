'use client';

/**
 * Reusable Excel / CSV import wizard for Core Data (of_customers / pp_stock_items).
 *
 * Flow (nothing writes until Confirm):
 *  1. Entity + file — pick Customers or Products, upload .xlsx or .csv. CSV is
 *     parsed client-side (parseCsv); .xlsx is POSTed to /api/import/parse-xlsx.
 *     Row 0 becomes the headers, the rest the data.
 *  2. Edit grid — a paginated, inline-editable staging table. Each column has a
 *     field-mapping <select> + a drop toggle. Empty columns auto-drop and hide;
 *     the rest auto-map via guessFieldForHeader. Deterministic (no-AI) flags warn
 *     about missing-required, duplicate dedupeKey, and malformed emails. AI assist
 *     panel can auto-map or run a plain-language command (client applies the ops).
 *  3. Confirm — for each row + target field, JOIN every column mapped to that
 *     field, coerceField by type, skip rows missing a required field or that
 *     duplicate an existing/earlier dedupeKey, then chunked insert with the
 *     drop-missing-column retry (works before import-fields.sql is run).
 *
 * The map→coerce→dedupe→write pipeline is the load-bearing part; the UI wraps it.
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { parseCsv } from '@/lib/platform/csv';
import {
  IMPORT_ENTITIES,
  guessFieldForHeader,
  coerceField,
  normImport,
  type ImportEntity,
  type ImportEntityDef,
  type ImportField,
} from '@/lib/platform/import-schema';
import { useToast } from '@/components/platform/orderflow/ui';
import { PrimaryBtn, SecondaryBtn, EmptyState } from './ui';

// ---------------------------------------------------------------------------
// Constants + types
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;
const CHUNK_SIZE = 200;
const DROP = ''; // the "— (drop)" field value

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Column {
  header: string;
  field: string; // '' = dropped
  dropped: boolean;
}

type Step = 'source' | 'grid' | 'summary';

interface ImportSummary {
  inserted: number;
  skippedDuplicate: number;
  skippedMissing: number;
  errors: number;
  errorMessage?: string;
  /** Mapped columns the DB didn't have, so they were dropped to let the row insert. The
   *  rows landed, but WITHOUT these fields — the operator must be told, not silently lied to. */
  droppedColumns?: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Drop-missing-column write (mirror of PriceListsView.writeArrayDroppingMissing)
// ---------------------------------------------------------------------------

const MISSING_COLUMN_RE = /column|schema cache|could not find|does not exist/i;

function missingColumnName(msg: string): string | null {
  const m = /'([^']+)' column/i.exec(msg) ?? /column "?([a-zA-Z0-9_]+)"?/.exec(msg);
  return m ? m[1] : null;
}

/** Insert a batch, transparently dropping any columns the DB doesn't have yet. */
async function insertDroppingMissing(
  build: (rows: Record<string, any>[]) => PromiseLike<{ error: { message: string } | null }>,
  rows: Record<string, any>[],
): Promise<{ error: { message: string } | null; dropped: string[] }> {
  let working = rows.map((r) => ({ ...r }));
  const dropped: string[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await build(working);
    if (!res.error) return { error: null, dropped };
    const col = missingColumnName(res.error.message);
    if (!col || !working.some((r) => col in r)) return { error: res.error, dropped };
    working = working.map((r) => {
      const c = { ...r };
      delete c[col];
      return c;
    });
    dropped.push(col);
  }
  return { error: { message: 'Too many missing columns — run the import-fields.sql migration.' }, dropped };
}

// ---------------------------------------------------------------------------
// Pipeline — map → coerce → dedupe (pure, testable helpers)
// ---------------------------------------------------------------------------

/**
 * Resolve one data row to a { fieldKey: rawJoinedString } map. For each field,
 * collect the values of EVERY non-dropped column mapped to it (in column order),
 * drop empties, and JOIN with the field's separator (default ', ').
 */
function resolveRow(row: string[], columns: Column[], def: ImportEntityDef): Record<string, string> {
  const byField = new Map<string, string[]>();
  columns.forEach((col, ci) => {
    if (col.dropped || !col.field) return;
    const val = String(row[ci] ?? '').trim();
    if (val === '') return;
    const arr = byField.get(col.field) ?? [];
    arr.push(val);
    byField.set(col.field, arr);
  });
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    const vals = byField.get(f.key);
    if (vals && vals.length) out[f.key] = vals.join(f.join ?? ', ');
  }
  return out;
}

/** Coerce a resolved row into the DB payload (typed values, empty → null). */
function coerceRow(resolved: Record<string, string>, def: ImportEntityDef): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const f of def.fields) {
    if (f.key in resolved) out[f.key] = coerceField(resolved[f.key], f.type);
  }
  return out;
}

/** The dedupeKey value for a resolved row (normalised), or '' when absent. */
function dedupeValue(resolved: Record<string, string>, def: ImportEntityDef): string {
  return normImport(resolved[def.dedupeKey] ?? '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportWizard({ initialEntity }: { initialEntity: ImportEntity }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entity, setEntity] = useState<ImportEntity>(initialEntity);
  const def = IMPORT_ENTITIES[entity];

  const [step, setStep] = useState<Step>('source');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Staging grid state — columns (mapping/drop) + data (2D string array).
  const [columns, setColumns] = useState<Column[]>([]);
  const [data, setData] = useState<string[][]>([]);

  // Existing dedupeKey values already in the DB (normalised), for the dup flag.
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(0);
  const [showEmpty, setShowEmpty] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  // AI assist panel.
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState<'automap' | 'command' | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Bump on structural change so downstream memos recompute even though we mutate
  // the data array in place (uncontrolled inputs write back without re-render).
  const [rev, setRev] = useState(0);

  // -------------------------------------------------------------------------
  // Step 1 — parse a file into columns + data
  // -------------------------------------------------------------------------

  function ingestRows(rows: string[][]) {
    if (rows.length === 0) {
      setParseError('That file has no rows.');
      return;
    }
    const headerRow = rows[0] ?? [];
    const width = rows.reduce((w, r) => Math.max(w, r.length), headerRow.length);
    const headers = Array.from({ length: width }, (_, i) => String(headerRow[i] ?? '').trim());
    const body = rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? '')));

    if (body.length === 0) {
      setParseError('That file has a header row but no data rows.');
      return;
    }

    // Auto-behaviour: drop columns whose every value is empty; auto-map the rest.
    const cols: Column[] = headers.map((header, ci) => {
      const allEmpty = body.every((r) => String(r[ci] ?? '').trim() === '');
      if (allEmpty) return { header, field: DROP, dropped: true };
      const field = guessFieldForHeader(header, def);
      return { header, field, dropped: false };
    });

    setColumns(cols);
    setData(body);
    setParseError(null);
    setPage(0);
    setShowEmpty(false);
    setOnlyFlagged(false);
    setAiMessage(null);
    setAiError(null);
    setRev((r) => r + 1);
    setStep('grid');
    void loadExistingKeys();
  }

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(null);
    setFileName(file.name);
    try {
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const parsed = parseCsv(text);
        ingestRows([parsed.headers, ...parsed.rows]);
      } else {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/import/parse-xlsx', { method: 'POST', body: form });
        const json = (await res.json().catch(() => ({}))) as { rows?: string[][]; error?: string };
        if (!res.ok || !json.rows) {
          setParseError(json.error ?? "Couldn't read that file — try saving it as CSV.");
          setParsing(false);
          return;
        }
        ingestRows(json.rows);
      }
    } catch {
      setParseError("Couldn't read that file — try saving it as CSV.");
    } finally {
      setParsing(false);
    }
  }

  // Load existing dedupeKey values so the grid can flag rows that already exist.
  async function loadExistingKeys() {
    const supabase = createClient();
    if (!supabase || !org) return;
    const { data: rows, error } = await supabase.from(def.table).select(def.dedupeKey).eq('org_id', org.id);
    if (error || !rows) {
      setExistingKeys(new Set());
      return;
    }
    const keys = new Set<string>();
    for (const r of rows as unknown as Record<string, unknown>[]) {
      const v = normImport(r[def.dedupeKey]);
      if (v) keys.add(v);
    }
    setExistingKeys(keys);
  }

  // Switch entity (source step only) and clear any staged grid so a re-upload
  // starts clean against the new entity's fields.
  function changeEntity(next: ImportEntity) {
    if (next === entity) return;
    setEntity(next);
    setColumns([]);
    setData([]);
    setFileName(null);
    setParseError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // -------------------------------------------------------------------------
  // Grid derivations
  // -------------------------------------------------------------------------

  const fieldByKey = useMemo(() => new Map(def.fields.map((f) => [f.key, f])), [def]);

  const visibleColumnIdx = useMemo(
    () => columns.map((c, i) => i).filter((i) => showEmpty || !(columns[i].dropped && columns[i].field === DROP && isEmptyColumn(i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, showEmpty, rev],
  );

  function isEmptyColumn(ci: number): boolean {
    return data.every((r) => String(r[ci] ?? '').trim() === '');
  }

  const emptyHiddenCount = useMemo(
    () => columns.filter((c, i) => c.dropped && c.field === DROP && isEmptyColumn(i)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, data, rev],
  );

  const mappedFieldCount = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((c) => {
      if (!c.dropped && c.field) set.add(c.field);
    });
    return set.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rev]);

  // Per-row deterministic flags. Recomputed whenever mapping / data / existing
  // keys change (rev bumps on cell edits).
  const flags = useMemo(() => {
    const missingReq: boolean[] = [];
    const duplicate: boolean[] = [];
    const badEmail: boolean[] = [];
    const requiredFields = def.fields.filter((f) => f.required);
    const emailFields = def.fields.filter((f) => f.key === 'email');
    const seen = new Set<string>();

    for (let ri = 0; ri < data.length; ri++) {
      const resolved = resolveRow(data[ri], columns, def);

      // Missing required.
      let miss = false;
      for (const f of requiredFields) {
        const raw = resolved[f.key];
        if (!raw || String(raw).trim() === '') miss = true;
      }
      missingReq.push(miss);

      // Duplicate dedupeKey (against existing DB rows + earlier batch rows).
      const key = dedupeValue(resolved, def);
      let dup = false;
      if (key) {
        if (existingKeys.has(key) || seen.has(key)) dup = true;
        seen.add(key);
      }
      duplicate.push(dup);

      // Malformed email.
      let bad = false;
      for (const f of emailFields) {
        const raw = resolved[f.key];
        if (raw && raw.trim() !== '' && !EMAIL_RE.test(raw.trim())) bad = true;
      }
      badEmail.push(bad);
    }
    return { missingReq, duplicate, badEmail };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, data, existingKeys, def, rev]);

  const flaggedRowIdx = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (flags.missingReq[i] || flags.duplicate[i] || flags.badEmail[i]) out.push(i);
    }
    return out;
  }, [data, flags]);

  const rowIndexes = useMemo(
    () => (onlyFlagged ? flaggedRowIdx : data.map((_, i) => i)),
    [onlyFlagged, flaggedRowIdx, data],
  );

  const pageCount = Math.max(1, Math.ceil(rowIndexes.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRowIndexes = rowIndexes.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  // -------------------------------------------------------------------------
  // Grid mutations (structural → setColumns/setData + bump rev)
  // -------------------------------------------------------------------------

  function setColumnField(ci: number, field: string) {
    setColumns((cols) => cols.map((c, i) => (i === ci ? { ...c, field, dropped: field === DROP } : c)));
    setRev((r) => r + 1);
  }

  function toggleDrop(ci: number) {
    setColumns((cols) =>
      cols.map((c, i) => {
        if (i !== ci) return c;
        if (c.dropped) {
          // Un-drop: try to re-guess a field for it.
          return { ...c, dropped: false, field: guessFieldForHeader(c.header, def) };
        }
        return { ...c, dropped: true, field: DROP };
      }),
    );
    setRev((r) => r + 1);
  }

  function removeRow(ri: number) {
    setData((d) => d.filter((_, i) => i !== ri));
    setRev((r) => r + 1);
  }

  // Cell edit — write straight into the data array (uncontrolled input, onBlur),
  // then bump rev so flags/summary recompute. No per-keystroke re-render.
  function editCell(ri: number, ci: number, value: string) {
    if ((data[ri]?.[ci] ?? '') === value) return;
    setData((d) => {
      const next = d.slice();
      const row = next[ri] ? next[ri].slice() : [];
      while (row.length <= ci) row.push('');
      row[ci] = value;
      next[ri] = row;
      return next;
    });
    setRev((r) => r + 1);
  }

  // -------------------------------------------------------------------------
  // AI assist — client applies the returned mapping / ops deterministically
  // -------------------------------------------------------------------------

  function sampleRows(): string[][] {
    return data.slice(0, 15).map((r) => columns.map((_, ci) => String(r[ci] ?? '')));
  }

  async function runAutomap() {
    setAiBusy('automap');
    setAiError(null);
    setAiMessage(null);
    try {
      const res = await fetch('/api/import/assist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity, headers: columns.map((c) => c.header), sampleRows: sampleRows(), mode: 'automap' }),
      });
      const json = (await res.json().catch(() => ({}))) as { mapping?: Record<string, string>; error?: string };
      if (!res.ok) {
        setAiError(json.error ?? 'AI is unavailable.');
        return;
      }
      const mapping = json.mapping ?? {};
      const validKeys = new Set(def.fields.map((f) => f.key));
      setColumns((cols) =>
        cols.map((c, i) => {
          const raw = mapping[String(i)];
          if (raw === undefined) return c;
          const field = raw && validKeys.has(raw) ? raw : DROP;
          return { ...c, field, dropped: field === DROP };
        }),
      );
      setRev((r) => r + 1);
      setAiMessage('Columns re-mapped by AI.');
    } catch {
      setAiError('AI request failed.');
    } finally {
      setAiBusy(null);
    }
  }

  async function runCommand() {
    const instruction = aiInstruction.trim();
    if (!instruction) return;
    setAiBusy('command');
    setAiError(null);
    setAiMessage(null);
    try {
      const res = await fetch('/api/import/assist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity,
          headers: columns.map((c) => c.header),
          sampleRows: sampleRows(),
          instruction,
          mode: 'command',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ops?: any[]; message?: string; error?: string };
      if (!res.ok) {
        setAiError(json.error ?? 'AI is unavailable.');
        return;
      }
      applyOps(json.ops ?? []);
      setAiMessage(json.message ?? 'Done.');
      setAiInstruction('');
    } catch {
      setAiError('AI request failed.');
    } finally {
      setAiBusy(null);
    }
  }

  // Apply the AI's ops to columns/data deterministically. Unknown ops ignored.
  function applyOps(ops: any[]) {
    if (!Array.isArray(ops) || ops.length === 0) return;
    const validKeys = new Set(def.fields.map((f) => f.key));

    // Work on local copies, commit once.
    const nextCols = columns.map((c) => ({ ...c }));
    const nextData = data.map((r) => r.slice());

    const resolveColumnIndex = (op: any): number => {
      if (typeof op.columnIndex === 'number' && op.columnIndex >= 0 && op.columnIndex < nextCols.length) return op.columnIndex;
      if (typeof op.header === 'string') {
        const h = normImport(op.header);
        const idx = nextCols.findIndex((c) => normImport(c.header) === h);
        if (idx >= 0) return idx;
      }
      return -1;
    };

    // Columns currently mapped to a field (for setField / transform).
    const columnsForField = (field: string): number[] =>
      nextCols.map((c, i) => (!c.dropped && c.field === field ? i : -1)).filter((i) => i >= 0);

    const transformValue = (v: string, kind: string): string => {
      switch (kind) {
        case 'uppercase':
          return v.toUpperCase();
        case 'lowercase':
          return v.toLowerCase();
        case 'trim':
          return v.trim();
        case 'titlecase':
          return v.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
        default:
          return v;
      }
    };

    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      switch (op.type) {
        case 'mapColumn': {
          const ci = resolveColumnIndex(op);
          if (ci < 0) break;
          const field = typeof op.field === 'string' && validKeys.has(op.field) ? op.field : DROP;
          nextCols[ci] = { ...nextCols[ci], field, dropped: field === DROP };
          break;
        }
        case 'dropColumn': {
          const ci = resolveColumnIndex(op);
          if (ci < 0) break;
          nextCols[ci] = { ...nextCols[ci], field: DROP, dropped: true };
          break;
        }
        case 'setField': {
          if (typeof op.field !== 'string' || !validKeys.has(op.field)) break;
          const targets = columnsForField(op.field);
          const value = String(op.value ?? '');
          if (targets.length === 0) break;
          // Set the value in the FIRST mapped column of that field (others cleared
          // so the join doesn't duplicate) for every data row.
          const [primary, ...rest] = targets;
          for (const row of nextData) {
            while (row.length <= primary) row.push('');
            row[primary] = value;
            for (const c of rest) {
              while (row.length <= c) row.push('');
              row[c] = '';
            }
          }
          break;
        }
        case 'transform': {
          if (typeof op.field !== 'string' || !validKeys.has(op.field)) break;
          const kind = String(op.kind ?? '');
          const targets = columnsForField(op.field);
          for (const row of nextData) {
            for (const c of targets) {
              if (c < row.length) row[c] = transformValue(String(row[c] ?? ''), kind);
            }
          }
          break;
        }
        default:
          break; // ignore unknown ops
      }
    }

    setColumns(nextCols);
    setData(nextData);
    setRev((r) => r + 1);
  }

  // -------------------------------------------------------------------------
  // Confirm — build payloads, dedupe, chunked drop-missing insert
  // -------------------------------------------------------------------------

  async function confirmImport() {
    const supabase = createClient();
    if (!supabase || !org) {
      setSummary({ inserted: 0, skippedDuplicate: 0, skippedMissing: 0, errors: 0, errorMessage: 'Not connected.' });
      setStep('summary');
      return;
    }

    setConfirming(true);

    const requiredFields = def.fields.filter((f) => f.required);
    const seen = new Set<string>(existingKeys);
    const payloads: Record<string, any>[] = [];
    let skippedDuplicate = 0;
    let skippedMissing = 0;

    for (const row of data) {
      const resolved = resolveRow(row, columns, def);

      // Skip rows missing a required field.
      let miss = false;
      for (const f of requiredFields) {
        const raw = resolved[f.key];
        if (!raw || String(raw).trim() === '') miss = true;
      }
      if (miss) {
        skippedMissing++;
        continue;
      }

      // Dedupe against existing DB rows + earlier rows in this batch.
      const key = dedupeValue(resolved, def);
      if (key && seen.has(key)) {
        skippedDuplicate++;
        continue;
      }
      if (key) seen.add(key);

      const coerced = coerceRow(resolved, def);
      // Strip null values so we never overwrite a column's default with null
      // (and so drop-missing only ever sees columns we actually set).
      const payload: Record<string, any> = { org_id: org.id };
      for (const [k, v] of Object.entries(coerced)) {
        if (v !== null) payload[k] = v;
      }

      // Entity defaults.
      if (entity === 'products') {
        if (!('on_hand' in payload)) payload.on_hand = 0;
        if (!('low_threshold' in payload)) payload.low_threshold = 0;
        if (!('currency' in payload)) payload.currency = 'ZAR';
      }

      payloads.push(payload);
    }

    if (payloads.length === 0) {
      setConfirming(false);
      setSummary({ inserted: 0, skippedDuplicate, skippedMissing, errors: 0 });
      setStep('summary');
      return;
    }

    // Chunked insert with the drop-missing-column retry.
    let inserted = 0;
    let errors = 0;
    let errorMessage: string | undefined;
    const droppedColumns = new Set<string>();
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      const { error, dropped } = await insertDroppingMissing((rows) => supabase.from(def.table).insert(rows), chunk);
      // The rows DID insert, but any dropped column's mapped data was silently thrown
      // away to make them fit. Record it so the operator is told rather than shown a clean
      // "Imported N" over lost fields.
      for (const c of dropped) droppedColumns.add(c);
      if (error) {
        errors += chunk.length;
        if (!errorMessage) {
          errorMessage = MISSING_COLUMN_RE.test(error.message)
            ? 'Some columns need a migration — run supabase/import-fields.sql, then re-import to add them.'
            : error.message;
        }
      } else {
        inserted += chunk.length;
      }
    }

    setConfirming(false);
    setSummary({
      inserted,
      skippedDuplicate,
      skippedMissing,
      errors,
      errorMessage,
      droppedColumns: droppedColumns.size ? [...droppedColumns] : undefined,
    });
    setStep('summary');
    if (inserted > 0) {
      toast(`Imported ${inserted} ${def.label.toLowerCase()}`);
      router.refresh();
    }
  }

  // Count of rows that would actually import (pre-write estimate).
  // How the uploaded rows break down at confirm: importable / skipped-as-duplicate
  // (matches an existing DB row or an earlier row this batch) / skipped-missing-required.
  const counts = useMemo(() => {
    const requiredFields = def.fields.filter((f) => f.required);
    const seen = new Set<string>(existingKeys);
    let ok = 0;
    let dup = 0;
    let missing = 0;
    for (const row of data) {
      const resolved = resolveRow(row, columns, def);
      let miss = false;
      for (const f of requiredFields) {
        const raw = resolved[f.key];
        if (!raw || String(raw).trim() === '') miss = true;
      }
      if (miss) {
        missing++;
        continue;
      }
      const key = dedupeValue(resolved, def);
      if (key && seen.has(key)) {
        dup++;
        continue;
      }
      if (key) seen.add(key);
      ok++;
    }
    return { importable: ok, dup, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columns, existingKeys, def, rev]);
  const importable = counts.importable;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      {toastNode}

      {/* Step indicator */}
      <StepBar step={step} />

      {step === 'source' ? (
        <SourceStep
          entity={entity}
          setEntity={changeEntity}
          fileRef={fileRef}
          parsing={parsing}
          parseError={parseError}
          fileName={fileName}
          onFile={handleFile}
        />
      ) : step === 'grid' ? (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          {/* Grid column */}
          <div className="min-w-0">
            {/* Grid toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="text-[13px] text-[#5F6368]">
                <span className="font-semibold text-[#1A1C1E]">{data.length}</span> rows ·{' '}
                <span className="font-semibold text-[#1A1C1E]">{mappedFieldCount}</span> fields mapped
              </div>
              {flaggedRowIdx.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyFlagged((v) => !v);
                    setPage(0);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    onlyFlagged
                      ? 'border-[#854F0B] bg-[#854F0B] text-white'
                      : 'border-[#EBD9B0] bg-[#FBF3E4] text-[#854F0B] hover:bg-[#FDF8EF]'
                  }`}
                >
                  {flaggedRowIdx.length} need{flaggedRowIdx.length === 1 ? 's' : ''} attention
                  {onlyFlagged ? ' · show all' : ''}
                </button>
              ) : (
                <span className="text-[12px] text-[#0F6E56]">No issues detected</span>
              )}
              {emptyHiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowEmpty((v) => !v)}
                  className="rounded-lg border border-[#D7DAD8] bg-white px-2.5 py-1 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#F0F0EC]"
                >
                  {showEmpty ? 'Hide' : 'Show'} {emptyHiddenCount} empty column{emptyHiddenCount === 1 ? '' : 's'}
                </button>
              ) : null}
            </div>

            <Grid
              columns={columns}
              visibleColumnIdx={visibleColumnIdx}
              def={def}
              pageRowIndexes={pageRowIndexes}
              data={data}
              flags={flags}
              fieldByKey={fieldByKey}
              onFieldChange={setColumnField}
              onToggleDrop={toggleDrop}
              onEditCell={editCell}
              onRemoveRow={removeRow}
            />

            {/* Pagination */}
            {rowIndexes.length > PAGE_SIZE ? (
              <div className="mt-3 flex items-center justify-between text-[12px] text-[#5F6368]">
                <span>
                  Showing {clampedPage * PAGE_SIZE + 1}–{Math.min((clampedPage + 1) * PAGE_SIZE, rowIndexes.length)} of{' '}
                  {rowIndexes.length}
                </span>
                <div className="flex items-center gap-2">
                  <SecondaryBtn
                    className="h-8 px-3 text-[12px]"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={clampedPage === 0}
                  >
                    Prev
                  </SecondaryBtn>
                  <span className="tabular-nums">
                    {clampedPage + 1} / {pageCount}
                  </span>
                  <SecondaryBtn
                    className="h-8 px-3 text-[12px]"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={clampedPage >= pageCount - 1}
                  >
                    Next
                  </SecondaryBtn>
                </div>
              </div>
            ) : null}
          </div>

          {/* AI assist sidebar */}
          <AiPanel
            entityLabel={def.label}
            aiBusy={aiBusy}
            aiMessage={aiMessage}
            aiError={aiError}
            instruction={aiInstruction}
            setInstruction={setAiInstruction}
            onAutomap={runAutomap}
            onCommand={runCommand}
          />
        </div>
      ) : (
        <SummaryStep entity={entity} def={def} summary={summary} onImportMore={() => setStep('source')} />
      )}

      {/* Sticky action bar (grid step) */}
      {step === 'grid' ? (
        <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E7E2] bg-white/90 py-4 backdrop-blur">
          <div className="text-[13px] text-[#5F6368]">
            <span className="font-semibold text-[#1A1C1E]">{importable}</span> of {data.length} rows will import
            {counts.dup > 0 ? ` · ${counts.dup} skipped (already in ${def.label.toLowerCase()})` : ''}
            {counts.missing > 0 ? ` · ${counts.missing} skipped (missing a name)` : ''}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryBtn onClick={() => setStep('source')}>Back</SecondaryBtn>
            <PrimaryBtn onClick={() => void confirmImport()} disabled={confirming || importable === 0}>
              {confirming ? 'Importing…' : `Import ${importable} ${def.label.toLowerCase()}`}
            </PrimaryBtn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StepBar({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'source', label: '1 · Upload' },
    { key: 'grid', label: '2 · Review & map' },
    { key: 'summary', label: '3 · Done' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 ${
              i === activeIndex
                ? 'bg-[#1F5FA8] text-white'
                : i < activeIndex
                  ? 'bg-[#E1F5EE] text-[#0F6E56]'
                  : 'bg-[#F0F0EC] text-[#9A9DA1]'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 ? <span className="text-[#D7DAD8]">→</span> : null}
        </div>
      ))}
    </div>
  );
}

function SourceStep({
  entity,
  setEntity,
  fileRef,
  parsing,
  parseError,
  fileName,
  onFile,
}: {
  entity: ImportEntity;
  setEntity: (e: ImportEntity) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  parsing: boolean;
  parseError: string | null;
  fileName: string | null;
  onFile: (f: File) => void;
}) {
  return (
    <div className="mt-6 max-w-2xl space-y-5">
      <div>
        <div className="mb-2 text-[13px] font-medium text-[#1A1C1E]">What are you importing?</div>
        <div className="grid grid-cols-2 gap-3">
          {(Object.values(IMPORT_ENTITIES) as ImportEntityDef[]).map((d) => (
            <button
              key={d.entity}
              type="button"
              onClick={() => setEntity(d.entity)}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                entity === d.entity
                  ? 'border-[#3E7BC4] bg-[#F3F8F6]'
                  : 'border-[#E7E7E2] bg-white hover:border-[#3E7BC4]/40 hover:bg-[#FAFAF8]'
              }`}
            >
              <div className="text-[15px] font-semibold text-[#1A1C1E]">{d.label}</div>
              <div className="mt-0.5 font-mono text-[11px] text-[#9A9DA1]">{d.table}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium text-[#1A1C1E]">Upload the file</div>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
            parsing ? 'border-[#D7DAD8] bg-[#FBFBF9]' : 'border-[#D7DAD8] bg-[#FBFBF9] hover:border-[#3E7BC4]/50 hover:bg-[#F3F8F6]'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <span className="text-[15px] font-medium text-[#1A1C1E]">
            {parsing ? 'Reading…' : fileName ? fileName : 'Choose an Excel (.xlsx) or CSV file'}
          </span>
          <span className="mt-1 text-[12px] text-[#9A9DA1]">
            QuickBooks and Excel exports welcome. The first row is treated as the headers.
          </span>
        </label>
        {parseError ? (
          <div className="mt-3 rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2 text-[12px] text-[#A32D2D]">
            {parseError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Grid({
  columns,
  visibleColumnIdx,
  def,
  pageRowIndexes,
  data,
  flags,
  fieldByKey,
  onFieldChange,
  onToggleDrop,
  onEditCell,
  onRemoveRow,
}: {
  columns: Column[];
  visibleColumnIdx: number[];
  def: ImportEntityDef;
  pageRowIndexes: number[];
  data: string[][];
  flags: { missingReq: boolean[]; duplicate: boolean[]; badEmail: boolean[] };
  fieldByKey: Map<string, ImportField>;
  onFieldChange: (ci: number, field: string) => void;
  onToggleDrop: (ci: number) => void;
  onEditCell: (ri: number, ci: number, value: string) => void;
  onRemoveRow: (ri: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#FBFBF9]">
              <th className="sticky left-0 z-20 border-b border-r border-[#E7E7E2] bg-[#FBFBF9] px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[#9A9DA1]">
                #
              </th>
              {visibleColumnIdx.map((ci) => {
                const col = columns[ci];
                return (
                  <th
                    key={ci}
                    className={`min-w-[160px] border-b border-r border-[#E7E7E2] px-2 py-2 text-left align-top ${
                      col.dropped ? 'bg-[#F6F6F2]' : 'bg-[#FBFBF9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[12px] font-semibold ${col.dropped ? 'text-[#9A9DA1] line-through' : 'text-[#1A1C1E]'}`}
                        title={col.header}
                      >
                        {col.header || <span className="italic text-[#9A9DA1]">(no header)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleDrop(ci)}
                        aria-label={col.dropped ? 'Keep column' : 'Drop column'}
                        title={col.dropped ? 'Keep column' : 'Drop column'}
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                          col.dropped
                            ? 'text-[#1F5FA8] hover:bg-[#EAF3F0]'
                            : 'text-[#9A9DA1] hover:bg-[#F3E7E7] hover:text-[#A32D2D]'
                        }`}
                      >
                        {col.dropped ? 'keep' : 'drop'}
                      </button>
                    </div>
                    <select
                      value={col.field}
                      onChange={(e) => onFieldChange(ci, e.target.value)}
                      className="mt-1.5 h-7 w-full rounded-md border border-[#D7DAD8] bg-white px-1.5 text-[12px] text-[#1A1C1E] focus:border-[#3E7BC4]/50 focus:outline-none"
                    >
                      <option value={DROP}>— (drop)</option>
                      {def.fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </th>
                );
              })}
              <th className="border-b border-[#E7E7E2] bg-[#FBFBF9] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageRowIndexes.map((ri) => {
              const flagged = flags.missingReq[ri] || flags.duplicate[ri] || flags.badEmail[ri];
              return (
                <tr key={ri} className={flagged ? 'bg-[#FDF9F0]' : 'hover:bg-[#FBFBF9]'}>
                  <td className="sticky left-0 z-[5] border-b border-r border-[#F0F0EC] bg-inherit px-2 py-1 align-top">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[11px] tabular-nums text-[#9A9DA1]">{ri + 1}</span>
                      {flags.missingReq[ri] ? <Tag color="#A32D2D" bg="#F9EDED" label="req" title="Missing a required field" /> : null}
                      {flags.duplicate[ri] ? <Tag color="#854F0B" bg="#FBF3E4" label="dup" title="Duplicate of an existing or earlier row" /> : null}
                      {flags.badEmail[ri] ? <Tag color="#854F0B" bg="#FBF3E4" label="email" title="Malformed email" /> : null}
                    </div>
                  </td>
                  {visibleColumnIdx.map((ci) => {
                    const col = columns[ci];
                    const field = !col.dropped && col.field ? fieldByKey.get(col.field) : undefined;
                    const isEmailCell = field?.key === 'email';
                    const cellBad = isEmailCell && flags.badEmail[ri];
                    return (
                      <td
                        key={ci}
                        className={`border-b border-r border-[#F0F0EC] px-1 py-1 align-top ${col.dropped ? 'bg-[#FBFBF9]' : ''}`}
                      >
                        <input
                          defaultValue={data[ri]?.[ci] ?? ''}
                          key={`${ri}-${ci}-${data[ri]?.[ci] ?? ''}`}
                          onBlur={(e) => onEditCell(ri, ci, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className={`h-7 w-full min-w-[140px] rounded-md border px-1.5 text-[12px] focus:outline-none ${
                            col.dropped
                              ? 'border-transparent bg-transparent text-[#9A9DA1]'
                              : cellBad
                                ? 'border-[#E7C9A0] bg-[#FDF8EF] text-[#1A1C1E] focus:border-[#854F0B]'
                                : 'border-transparent bg-transparent text-[#1A1C1E] hover:border-[#E7E7E2] focus:border-[#3E7BC4]/50'
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-[#F0F0EC] px-1 py-1 align-top">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(ri)}
                      aria-label="Remove row"
                      title="Remove row"
                      className="rounded px-1.5 py-1 text-[13px] text-[#9A9DA1] transition-colors hover:bg-[#F3E7E7] hover:text-[#A32D2D]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageRowIndexes.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnIdx.length + 2} className="px-4 py-10 text-center text-[13px] text-[#9A9DA1]">
                  No rows to show.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tag({ color, bg, label, title }: { color: string; bg: string; label: string; title: string }) {
  return (
    <span
      title={title}
      className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase leading-none"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

function AiPanel({
  entityLabel,
  aiBusy,
  aiMessage,
  aiError,
  instruction,
  setInstruction,
  onAutomap,
  onCommand,
}: {
  entityLabel: string;
  aiBusy: 'automap' | 'command' | null;
  aiMessage: string | null;
  aiError: string | null;
  instruction: string;
  setInstruction: (v: string) => void;
  onAutomap: () => void;
  onCommand: () => void;
}) {
  return (
    <aside className="h-fit rounded-2xl border border-[#E7E7E2] bg-[#FBFBF9] p-4 lg:sticky lg:top-4">
      <div className="text-[13px] font-semibold text-[#1A1C1E]">AI assist</div>
      <p className="mt-1 text-[12px] leading-relaxed text-[#5F6368]">
        Let AI map the columns to your {entityLabel.toLowerCase()} fields, or tell it what to fix — it edits the grid,
        you still confirm.
      </p>

      <PrimaryBtn className="mt-3 w-full" onClick={onAutomap} disabled={aiBusy !== null}>
        {aiBusy === 'automap' ? 'Mapping…' : 'Auto-map columns'}
      </PrimaryBtn>

      <div className="mt-4">
        <label className="mb-1 block text-[12px] font-medium text-[#1A1C1E]">Tell the AI what to change</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Title-case the customer names, and map the Bill to columns to the billing address."
          className="h-24 w-full rounded-lg border border-[#D7DAD8] bg-white px-2.5 py-2 text-[12px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]/50 focus:outline-none"
        />
        <SecondaryBtn className="mt-2 w-full" onClick={onCommand} disabled={aiBusy !== null || instruction.trim() === ''}>
          {aiBusy === 'command' ? 'Applying…' : 'Apply'}
        </SecondaryBtn>
      </div>

      {aiMessage ? (
        <div className="mt-3 rounded-lg border border-[#D9E7E2] bg-[#F1F7F4] px-2.5 py-2 text-[12px] text-[#1F5FA8]">
          {aiMessage}
        </div>
      ) : null}
      {aiError ? (
        <div className="mt-3 rounded-lg border border-[#E7C9C9] bg-[#F9F0F0] px-2.5 py-2 text-[12px] text-[#A32D2D]">
          {aiError}
        </div>
      ) : null}
    </aside>
  );
}

function SummaryStep({
  entity,
  def,
  summary,
  onImportMore,
}: {
  entity: ImportEntity;
  def: ImportEntityDef;
  summary: ImportSummary | null;
  onImportMore: () => void;
}) {
  const dbHref = `/app/docu/databases/${entity === 'customers' ? 'customers' : 'products'}`;
  if (!summary) {
    return <div className="mt-6 text-[14px] text-[#5F6368]">No import run yet.</div>;
  }
  const ok = summary.inserted > 0 && summary.errors === 0;
  return (
    <div className="mt-6 max-w-xl">
      <EmptyState
        title={
          summary.inserted > 0
            ? `Imported ${summary.inserted} ${def.label.toLowerCase()}`
            : `Nothing imported`
        }
        body={
          ok
            ? 'Your data is now in Core Data and flows through to every module.'
            : summary.inserted > 0
              ? 'Most rows imported — see the breakdown below.'
              : 'No rows were written. Check the breakdown below.'
        }
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <SummaryRow label="Inserted" value={summary.inserted} accent="#0F6E56" />
        <SummaryRow label="Skipped — duplicate" value={summary.skippedDuplicate} />
        <SummaryRow label="Skipped — missing required" value={summary.skippedMissing} />
        <SummaryRow label="Errors" value={summary.errors} accent={summary.errors > 0 ? '#A32D2D' : undefined} last />
      </div>

      {summary.errorMessage ? (
        <div className="mt-3 rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2 text-[12px] text-[#A32D2D]">
          {summary.errorMessage}
        </div>
      ) : null}

      {summary.droppedColumns && summary.droppedColumns.length > 0 ? (
        <div className="mt-3 rounded-xl border border-[#F0E4CB] bg-[#FFFDF7] px-3 py-2 text-[12px] text-[#854F0B]">
          <span className="font-medium">Heads up — some mapped fields weren&apos;t saved.</span> Your database is
          missing {summary.droppedColumns.length === 1 ? 'a column' : 'columns'} for{' '}
          {summary.droppedColumns.join(', ')}, so {summary.droppedColumns.length === 1 ? 'it was' : 'they were'}{' '}
          dropped and the rest of each row was imported. Run{' '}
          <code className="rounded bg-black/[0.05] px-1">supabase/import-fields.sql</code>, then re-import to fill{' '}
          {summary.droppedColumns.length === 1 ? 'it' : 'them'} in.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={dbHref}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
        >
          Done — view {def.label.toLowerCase()}
        </Link>
        <SecondaryBtn onClick={onImportMore}>Import another file</SecondaryBtn>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent, last }: { label: string; value: number; accent?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-[#F0F0EC]'}`}>
      <span className="text-[13px] text-[#5F6368]">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums" style={{ color: accent ?? '#1A1C1E' }}>
        {value}
      </span>
    </div>
  );
}
