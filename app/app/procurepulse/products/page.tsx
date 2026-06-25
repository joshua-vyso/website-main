import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock } from '@/lib/platform/procurepulse-queries';
import { ProductsManager } from '@/components/platform/procurepulse/ProductsManager';

/** Products catalogue — edit names, units, thresholds, base prices; add/delete. */
export default async function ProductsPage() {
  const session = await getPlatformSession();
  const db = await createServerSupabase();
  const items = await fetchStock(db, session?.org?.id ?? '');

  return <ProductsManager items={items} />;
}
