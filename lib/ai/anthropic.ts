import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-only Anthropic integration. The API key is read from a non-public env
 * var and NEVER reaches any client bundle. Both the website and the mobile app
 * use AI exclusively through the /api/ai/* route handlers that wrap this module.
 */
const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

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
  overall_confidence: number;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

const EXTRACT_INSTRUCTION = `You are Doc-U, Vyso's document-extraction engine for SME food & wholesale businesses.
Extract the key fields from the attached document (an invoice, supplier statement, delivery note, price list, or order).
Respond with ONLY a JSON object (no prose, no markdown code fences) of exactly this shape:
{
  "document_type": "invoice" | "statement" | "delivery_note" | "price_list" | "order",
  "fields": [ { "label": string, "value": string, "confidence": number } ],
  "overall_confidence": number
}
confidence and overall_confidence are 0–100. Include the most useful fields for the document type
(e.g. Supplier, Document #, Date, Total). Report your honest confidence for each field.`;

/** Parse a PDF or image document into structured fields. */
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
    model: MODEL,
    max_tokens: 2048,
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
