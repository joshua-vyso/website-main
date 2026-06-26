import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { AiSummary, StatementSummary } from '@/lib/platform/docu/types';

/**
 * Server-only Anthropic integration. The API key is read from a non-public env
 * var and NEVER reaches any client bundle. Both the website and the mobile app
 * use AI exclusively through the /api/ai/* route handlers that wrap this module.
 */
const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
// Document extraction is high-volume + structured, so it's right-sized to the
// fast/cheap tier rather than Opus. On real statements Haiku 4.5 matched Opus on
// every product, weight and amount at ~1/5 the cost and lower latency. Override
// with ANTHROPIC_EXTRACT_MODEL if a future document type needs more muscle.
const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || 'claude-haiku-4-5';
// The operational summary is a short (≤500 char) briefing, not deep reasoning,
// so it runs on the fast/cheap Haiku tier. Override with ANTHROPIC_SUMMARY_MODEL.
const SUMMARY_MODEL = process.env.ANTHROPIC_SUMMARY_MODEL || 'claude-haiku-4-5';
// Product categorisation is a simple label-per-name task — Haiku tier.
const CATEGORISE_MODEL = process.env.ANTHROPIC_CATEGORISE_MODEL || 'claude-haiku-4-5';
// Product-name matching: pick the right canonical from a short candidate list.
const MATCH_MODEL = process.env.ANTHROPIC_MATCH_MODEL || 'claude-haiku-4-5';

export const aiConfigured = Boolean(apiKey);

