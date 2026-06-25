import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchSettings } from '@/lib/platform/procurepulse-queries';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { ProductsManager } from '@/components/platform/procurepulse/ProductsManager';

/** Products catalogue — edit names, units, thresholds, base prices; add/delete. */
export default async function ProductsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();
  const [items, settings] = await Promise.all([fetchStock(db, orgId), fetchSettings(db, orgId)]);

  return <ProductsManager items={items} units={allUnits(settings?.custom_units)} />;
}
