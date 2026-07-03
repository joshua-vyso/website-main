import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { runPrompt, aiConfigured } from '@/lib/ai/anthropic';
import { IMPORT_ENTITIES, type ImportEntity } from '@/lib/platform/import-schema';

export const runtime = 'nodejs';

/**
 * AI assist for the Excel/CSV import wizard. Two modes, both JSON-only:
 *  - automap:  given headers + a few sample rows, return the best field key for
 *              EVERY header index (or '' to drop). Many headers may map to one
 *              field (e.g. "Bill to 1".."Bill to 5" → billing_address).
 *  - command:  given a natural-language instruction, return a small list of ops
 *              the CLIENT applies deterministically to the grid (we never trust
 *              the model to rewrite 800 rows itself).
 *
 * Token use is kept modest: schema + headers + ≤15 sample rows only, never the
 * full dataset. The model's text is parsed defensively (code-fence strip +
 * try/catch); any parse failure degrades to a safe empty result rather than 500.
 */

const MAX_SAMPLE_ROWS = 15;
const TRANSFORM_KINDS = new Set(['titlecase', 'uppercase', 'lowercase', 'trim']);

interface AssistBody {
  entity?: string;
  headers?: unknown;
  sampleRows?: unknown;
  instruction?: string;
  mode?: string;
}

/** A field-key set for validating AI output against the entity's real schema. */
function fieldKeys(entity: ImportEntity): Set<string> {
  return new Set(IMPORT_ENTITIES[entity].fields.map((f) => f.key));
}

/** Compact human-readable field catalogue for the prompt. */
function fieldCatalogue(entity: ImportEntity): string {
  return IMPORT_ENTITIES[entity].fields
    .map((f) => {
      const flags = [f.required ? 'required' : '', `type:${f.type}`].filter(Boolean).join(', ');
      const aliases = f.aliases.length ? ` — aliases: ${f.aliases.join(', ')}` : '';
      return `- ${f.key} ("${f.label}"${flags ? `, ${flags}` : ''})${aliases}`;
    })
    .join('\n');
}

/** Strip code fences and parse JSON; null on any failure. */
function parseJson(text: string): unknown {
  const raw = String(text ?? '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Fall back to the first {...} or [...] block the model may have wrapped in prose.
    const m = /[{[][\s\S]*[}\]]/.exec(raw);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Coerce arbitrary input into a string[] of headers. */
function toHeaders(v: unknown): string[] {
  return Array.isArray(v) ? v.map((h) => String(h ?? '')) : [];
}

/** Coerce arbitrary input into a capped string[][] of sample rows. */
function toSampleRows(v: unknown): string[][] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_SAMPLE_ROWS)
    .map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []));
}

const SYSTEM = `You are a data-import mapping assistant for a South African SME accounting/wholesale app.
You map spreadsheet columns (from QuickBooks / Excel / CSV exports) onto a fixed set of database fields, and turn plain-English cleanup requests into a small set of grid operations.
You ALWAYS respond with ONLY a single JSON object — no prose, no explanation outside the JSON, no markdown code fences.`;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json(
      { error: 'AI is not configured on the server.' },
      { status: 503, headers: AI_CORS_HEADERS },
    );
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as AssistBody;
  const entity = body.entity;
  if (entity !== 'customers' && entity !== 'products') {
    return NextResponse.json(
      { error: "entity must be 'customers' or 'products'" },
      { status: 400, headers: AI_CORS_HEADERS },
    );
  }
  const mode = body.mode === 'automap' || body.mode === 'command' ? body.mode : null;
  if (!mode) {
    return NextResponse.json(
      { error: "mode must be 'automap' or 'command'" },
      { status: 400, headers: AI_CORS_HEADERS },
    );
  }

  const headers = toHeaders(body.headers);
  const sampleRows = toSampleRows(body.sampleRows);
  const keys = fieldKeys(entity);
  const catalogue = fieldCatalogue(entity);

  // A tiny preview: header index + name + a couple of sample values per column,
  // so the model can map on content as well as header text without shipping the
  // whole dataset.
  const columnPreview = headers
    .map((h, i) => {
      const samples = sampleRows
        .map((r) => (r[i] ?? '').trim())
        .filter(Boolean)
        .slice(0, 3);
      return `[${i}] "${h}"${samples.length ? ` e.g. ${samples.map((s) => JSON.stringify(s)).join(', ')}` : ''}`;
    })
    .join('\n');

  if (mode === 'automap') {
    return automap(entity, headers, keys, catalogue, columnPreview);
  }
  return command(entity, headers, keys, catalogue, columnPreview, body.instruction);
}

