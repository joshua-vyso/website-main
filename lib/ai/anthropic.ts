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

const SUMMARY_SYSTEM = `You are Doc-U's operational analyst for an SME food & wholesale business in South Africa.
Given ONE document's extracted data plus a short list of the organisation's other recent documents, write a concise operational briefing for the owner.
Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "headline": string,
  "total_spend": string | null,
  "supplier": string | null,
  "key_categories": string[],
  "price_movements": [{ "label": string, "direction": "up" | "down" | "flat", "detail": string }],
  "discrepancies": string[],
  "suggested_actions": string[],
  "linked_documents": [{ "label": string, "relation": string }]
}
Rules:
- Tone: a calm, specific operations analyst. The headline is one sentence.
- Money in Rand, formatted like "R 8,240.00". total_spend null if the document carries no total.
- key_categories: the produce/category groups in the lines (e.g. "Citrus", "Root vegetables").
- Use empty arrays when nothing applies. NEVER invent figures the data does not support.
- linked_documents references the org's other documents where a relationship is plausible (e.g. the matching invoice for a statement).`;

/**
 * Generate a cached operational analyst briefing for a document. Returns the
 * coerced AiSummary; callers cache it on documents.ai_summary.
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
    model: MODEL,
    max_tokens: 1500,
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = textOf(message).trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const p = JSON.parse(raw) as Partial<AiSummary>;
  return {
    headline: typeof p.headline === 'string' ? p.headline : 'Operational summary unavailable.',
    total_spend: typeof p.total_spend === 'string' ? p.total_spend : null,
    supplier: typeof p.supplier === 'string' ? p.supplier : null,
    key_categories: Array.isArray(p.key_categories) ? p.key_categories : [],
    price_movements: Array.isArray(p.price_movements) ? p.price_movements : [],
    discrepancies: Array.isArray(p.discrepancies) ? p.discrepancies : [],
    suggested_actions: Array.isArray(p.suggested_actions) ? p.suggested_actions : [],
    linked_documents: Array.isArray(p.linked_documents) ? p.linked_documents : [],
    generated_at: new Date().toISOString(),
    model: MODEL,
  };
}
