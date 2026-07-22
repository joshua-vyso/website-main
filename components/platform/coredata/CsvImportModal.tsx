'use client';

import { useMemo, useRef, useState } from 'react';
import { parseCsv, guessMapping, applyMapping, coerceValue, type CsvField } from '@/lib/platform/csv';
import { Modal, Field, PrimaryBtn, SecondaryBtn, inputClass } from './ui';

type ImportRecord = Record<string, string | number | boolean | null>;

type Step = 'upload' | 'map' | 'duplicates' | 'confirm' | 'summary';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function CsvImportModal({
  open,
  onClose,
  title,
  fields,
  existingValues,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: CsvField[];
  existingValues?: { fieldKey: string; values: string[] };
  onImport: (records: ImportRecord[]) => Promise<{ inserted: number; error?: string }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  // Per-row skip flags for the duplicates step (index into dataRows).
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; error?: string } | null>(null);

  function reset() {
    setStep('upload');
    setFileName(null);
    setHeaders([]);
    setDataRows([]);
    setMapping({});
    setParseError(null);
    setSkipped({});
    setBusy(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  function handleFile(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setParseError('That file has no data rows. Export with a header row and at least one record.');
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setDataRows(parsed.rows);
      setMapping(guessMapping(parsed.headers, fields));
      setSkipped({});
      setStep('map');
    };
    reader.onerror = () => setParseError("Couldn't read that file.");
    reader.readAsText(file);
  }

  const requiredFields = useMemo(() => fields.filter((f) => f.required), [fields]);
  const dupField = useMemo(
    () => (existingValues ? fields.find((f) => f.key === existingValues.fieldKey) ?? null : null),
    [fields, existingValues],
  );

  // A row counts only when at least one mapped field yields a non-empty value.
  const nonEmptyRows = useMemo(() => {
    const mappedIdx = Object.values(mapping).filter((i) => i >= 0);
    if (mappedIdx.length === 0) return [] as string[][];
    return dataRows.filter((r) => mappedIdx.some((i) => (r[i] ?? '').trim() !== ''));
  }, [dataRows, mapping]);

  // Unmapped required fields → blocks advancing from the map step.
  const missingRequired = useMemo(
    () => requiredFields.filter((f) => (mapping[f.key] ?? -1) < 0),
    [requiredFields, mapping],
  );

  // Duplicate detection: rows whose required-key value already exists.
  const existingSet = useMemo(() => {
    const set = new Set<string>();
    if (existingValues) for (const v of existingValues.values) set.add(norm(v));
    return set;
  }, [existingValues]);

  const duplicateIdx = useMemo(() => {
    if (!existingValues || !dupField) return [] as number[];
    const idx = mapping[dupField.key] ?? -1;
    if (idx < 0) return [];
    const out: number[] = [];
    dataRows.forEach((r, i) => {
      const val = (r[idx] ?? '').trim();
      if (val && existingSet.has(norm(val))) out.push(i);
    });
    return out;
  }, [existingValues, dupField, mapping, dataRows, existingSet]);

  function buildRecords(): { records: ImportRecord[]; skippedCount: number } {
    const records: ImportRecord[] = [];
    let skippedCount = 0;
    const mappedIdx = Object.values(mapping).filter((i) => i >= 0);
    const dupSet = new Set(duplicateIdx);
    dataRows.forEach((row, i) => {
      const hasValue = mappedIdx.some((idx) => (row[idx] ?? '').trim() !== '');
      if (!hasValue) return; // ignore blank lines entirely (not "skipped")
      // Duplicates default to skipped; user can untick. Non-duplicates default to import.
      const isSkipped = skipped[i] ?? dupSet.has(i);
      if (isSkipped) {
        skippedCount++;
        return;
      }
      const raw = applyMapping(row, mapping);
      const rec: ImportRecord = {};
      for (const f of fields) rec[f.key] = coerceValue(raw[f.key] ?? '', f.type);
      records.push(rec);
    });
    return { records, skippedCount };
  }

  async function runImport() {
    setBusy(true);
    const { records, skippedCount } = buildRecords();
    if (records.length === 0) {
      setBusy(false);
      setResult({ inserted: 0, skipped: skippedCount, error: 'No rows to import — every row was blank or skipped.' });
      setStep('summary');
      return;
    }
    try {
      const res = await onImport(records);
      setResult({ inserted: res.inserted, skipped: skippedCount, error: res.error });
    } catch (e) {
      setResult({ inserted: 0, skipped: skippedCount, error: e instanceof Error ? e.message : 'Import failed.' });
    }
    setBusy(false);
    setStep('summary');
  }

  const stepIndex = ['upload', 'map', 'duplicates', 'confirm', 'summary'].indexOf(step);
  const previewRows = dataRows.slice(0, 5);

  function footer() {
    if (step === 'upload') {
      return <SecondaryBtn onClick={close}>Cancel</SecondaryBtn>;
    }
    if (step === 'map') {
      return (
        <>
          <SecondaryBtn onClick={() => setStep('upload')}>Back</SecondaryBtn>
          <PrimaryBtn
            onClick={() => setStep(duplicateIdx.length > 0 ? 'duplicates' : 'confirm')}
            disabled={missingRequired.length > 0 || nonEmptyRows.length === 0}
          >
            Continue
          </PrimaryBtn>
        </>
      );
    }
    if (step === 'duplicates') {
      return (
        <>
          <SecondaryBtn onClick={() => setStep('map')}>Back</SecondaryBtn>
          <PrimaryBtn onClick={() => setStep('confirm')}>Continue</PrimaryBtn>
        </>
      );
    }
    if (step === 'confirm') {
      return (
        <>
          <SecondaryBtn onClick={() => setStep(duplicateIdx.length > 0 ? 'duplicates' : 'map')} disabled={busy}>
            Back
          </SecondaryBtn>
          <PrimaryBtn onClick={() => void runImport()} disabled={busy}>
            {busy ? 'Importing…' : `Import ${buildRecords().records.length} rows`}
          </PrimaryBtn>
        </>
      );
    }
    return <PrimaryBtn onClick={close}>Done</PrimaryBtn>;
  }

  const willImport = step === 'confirm' ? buildRecords() : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      subtitle={step === 'summary' ? undefined : `Step ${stepIndex + 1} of 4`}
      width={620}
      footer={footer()}
    >
      {/* Step 1 — upload */}
      {step === 'upload' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[#6B6F68]">
            Upload a CSV exported from QuickBooks, Excel or another system. The first row must be column headers.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center transition-colors hover:border-[#3E7BC4]/50 hover:bg-[#F5F7F6]">
            <span className="text-[14px] font-semibold text-[#171A17]">Choose a CSV file</span>
            <span className="text-[12px] text-[#A0A49C]">or drop it into the Databases page</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {parseError ? <p className="text-[13px] text-[#A32D2D]">{parseError}</p> : null}
        </div>
      ) : null}

      {/* Step 2 — preview + map */}
      {step === 'map' ? (
        <div className="space-y-4">
          <p className="text-[13px] text-[#6B6F68]">
            <span className="font-medium text-[#171A17]">{fileName}</span> · {nonEmptyRows.length} rows. Match each field to a
            column — we&rsquo;ve guessed where we can.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const unmappedRequired = f.required && (mapping[f.key] ?? -1) < 0;
              return (
                <Field key={f.key} label={f.label} hint={f.required ? '(required)' : undefined}>
                  <select
                    value={mapping[f.key] ?? -1}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                    className={`${inputClass} ${unmappedRequired ? 'border-[#A32D2D]' : ''}`}
                  >
                    <option value={-1}>— Not mapped —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            })}
          </div>

          {missingRequired.length > 0 ? (
            <p className="text-[13px] text-[#A32D2D]">
              Map every required field: {missingRequired.map((f) => f.label).join(', ')}.
            </p>
          ) : null}

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">Preview (first 5 rows)</div>
            <div className="overflow-x-auto rounded-xl border border-[#EAEDF2]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#EAEDF2] bg-[#FBFCFE]">
                    {headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, ri) => (
                    <tr key={ri} className="border-b border-[#F4F5F7] last:border-0">
                      {headers.map((_, ci) => (
                        <td key={ci} className="whitespace-nowrap px-2.5 py-1.5 text-[#171A17]">
                          {r[ci] || <span className="text-[#A0A49C]">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 3 — duplicates */}
      {step === 'duplicates' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[#6B6F68]">
            {duplicateIdx.length} row{duplicateIdx.length === 1 ? '' : 's'} match an existing{' '}
            <span className="font-medium text-[#171A17]">{dupField?.label.toLowerCase()}</span>. Skipped rows won&rsquo;t be
            imported — untick to import anyway (creates a duplicate).
          </p>
          <div className="flex items-center gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => setSkipped(Object.fromEntries(duplicateIdx.map((i) => [i, true])))}
              className="text-[#1F5FA8] hover:underline"
            >
              Skip all
            </button>
            <button
              type="button"
              onClick={() => setSkipped(Object.fromEntries(duplicateIdx.map((i) => [i, false])))}
              className="text-[#6B6F68] hover:underline"
            >
              Import all
            </button>
          </div>
          <div className="divide-y divide-[#EEF1F5] overflow-hidden rounded-xl border border-[#EAEDF2]">
            {duplicateIdx.map((i) => {
              const raw = applyMapping(dataRows[i], mapping);
              const isSkipped = skipped[i] ?? true;
              return (
                <label key={i} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[#FBFCFE]">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={(e) => setSkipped({ ...skipped, [i]: e.target.checked })}
                    className="h-4 w-4 accent-[#1F5FA8]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#171A17]">
                      {dupField ? raw[dupField.key] || '—' : '—'}
                    </div>
                    <div className="truncate text-[12px] text-[#A0A49C]">
                      {fields
                        .filter((f) => f.key !== dupField?.key && raw[f.key])
                        .slice(0, 3)
                        .map((f) => raw[f.key])
                        .join(' · ') || 'no other fields'}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-[#A0A49C]">{isSkipped ? 'Skip' : 'Import'}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Step 4 — confirm */}
      {step === 'confirm' && willImport ? (
        <div className="space-y-4">
          <p className="text-[13px] text-[#6B6F68]">Ready to import. This writes new records to your Core Data.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Will import</div>
              <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#0F6E56]">{willImport.records.length}</div>
            </div>
            <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Skipped</div>
              <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{willImport.skippedCount}</div>
            </div>
          </div>
          <div className="rounded-xl border border-[#EAEDF2]">
            <div className="border-b border-[#EEF1F5] bg-[#FBFCFE] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
              Fields
            </div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {fields
                .filter((f) => (mapping[f.key] ?? -1) >= 0)
                .map((f) => (
                  <span key={f.key} className="rounded-full bg-[#EEF1F5] px-2.5 py-1 text-[11px] text-[#6B6F68]">
                    {f.label} ← {headers[mapping[f.key]] || `Col ${mapping[f.key] + 1}`}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 5 — summary */}
      {step === 'summary' && result ? (
        <div className="space-y-4">
          {result.inserted === 0 ? (
            // Nothing landed — a genuine failure. Show the red box with the reason.
            <div className="rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] p-4">
              <div className="of-display text-[14px] font-semibold text-[#A32D2D]">Import problem</div>
              <p className="mt-1 text-[12px] text-[#8A4A4A]">{result.error ?? 'No rows were imported.'}</p>
            </div>
          ) : (
            // Rows landed. Show success — and, on a partial success, an amber note
            // carrying the error string (e.g. "Skipped M unmatched…").
            <>
              <div className="rounded-xl border border-[#CDE9DF] bg-[#EAF6F1] p-4">
                <div className="of-display text-[14px] font-semibold text-[#0F6E56]">Import complete</div>
                <p className="mt-1 text-[12px] text-[#3C7A66]">
                  {result.inserted} record{result.inserted === 1 ? '' : 's'} added to your Core Data.
                </p>
              </div>
              {result.error ? (
                <div className="rounded-xl border border-[#EFDDBB] bg-[#FBEEDA] p-4">
                  <div className="of-display text-[14px] font-semibold text-[#854F0B]">Heads up</div>
                  <p className="mt-1 text-[12px] text-[#8A6A2E]">{result.error}</p>
                </div>
              ) : null}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Inserted</div>
              <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#0F6E56]">{result.inserted}</div>
            </div>
            <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Skipped</div>
              <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{result.skipped}</div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