async function automap(
  entity: ImportEntity,
  headers: string[],
  keys: Set<string>,
  catalogue: string,
  columnPreview: string,
): Promise<NextResponse> {
  if (headers.length === 0) {
    return NextResponse.json({ mapping: {} }, { headers: AI_CORS_HEADERS });
  }

  const prompt = `Map each spreadsheet column to the best ${IMPORT_ENTITIES[entity].label} field, or to '' (empty string) to DROP it.

TARGET FIELDS:
${catalogue}

COLUMNS (index, header, sample values):
${columnPreview}

Rules:
- Return the best field KEY (left of the parentheses above) for each column, or '' to drop columns that don't fit any field (internal ids, blanks, duplicate/computed columns, anything not in the field list).
- MANY columns MAY map to the SAME field. Multi-part fields such as billing_address, delivery_address and contact_name are commonly split across several columns (e.g. "Bill to 1".."Bill to 5" all → billing_address; "First name" + "Last name" → contact_name). Map every part to that same field key.
- Judge on BOTH the header text and the sample values.
- The required field(s) must be filled if any column plausibly holds that data.

Respond with ONLY this JSON (every header index 0..${headers.length - 1} present as a string key):
{ "mapping": { "0": "<fieldKey or ''>", "1": "<fieldKey or ''>", ... } }`;

  let text = '';
  try {
    text = await runPrompt(prompt, SYSTEM);
  } catch {
    return NextResponse.json({ mapping: {} }, { headers: AI_CORS_HEADERS });
  }

  const parsed = parseJson(text) as { mapping?: unknown } | null;
  const rawMap =
    parsed && typeof parsed === 'object' && parsed.mapping && typeof parsed.mapping === 'object'
      ? (parsed.mapping as Record<string, unknown>)
      : {};

  // Validate: only accept indices that exist and field keys that are real (or '').
  const mapping: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const v = rawMap[String(i)];
    const key = typeof v === 'string' ? v.trim() : '';
    mapping[String(i)] = key && keys.has(key) ? key : '';
  }

  return NextResponse.json({ mapping }, { headers: AI_CORS_HEADERS });
}

interface RawOp {
  type?: unknown;
  header?: unknown;
  columnIndex?: unknown;
  field?: unknown;
  value?: unknown;
  kind?: unknown;
}

type CleanOp =
  | { type: 'mapColumn'; columnIndex?: number; header?: string; field: string }
  | { type: 'setField'; field: string; value: string }
  | { type: 'transform'; field: string; kind: string }
  | { type: 'dropColumn'; columnIndex?: number; header?: string };

