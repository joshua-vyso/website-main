import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import {
  fetchStock,
  fetchSettings,
  fetchProductAliases,
  fetchThresholds,
  fetchProductUnits,
} from '@/lib/platform/procurepulse-queries';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { buildMatchCandidates, type MatchCandidate } from '@/lib/platform/procurepulse/matching';
import { aiConfigured } from '@/lib/ai/anthropic';
import { ProductsTabs } from '@/components/platform/procurepulse/ProductsTabs';

/** Products catalogue — edit names, units, thresholds, base prices; add/delete;
 *  plus a product-matching section to reconcile duplicate / mismatched names. */
export default async function ProductsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();
  const [items, settings, aliases, thresholds, productUnits] = await Promise.all([
    fetchStock(db, orgId),
    fetchSettings(db, orgId),
    fetchProductAliases(db, orgId),
    fetchThresholds(db, orgId),
    fetchProductUnits(db, orgId),
  ]);

  // Exclude every already-ruled name (confirmed / dismissed / pending) from the
  // live exact-match pass so nothing is offered twice.
  const exclude = new Set(aliases.map((a) => a.raw_name.trim().toLowerCase()));
  const exactCandidates = buildMatchCandidates(
    items.map((i) => ({ id: i.id, name: i.name, source_document_id: i.source_document_id })),
    exclude,
  );

  // Pending AI suggestions (Phase 2) → candidates, keeping only those whose items still exist.
  const itemIds = new Set(items.map((i) => i.id));
  const nameById = new Map(items.map((i) => [i.id, i.name]));
  const aiCandidates: MatchCandidate[] = aliases
    .filter(
      (a) =>
        a.status === 'pending' &&
        a.method === 'ai' &&
        a.discovered_item_id &&
        a.stock_item_id &&
        itemIds.has(a.discovered_item_id) &&
        itemIds.has(a.stock_item_id),
    )
    .map((a) => ({
      itemId: a.discovered_item_id as string,
      discoveredName: a.raw_name,
      suggestedName: a.suggested_name ?? nameById.get(a.stock_item_id as string) ?? '',
      targetItemId: a.stock_item_id as string,
      score: (a.confidence ?? 0) / 100,
      method: 'ai' as const,
      rationale: a.ai_rationale,
    }));

  // Exact matches win over AI suggestions for the same item (no duplicate React keys).
  const exactItemIds = new Set(exactCandidates.map((c) => c.itemId));
  const candidates = [...exactCandidates, ...aiCandidates.filter((c) => !exactItemIds.has(c.itemId))];

  return (
    <ProductsTabs
      items={items}
      units={allUnits(settings?.custom_units)}
      candidates={candidates}
      aiEnabled={aiConfigured}
      thresholds={thresholds}
      productUnits={productUnits}
    />
  );
}
