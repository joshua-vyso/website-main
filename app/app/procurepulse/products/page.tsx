import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import {
  fetchStock,
  fetchSettings,
  fetchProductAliases,
} from '@/lib/platform/procurepulse-queries';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { buildMatchCandidates } from '@/lib/platform/procurepulse/matching';
import { ProductsManager } from '@/components/platform/procurepulse/ProductsManager';
import { ProductMatching } from '@/components/platform/procurepulse/ProductMatching';

/** Products catalogue — edit names, units, thresholds, base prices; add/delete;
 *  plus a product-matching section to reconcile duplicate / mismatched names. */
export default async function ProductsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();
  const [items, settings, aliases] = await Promise.all([
    fetchStock(db, orgId),
    fetchSettings(db, orgId),
    fetchProductAliases(db, orgId),
  ]);

  // Skip any raw name the user has already confirmed or dismissed.
  const exclude = new Set(aliases.map((a) => a.raw_name.trim().toLowerCase()));
  const candidates = buildMatchCandidates(
    items.map((i) => ({ id: i.id, name: i.name, source_document_id: i.source_document_id })),
    exclude,
  );

  return (
    <div className="space-y-8">
      <ProductsManager items={items} units={allUnits(settings?.custom_units)} />
      <ProductMatching candidates={candidates} />
    </div>
  );
}
