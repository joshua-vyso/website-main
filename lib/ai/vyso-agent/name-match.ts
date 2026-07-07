/**
 * Match a query string to exactly one row by name, using the SAME rule the
 * OrderFlow New Order builder uses — so Vyso AI's narration ("matched 5 of 5")
 * can never drift from what the builder actually does. An exact (case-
 * insensitive) name wins; otherwise fall back to a substring match ONLY when the
 * query is ≥4 chars AND exactly one row (whose name is also ≥4 chars) contains it
 * or is contained by it. Ambiguous or short → no match.
 *
 * Pure and runtime-agnostic (no `server-only` / `use client`) so the server
 * order-draft resolver and the client builder share one implementation.
 */
export function matchByName<T>(rows: T[], query: string, nameOf: (r: T) => string): T | null {
  const wanted = (query ?? '').trim().toLowerCase();
  if (!wanted) return null;
  const exact = rows.find((r) => nameOf(r).trim().toLowerCase() === wanted);
  if (exact) return exact;
  if (wanted.length < 4) return null;
  const cands = rows.filter((r) => {
    const n = nameOf(r).trim().toLowerCase();
    return n.length >= 4 && (n.includes(wanted) || wanted.includes(n));
  });
  return cands.length === 1 ? cands[0] : null;
}
