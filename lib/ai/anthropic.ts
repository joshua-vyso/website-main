import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { AiSummary } from '@/lib/platform/docu/types';

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
  fields: ExtractedField[];
  line_items: ExtractedLineItem[];
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
  "line_items": [
    {
      "description": string,
      "weight": string,
      "quantity": string,
      "units_per_box": string,
      "unit_price": string,
      "amount": string,
      "confidence": number
    }
  ],
  "overall_confidence": number
}
Rules:
- Include EVERY product row across ALL pages and ALL "PURCHASES ON CARD ID" sections. Do not skip or summarise rows.
- The commodity cell is often a messy comma-separated string like "BABY BUTTERNUT,300G PUNNE,*,0,*,12,*" or "ORANGES,6KG POCKET,NAVEL,2,M,*". From it derive:
    - description = the produce name, cleaned and Title Case (e.g. "Baby Butternut", "Oranges Navel"). Drop packaging words, grade codes, asterisks, and stray numeric codes.
    - weight = the pack/unit weight CONVERTED TO KILOGRAMS, as a plain decimal number with NO unit: "300G" -> "0.3", "500G" -> "0.5", "6KG" -> "6", "18KG" -> "18". "" if no weight is shown.
    - units_per_box = the number of punnets/units packed per box when the line clearly encodes it. For "BABY BUTTERNUT,300G PUNNE,*,0,*,12,*" that is "12". "" if not indicated.
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
    fields: Array.isArray(parsed.fields) ? parsed.fields : [],
    line_items: Array.isArray(parsed.line_items) ? parsed.line_items : [],
    overall_confidence:
      typeof parsed.overall_confidence === 'number' ? parsed.overall_confidence : 0,
  };
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