function client(): Anthropic {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

export interface ExtractedLineItem {
  reference?: string;
  description: string;
  weight?: string;
  quantity?: string;
  units_per_box?: string;
  total_kg?: string;
  unit?: string;
  /** Per-line seller/agent — only on docs where each row has its own vendor
   *  (e.g. a market statement's AGENT column). Empty on single-supplier invoices. */
  supplier?: string;
  unit_price?: string;
  amount?: string;
  confidence: number;
}

export type ExtractedDocType =
  | 'invoice'
  | 'statement'
  | 'delivery_note'
  | 'price_list'
  | 'order'
  | null;

export interface ExtractionResult {
  document_type: ExtractedDocType;
  /** The selling/issuing party (the counterparty the document is FROM), or null. */
  supplier: string | null;
  fields: ExtractedField[];
  line_items: ExtractedLineItem[];
  summary: StatementSummary | null;
  overall_confidence: number;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

const EXTRACT_INSTRUCTION = `You are Doc-U, Vyso's product-line extractor for SME food & wholesale businesses.
The attached document is a supplier/market statement, invoice, delivery note, price list, or order. It contains a table of PRODUCT PURCHASE LINES.
Extract ONLY the product line items — do NOT extract header/summary/account/banking/VAT/balance/total fields.
Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "document_type": "invoice" | "statement" | "delivery_note" | "price_list" | "order",
  "supplier": string | null,
  "line_items": [
    {
      "description": string,
      "weight": string,
      "quantity": string,
      "units_per_box": string,
      "total_kg": string,
      "unit": string,
      "supplier": string,
      "unit_price": string,
      "amount": string,
      "confidence": number
    }
  ],
  "summary": {
    "statement_date": string | null,
    "opening_balance": number | null,
    "payments": number | null,
    "total_purchases": number | null,
    "total_pallet_refunds": number | null,
    "total_pallet_usage": number | null,
    "vat": number | null,
    "total_charges": number | null,
    "closing_balance": number | null,
    "net_financial_transactions": number | null,
    "audit_error": number | null
  } | null,
  "overall_confidence": number
}
Rules:
- "supplier" (top level): the SELLING / ISSUING party — the business this document is FROM and that is owed the money. Read it dynamically from anywhere on the page; do not assume a fixed position. It is the letterhead / logo entity, typically the one printed with a VAT registration number and/or its own banking details. It is NOT the recipient: never return the party under "Bill To", "Ship To", "Sold To", "Customer", "Account", "Deliver To", or the account holder named in a statement header — that is the buyer. Return the cleaned trading name in Title Case, keeping a legal suffix if shown (e.g. "Bacca Valley (Pty) Ltd", "Country Mushrooms (Pty) Ltd"). For a fresh-produce MARKET statement, the document-level supplier is the MARKET named in the page header (e.g. "Johannesburg Fresh Produce Market"). Use null only if no issuing party appears anywhere.
- "summary": if the document has a TRANSACTION SUMMARY / account-totals block (opening balance, closing/system balance, total purchases, VAT, pallet refunds/usage, payments, audit error), extract those figures as plain NUMBERS — strip currency symbols and thousands separators, keep the sign as printed (money out may be negative). Map: opening_balance, payments (or "net financial transactions" if no explicit payments line → put it in net_financial_transactions), total_purchases, total_pallet_refunds (pallet refunds/deposits), total_pallet_usage (pallet usage fee), vat ("VAT included in above transactions"), total_charges, closing_balance ("system closing balance"), audit_error. statement_date = the date printed next to the closing balance / "as at" date, exactly as shown (e.g. "23/MAY/2026"). If there is NO totals block, set "summary" to null.
- Include EVERY product row across ALL pages and ALL "PURCHASES ON CARD ID" sections. Do not skip or summarise rows.
- The commodity cell is often a messy comma-separated string like "BABY BUTTERNUT,300G PUNNE,*,0,*,12,*" or "ORANGES,6KG POCKET,NAVEL,2,M,*". From it derive:
    - description = the produce name, cleaned and Title Case (e.g. "Baby Butternut", "Oranges Navel"). Drop packaging words, grade codes, asterisks, and stray numeric codes.
    - weight = the pack/unit weight CONVERTED TO KILOGRAMS, as a plain decimal number with NO unit: "300G" -> "0.3", "500G" -> "0.5", "6KG" -> "6", "18KG" -> "18". "" if no weight is shown.
    - units_per_box = the number of punnets/units packed per box when the line clearly encodes it. For "BABY BUTTERNUT,300G PUNNE,*,0,*,12,*" that is "12". "" if not indicated.
- total_kg = the TOTAL kilograms for the line = weight × quantity, as a plain decimal string (e.g. weight="0.3", quantity="40" -> total_kg="12"; weight="6", quantity="2" -> total_kg="12"). weight is already the per-pack weight in kg, so do NOT multiply by units_per_box. "" if weight or quantity is missing.
- unit = the COUNTING unit that quantity is measured in, as a short lowercase plural noun, read from the pack/commodity descriptor: "PUNNE"/"PUNNET" -> "punnets", "BOX" -> "boxes", "POCKET" -> "pockets", "BAG" -> "bags", "BUNCH" -> "bunches", "CRATE" -> "crates", "TRAY" -> "trays", "PKT"/"PACKET" -> "packets". If the row is priced/counted by weight, use "kg". Default to "boxes" only when there is genuinely no packaging cue.
- "supplier" (per line): set ONLY when the line table has a per-row seller column — most often a market statement's "AGENT" column, where each commodity row is supplied by a different market agent/vendor (e.g. "WENPRO MARKET A", "C L DE VILLIERS", "R S A MARKET AG", "DAPPER AGENCIES", "BOTHA ROODT"). Copy that agent/vendor name into the line's "supplier", cleaned to Title Case and de-truncated to the full trading name where obvious (e.g. "Wenpro Market Agents", "R S A Market Agents", "Botha Roodt"). Leave it "" on ordinary single-supplier invoices/delivery notes where every line shares the one top-level supplier.
- quantity, unit_price and amount come from the QTY, UNIT PRICE and TOTAL columns of that row — NOT from the commodity string.
- Ignore non-product rows: pallets, deposits, card fees, charges, balances, subtotals, grand totals, banking details.
- Output numbers as plain strings (keep decimals; omit currency symbols). All confidence values 0-100.`;

/** Parse a PDF or image document into structured fields + line items. */
export async function extractDocument(params: {
  base64: string;
  mediaType: string;
  filename: string;
}): Promise<ExtractionResult> {
  const isPdf =
    params.mediaType === 'application/pdf' || params.filename.toLowerCase().endsWith('.pdf');

  const fileBlock: Anthropic.ContentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: params.base64 } }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: (params.mediaType || 'image/jpeg') as
            | 'image/jpeg'
            | 'image/png'
            | 'image/gif'
            | 'image/webp',
          data: params.base64,
        },
      };

  const message = await client().messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 16000, // statements can carry many line items (Haiku 4.5 allows up to 64k)
    messages: [
      {
        role: 'user',
        content: [fileBlock, { type: 'text', text: `${EXTRACT_INSTRUCTION}\n\nFilename: ${params.filename}` }],
      },
    ],
  });

  const raw = textOf(message)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();

  const parsed = JSON.parse(raw) as Partial<ExtractionResult>;
  return {
    document_type: parsed.document_type ?? null,
    supplier:
      typeof parsed.supplier === 'string' && parsed.supplier.trim() ? parsed.supplier.trim() : null,
    fields: Array.isArray(parsed.fields) ? parsed.fields : [],
    line_items: Array.isArray(parsed.line_items) ? parsed.line_items : [],
    summary: coerceSummary(parsed.summary),
    overall_confidence:
      typeof parsed.overall_confidence === 'number' ? parsed.overall_confidence : 0,
  };
}

