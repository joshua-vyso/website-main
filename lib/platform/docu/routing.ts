/**
 * Push-to-module routing (feature 10). Recommends which Vyso modules a document
 * should feed, by document type. Labels come from the shared MODULES registry.
 */
import { MODULE_BY_KEY } from '@/lib/platform/modules';
import type { DocumentType, FeatureKey } from '@/lib/platform/types';
import type { ModuleRoute } from './types';

const RULES: Record<DocumentType, { key: FeatureKey; reason: string; recommended: boolean }[]> = {
  invoice: [
    { key: 'pricepilot', reason: 'Track unit prices and margin', recommended: true },
    { key: 'procurepulse', reason: 'Update stock + spend', recommended: true },
  ],
  statement: [
    { key: 'procurepulse', reason: 'Reconcile stock from market lines', recommended: true },
    { key: 'reportgen', reason: 'Feed spend analytics', recommended: false },
  ],
  delivery_note: [
    { key: 'procurepulse', reason: 'Confirm received stock', recommended: true },
    { key: 'wastelog', reason: 'Flag shrinkage vs ordered', recommended: false },
  ],
  price_list: [
    { key: 'pricepilot', reason: 'Refresh supplier price benchmarks', recommended: true },
  ],
  order: [
    { key: 'orderflow', reason: 'Track the purchase order', recommended: true },
    { key: 'procurepulse', reason: 'Forecast incoming stock', recommended: false },
  ],
};

export function getRoutes(docType: DocumentType | null): ModuleRoute[] {
  if (!docType) return [];
  return (RULES[docType] ?? []).map((r) => ({
    key: r.key,
    label: MODULE_BY_KEY[r.key]?.label ?? r.key,
    reason: r.reason,
    recommended: r.recommended,
  }));
}