async function command(
  entity: ImportEntity,
  headers: string[],
  keys: Set<string>,
  catalogue: string,
  columnPreview: string,
  instruction: string | undefined,
): Promise<NextResponse> {
  const instr = String(instruction ?? '').trim();
  if (!instr) {
    return NextResponse.json(
      { ops: [], message: 'No instruction was given.' },
      { headers: AI_CORS_HEADERS },
    );
  }

  const prompt = `The user wants to change how their imported ${IMPORT_ENTITIES[entity].label} spreadsheet is mapped or cleaned up. Turn their request into a small list of grid OPERATIONS the app will apply.

TARGET FIELDS:
${catalogue}

COLUMNS (index, header, sample values):
${columnPreview}

USER REQUEST:
"""${instr}"""

You may ONLY use these operation types (use exactly these shapes; ignore anything you can't express):
- { "type": "mapColumn", "columnIndex": <number>, "field": "<fieldKey or ''>" }   // point a column at a field (or '' to drop); may also key by "header": "<exact header text>"
- { "type": "setField", "field": "<fieldKey>", "value": "<string>" }                // set every cell mapped to that field to this value
- { "type": "transform", "field": "<fieldKey>", "kind": "titlecase"|"uppercase"|"lowercase"|"trim" }  // clean every cell mapped to that field
- { "type": "dropColumn", "columnIndex": <number> }                                 // drop a column; may also key by "header": "<exact header text>"

Rules:
- Use "field" keys ONLY from the target-fields list above (or '' to drop, where allowed).
- Prefer "columnIndex" (from the COLUMNS list) over "header" when you can identify the column.
- If the request cannot be expressed with these ops, return an empty ops array and explain briefly in "message".
- "message" is ONE short line stating what you did (or why you couldn't).

Respond with ONLY this JSON:
{ "ops": [ ...ops... ], "message": "<one line>" }`;

  let text = '';
  try {
    text = await runPrompt(prompt, SYSTEM);
  } catch (err) {
    return NextResponse.json(
      { ops: [], message: err instanceof Error ? err.message : 'AI request failed.' },
      { headers: AI_CORS_HEADERS },
    );
  }

  const parsed = parseJson(text) as { ops?: unknown; message?: unknown } | null;
  if (!parsed || typeof parsed !== 'object') {
    return NextResponse.json(
      { ops: [], message: 'Could not parse AI response' },
      { headers: AI_CORS_HEADERS },
    );
  }

  const rawOps = Array.isArray(parsed.ops) ? (parsed.ops as RawOp[]) : [];
  const ops: CleanOp[] = [];
  for (const raw of rawOps) {
    const op = cleanOp(raw, headers.length, keys);
    if (op) ops.push(op);
  }

  const message =
    typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim().slice(0, 300)
      : ops.length
        ? 'Applied the requested changes.'
        : 'No applicable changes.';

  return NextResponse.json({ ops, message }, { headers: AI_CORS_HEADERS });
}

/** Validate + narrow a raw AI op to the client op vocabulary, or null to drop it. */
function cleanOp(raw: RawOp, headerCount: number, keys: Set<string>): CleanOp | null {
  if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') return null;

  const idx =
    typeof raw.columnIndex === 'number' && Number.isInteger(raw.columnIndex) && raw.columnIndex >= 0 && raw.columnIndex < headerCount
      ? raw.columnIndex
      : undefined;
  const header = typeof raw.header === 'string' && raw.header.trim() ? raw.header : undefined;
  // A field of '' is valid for map/drop (means "drop"); for setField/transform it must be a real key.
  const fieldRaw = typeof raw.field === 'string' ? raw.field.trim() : undefined;

  switch (raw.type) {
    case 'mapColumn': {
      if (idx === undefined && header === undefined) return null;
      // '' allowed (drop), otherwise must be a real field key.
      if (fieldRaw === undefined) return null;
      if (fieldRaw !== '' && !keys.has(fieldRaw)) return null;
      return { type: 'mapColumn', ...(idx !== undefined ? { columnIndex: idx } : {}), ...(header ? { header } : {}), field: fieldRaw };
    }
    case 'setField': {
      if (!fieldRaw || !keys.has(fieldRaw)) return null;
      const value = typeof raw.value === 'string' ? raw.value : String(raw.value ?? '');
      return { type: 'setField', field: fieldRaw, value };
    }
    case 'transform': {
      if (!fieldRaw || !keys.has(fieldRaw)) return null;
      const kind = typeof raw.kind === 'string' ? raw.kind.toLowerCase() : '';
      if (!TRANSFORM_KINDS.has(kind)) return null;
      return { type: 'transform', field: fieldRaw, kind };
    }
    case 'dropColumn': {
      if (idx === undefined && header === undefined) return null;
      return { type: 'dropColumn', ...(idx !== undefined ? { columnIndex: idx } : {}), ...(header ? { header } : {}) };
    }
    default:
      return null;
  }
}