/** Coerce a parsed summary block into a StatementSummary, or null. */
function coerceSummary(raw: unknown): StatementSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const out: StatementSummary = {
    statement_date: typeof s.statement_date === 'string' ? s.statement_date : null,
    opening_balance: num(s.opening_balance),
    payments: num(s.payments),
    total_purchases: num(s.total_purchases),
    total_pallet_refunds: num(s.total_pallet_refunds),
    total_pallet_usage: num(s.total_pallet_usage),
    vat: num(s.vat),
    total_charges: num(s.total_charges),
    closing_balance: num(s.closing_balance),
    net_financial_transactions: num(s.net_financial_transactions),
    audit_error: num(s.audit_error),
  };
  // If literally nothing was parsed, treat as no summary.
  const hasAny = Object.values(out).some((v) => v != null);
  return hasAny ? out : null;
}

/** Generic prompt → text helper for any module (summaries, drafting, Q&A). */
export async function runPrompt(prompt: string, system?: string): Promise<string> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  });
  return textOf(message);
}

const SUMMARY_MAX_CHARS = 500;

const SUMMARY_SYSTEM = `You are Doc-U's operational analyst for an SME food & wholesale business in South Africa.
Given ONE document's extracted data plus a short list of the organisation's other recent documents, write a SHORT operational briefing for the owner.
Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "text": string,
  "total_spend": string | null,
  "supplier": string | null
}
Rules:
- "text" is the whole briefing and MUST be at most ${SUMMARY_MAX_CHARS} characters — 2 to 4 short, plain sentences. Lead with what matters: total spend, any notable price moves or discrepancies, and one concrete next action. Calm, specific, no filler, no markdown.
- Money in Rand, formatted like "R 8,240.00". total_spend is null if the document carries no total.
- supplier: the supplier name if known, else null.
- NEVER invent figures the data does not support. If the document is thin, say so briefly.`;

/**
 * Generate a cached operational briefing for a document. Returns the coerced
 * AiSummary (a ≤500-char text plus spend/supplier); callers cache it on
 * documents.ai_summary. Runs on Haiku — short output, low cost/latency.
 */
