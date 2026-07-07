/**
 * Vyso AI runtime — the server-only Anthropic client for the agent. Kept
 * separate from lib/ai/anthropic.ts (the extraction pipeline) so the agent can
 * evolve its own streaming/tool-use surface without touching the parser. Reads
 * the same ANTHROPIC_API_KEY; the key never reaches any client bundle.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

export const agentConfigured = Boolean(apiKey);

export function agentClient(): Anthropic {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

/** A single chat turn in the conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Guardrails on the conversation the client sends us. */
const MAX_MESSAGES = 30;
const MAX_CHARS_PER_MESSAGE = 8000;

/**
 * Validate + clamp the messages the client posted into a safe conversation for
 * the Messages API: only user/assistant string turns, bounded count and length,
 * and it must end on a user turn. Returns null if there's nothing usable.
 */
export function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = content.trim();
    if (!text) continue;
    out.push({ role, content: text.slice(0, MAX_CHARS_PER_MESSAGE) });
  }
  const trimmed = out.slice(-MAX_MESSAGES);
  // The Messages API requires the first message to be a user turn.
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') return null;
  return trimmed;
}
