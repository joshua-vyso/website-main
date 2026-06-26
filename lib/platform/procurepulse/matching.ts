/**
 * Deterministic product-name matching for ProcurePulse (Phase 1 — no AI).
 *
 * Market-statement descriptions Doc-U feeds in (cleaned Title Case, no unit
 * suffix) diverge from the customer's price-list names ("Apples-Golden (kg)" vs
 * "Apples Golden"). These helpers normalise both sides and surface likely
 * duplicate pairs for a human to confirm/clean on the Products page.
 */

/** Words that are packaging/unit noise, not part of the produce identity. */
const NOISE_WORDS = new Set([
  'kg', 'kgs', 'g', 'gr', 'gram', 'grams', 'ml', 'l', 'lt', 'ltr', 'ea', 'each',
  'pkt', 'packet', 'pack', 'box', 'boxes', 'bag', 'bags', 'punnet', 'punnets',
  'bunch', 'bunches', 'pocket', 'pockets', 'tray', 'trays', 'crate', 'crates',
  'loose', 'fresh',
]);

/**
 * Canonical comparison key: lowercase, drop parentheticals + weight/unit tokens,
 * punctuation → space, light singularisation. Applied to BOTH sides so spelling
 * differences collapse. NOT for display (see cleanDisplayName).
 */
export function normalizeName(input: string): string {
  const base = (input ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // (kg), (w), (pkt) …
    .replace(/[0-9]+\s*(kg|kgs|g|gr|ml|l|lt|ltr|ea|pkt)\b/g, ' ') // 100gr, 6kg
    .replace(/[^a-z0-9]+/g, ' ') // dashes, slashes, commas, asterisks → space
    .trim();
  const tokens = base
    .split(/\s+/)
    .filter((t) => t && !NOISE_WORDS.has(t) && !/^\d+$/.test(t))
    .map((t) => {
      let w = t;
      // Light plural fold (consistent on both sides): drop a trailing "s" (but not
      // "ss" → glass/grass), then collapse "-oe" so potatoes→potato, tomatoes→tomato.
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
      if (w.length > 3 && w.endsWith('oe')) w = w.slice(0, -1);
      return w;
    });
  // Sort tokens so word order doesn't matter ("oranges navel" == "navel oranges").
  return tokens.sort().join(' ');
}

/** A clean, Title-Cased display name suggestion (keeps word order, drops noise). */
export function cleanDisplayName(input: string): string {
  const base = (input ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9]+\s*(kg|kgs|g|gr|ml|l|lt|ltr|ea|pkt)\b/gi, ' ')
    .replace(/[-_/,*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = base.split(' ').filter((w) => w && !NOISE_WORDS.has(w.toLowerCase()));
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || input.trim();
}

/** Sørensen–Dice coefficient over the token sets of two normalized strings. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return (2 * inter) / (ta.size + tb.size);
}

export interface MatchItem {
  id: string;
  name: string;
  source_document_id: string | null;
}

export interface MatchCandidate {
  /** The "discovered" (usually Doc-U-fed) item that should be reconciled. */
  itemId: string;
  discoveredName: string;
  /** Pre-fill for the canonical name — the reference item's existing name. */
  suggestedName: string;
  /** The reference item this likely duplicates (merge target hint). */
  targetItemId: string;
  score: number;
  /** How the match was found: a deterministic exact-normalized cluster, or an AI suggestion. */
  method: 'exact' | 'ai';
  /** Short model rationale (AI suggestions only). */
  rationale?: string | null;
}

/**
 * Find duplicate products across the catalogue by EXACT normalized match only
 * (Phase 1, per the "auto-link only exact normalized" decision). Genuinely
 * different products — "Onions Red" vs "Onions White" — never collide, so a
 * confirmed merge is always safe. Fuzzy/AI suggestions are Phase 2.
 *
 * Items are grouped by normalized key; any group with >1 member is a duplicate
 * cluster. Within a cluster the canonical (merge target) is the seeded item
 * (source_document_id null), else the lowest id — fully deterministic. Every
 * other member becomes a "discovered" row pointing at it. Confirmed/dismissed
 * raw names are excluded. O(n).
 */
export function buildMatchCandidates(
  items: MatchItem[],
  excludeRawNames: Set<string>,
): MatchCandidate[] {
  const groups = new Map<string, (MatchItem & { n: string })[]>();
  for (const it of items) {
    const n = normalizeName(it.name);
    if (!n) continue; // all-noise name → nothing to match on
    const arr = groups.get(n);
    if (arr) arr.push({ ...it, n });
    else groups.set(n, [{ ...it, n }]);
  }

  const out: MatchCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Canonical = seeded item (source null) preferred, then lowest id.
    const sorted = [...group].sort((a, b) => {
      const aSeed = a.source_document_id == null ? 0 : 1;
      const bSeed = b.source_document_id == null ? 0 : 1;
      if (aSeed !== bSeed) return aSeed - bSeed;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const canonical = sorted[0];
    for (const disc of sorted.slice(1)) {
      if (excludeRawNames.has(disc.name.trim().toLowerCase())) continue;
      out.push({
        itemId: disc.id,
        discoveredName: disc.name,
        suggestedName: canonical.name,
        targetItemId: canonical.id,
        score: 1,
        method: 'exact',
      });
    }
  }

  return out.sort((a, b) => a.discoveredName.localeCompare(b.discoveredName));
}

/** A discovered item plus the fuzzy canonical candidates an AI should choose among. */
export interface FuzzyTarget {
  item: MatchItem;
  candidates: { id: string; name: string; score: number }[];
}

// Low floor: just enough shared signal to be worth asking the model about (it makes
// the final call). Kept low so hard cases ("Cabbage White Quartered" vs "Cabbage (W)
// quater-cut") still reach the AI; the top-N cap bounds how many candidates it sees.
const FUZZY_FLOOR = 0.2;

/**
 * Build the work-list for AI matching (Phase 2): each Doc-U-fed item whose
 * normalized name is UNIQUE (so exact matching didn't already pair it) and isn't
 * already aliased, together with its top fuzzy canonical candidates. The model
 * then picks the right one (or none) per item — we never auto-link.
 */
export function buildFuzzyTargets(
  items: MatchItem[],
  excludeRawNames: Set<string>,
  excludeItemIds: Set<string> = new Set(),
  topN = 5,
): FuzzyTarget[] {
  const norm = items.map((it) => ({ ...it, n: normalizeName(it.name) }));
  const countByNorm = new Map<string, number>();
  for (const x of norm) if (x.n) countByNorm.set(x.n, (countByNorm.get(x.n) ?? 0) + 1);

  const out: FuzzyTarget[] = [];
  for (const a of norm) {
    if (!a.n) continue;
    if (a.source_document_id == null) continue; // only fed items are "discovered"
    if ((countByNorm.get(a.n) ?? 0) > 1) continue; // exact cluster → Phase 1 owns it
    if (excludeItemIds.has(a.id)) continue; // already has an alias under some name
    if (excludeRawNames.has(a.name.trim().toLowerCase())) continue;

    const candidates: { id: string; name: string; score: number }[] = [];
    for (const b of norm) {
      if (b.id === a.id || !b.n) continue;
      const score = diceCoefficient(a.n, b.n);
      if (score >= FUZZY_FLOOR && score < 1) candidates.push({ id: b.id, name: b.name, score });
    }
    if (candidates.length === 0) continue;
    candidates.sort((x, y) => y.score - x.score);
    out.push({
      item: { id: a.id, name: a.name, source_document_id: a.source_document_id },
      candidates: candidates.slice(0, topN),
    });
  }
  return out;
}
