/**
 * A tiny localStorage bridge that carries an order parsed by Finch (in the
 * chat) over to the New Order builder's "Paste from Finch" panel. Client-safe
 * (no server imports) — imported by both the chat modal (writes) and the builder
 * prefill (reads).
 */
export interface ParsedOrderItem {
  name: string;
  qty: number;
  unit_price: number;
}

export interface ParsedOrder {
  customerName: string | null;
  /** 0–100 confidence the customer name was read correctly. */
  customerConfidence?: number;
  items: ParsedOrderItem[];
  /** Where it came from, for the panel copy. */
  filename?: string;
}

const KEY = 'finch:parsed_order';
/** Pre-rebrand key — dual-read only, so an order handed off just before deploy
 *  (still sitting in a user's localStorage under the old key) isn't dropped. */
const LEGACY_KEY = 'vysoai:parsed_order';

export function stashParsedOrder(order: ParsedOrder): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function readParsedOrder(): ParsedOrder | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParsedOrder;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearParsedOrder(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* non-fatal */
  }
}
