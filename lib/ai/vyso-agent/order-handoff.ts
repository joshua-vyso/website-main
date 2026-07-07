/**
 * A tiny localStorage bridge that carries an order parsed by Vyso AI (in the
 * chat) over to the New Order builder's "Paste from Vyso AI" panel. Client-safe
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

const KEY = 'vysoai:parsed_order';

export function stashParsedOrder(order: ParsedOrder): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function readParsedOrder(): ParsedOrder | null {
  try {
    const raw = localStorage.getItem(KEY);
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
  } catch {
    /* non-fatal */
  }
}
