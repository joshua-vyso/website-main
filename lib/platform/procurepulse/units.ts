/**
 * Units of measurement for the product catalogue. A unit is either a COUNT
 * (boxes, bags, punnets…) or a WEIGHT (kg, g). The conversion engine only moves
 * between those two dimensions, using the per-document weights Doc-U extracted.
 */

export const BUILT_IN_UNITS: readonly string[] = [
  'kg', 'g', 'boxes', 'bags', 'ea', 'punnets', 'bunches', 'trays', 'crates', 'pkts', 'L', 'ml', 'units',
];

const WEIGHT_UNITS = new Set(['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'kgs', 'gs']);

export type UnitDimension = 'weight' | 'count';

/** Classify a unit. Anything not recognised as a weight is treated as a count. */
export function unitDimension(unit: string | null | undefined): UnitDimension {
  return WEIGHT_UNITS.has((unit ?? '').trim().toLowerCase()) ? 'weight' : 'count';
}

/** kg → this weight unit (Doc-U extracts weights in kg, where <1 means grams). */
export function kgTo(unit: string): number {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams' || u === 'gs') return 1000;
  return 1; // kg and everything else weight-ish
}

/** Built-in units plus the org's custom ones, de-duplicated (case-insensitive). */
export function allUnits(custom: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...BUILT_IN_UNITS, ...(custom ?? [])]) {
    const t = (u ?? '').trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** Does changing fromUnit → toUnit cross the count/weight boundary (→ recalc)? */
export function crossesDimension(fromUnit: string, toUnit: string): boolean {
  return unitDimension(fromUnit) !== unitDimension(toUnit);
}