export async function summariseDocument(context: {
  filename: string;
  documentType: string | null;
  extracted: unknown;
  siblings: { filename: string; document_type: string | null; supplier: string | null }[];
}): Promise<AiSummary> {
  const userContent = JSON.stringify({
    document: { filename: context.filename, document_type: context.documentType, extracted: context.extracted },
    org_recent_documents: context.siblings,
  });

  const message = await client().messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 600,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  // Haiku occasionally wraps or malforms JSON — degrade to a fallback rather
  // than throwing a 500 at the caller.
  let p: Partial<AiSummary> = {};
  try {
    const raw = textOf(message).trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    p = JSON.parse(raw) as Partial<AiSummary>;
  } catch {
    p = {};
  }
  const text = (typeof p.text === 'string' ? p.text : 'A summary could not be generated from this document.').trim();
  return {
    // Hard cap to 500 chars even if the model overshoots (cut on a word boundary).
    text: text.length > SUMMARY_MAX_CHARS ? text.slice(0, SUMMARY_MAX_CHARS).replace(/\s+\S*$/, '') + '…' : text,
    total_spend: typeof p.total_spend === 'string' ? p.total_spend : null,
    supplier: typeof p.supplier === 'string' ? p.supplier : null,
    generated_at: new Date().toISOString(),
    model: SUMMARY_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Product categorisation (ProcurePulse)
// ---------------------------------------------------------------------------

/** The fixed produce taxonomy Claude must choose from. */
export const PRODUCE_CATEGORIES = [
  'Fruit',
  'Vegetables',
  'Herbs',
  'Salad & Leafy Greens',
  'Mushrooms',
  'Other',
] as const;

const CATEGORISE_SYSTEM = `You categorise fresh-produce products for a South African fruit & vegetable wholesaler.
For EACH product, assign exactly one category from this fixed list:
- "Fruit" — apples, bananas, citrus, berries, melons, grapes, stone fruit, avocado, pineapple, mango, etc.
- "Vegetables" — potatoes, onions, carrots, tomatoes, butternut, pumpkin, peppers, cabbage, broccoli, cauliflower, green beans, sweetcorn, beetroot, ginger, garlic, etc.
- "Herbs" — basil, coriander, parsley, mint, rosemary, thyme, dill, chives, etc.
- "Salad & Leafy Greens" — lettuce, spinach, rocket, mixed leaves, kale, microgreens, watercress, etc.
- "Mushrooms" — button, portabellini, oyster, shiitake, brown, white mushrooms, etc.
- "Other" — anything that is not fresh produce or is genuinely unclear (eggs, packaging, pallets, deposits, etc.).
Respond with ONLY a JSON object (no prose, no markdown code fences) mapping each product id to its category:
{ "<id>": "Fruit", "<id>": "Vegetables", ... }
Every id you are given MUST appear exactly once. Use ONLY the six category strings above, spelled exactly as shown.`;

/**
 * Assign a produce category to each product by name. Returns a partial map of
 * id → category (only ids the model returned a valid category for). Runs on the
 * Haiku tier — cheap, fast, and accurate enough for a fixed six-way label.
 */
export async function categoriseProducts(
  items: { id: string; name: string }[],
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const message = await client().messages.create({
    model: CATEGORISE_MODEL,
    max_tokens: 8000,
    system: CATEGORISE_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(items.map((i) => ({ id: i.id, name: i.name }))) }],
  });

  let parsed: Record<string, unknown> = {};
  try {
    const raw = textOf(message).trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const allowed = new Set<string>(PRODUCE_CATEGORIES);
  const out: Record<string, string> = {};
  for (const it of items) {
    const c = parsed[it.id];
    if (typeof c === 'string' && allowed.has(c)) out[it.id] = c;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Product-name matching (ProcurePulse — Phase 2 AI suggestions)
// ---------------------------------------------------------------------------

export interface MatchSuggestionInput {
  id: string;
  name: string;
  candidates: { id: string; name: string }[];
}
export interface MatchSuggestion {
  id: string;
  /** chosen candidate id, or null when none is clearly the same product */
  targetId: string | null;
  confidence: number; // 0..100
  reason: string;
}

const MATCH_SYSTEM = `You reconcile messy market-statement product names with a fruit & vegetable wholesaler's canonical catalogue.
For EACH discovered product you get a short list of candidate canonical products. Choose the ONE candidate that is the SAME physical product, or null if none clearly is.
Be conservative — match only when it is genuinely the same item. Different colour / variety / cut / grade / size are DIFFERENT products and must NOT be matched (e.g. "Onions Red" ≠ "Onions White"; "Butternut Whole" ≠ "Butternut Cubed"). Spelling, punctuation, abbreviation, plural and unit-suffix differences for the SAME product ARE matches (e.g. "Cabbage White Quartered" = "Cabbage (W) quarter-cut").
Respond with ONLY a JSON array (no prose, no code fences):
[ { "id": "<discovered id>", "targetId": "<candidate id or null>", "confidence": <0-100>, "reason": "<short>" } ]
Every discovered id MUST appear exactly once. targetId MUST be one of that item's candidate ids, or null.`;

/**
 * Ask Claude (Haiku) to pick the best canonical match for each discovered product
 * from its candidate list. Suggestions only — the caller never auto-links; a human
 * confirms. Returns one entry per input id (coerced; unknown/invalid → null target).
 */
export async function suggestProductMatches(items: MatchSuggestionInput[]): Promise<MatchSuggestion[]> {
  if (items.length === 0) return [];

  const message = await client().messages.create({
    model: MATCH_MODEL,
    max_tokens: 8000,
    system: MATCH_SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  });

  let parsed: unknown = [];
  try {
    const raw = textOf(message).trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const rows = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  const byId = new Map(rows.map((r) => [String(r.id), r]));

  return items.map((it) => {
    const r = byId.get(it.id);
    const allowed = new Set(it.candidates.map((c) => c.id));
    const target = r && typeof r.targetId === 'string' && allowed.has(r.targetId) ? r.targetId : null;
    const confRaw = r && typeof r.confidence === 'number' ? r.confidence : 0;
    return {
      id: it.id,
      targetId: target,
      confidence: Math.max(0, Math.min(100, Math.round(confRaw))),
      reason: r && typeof r.reason === 'string' ? r.reason.slice(0, 200) : '',
    };
  });
}
