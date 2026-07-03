import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getPriceListsData } from '@/lib/platform/orderflow-data';
import { PriceListsView } from '@/components/platform/orderflow/PriceListsView';

/**
 * OrderFlow Price lists manager — the full editor for customer pricing. Writes
 * go to Core Data (pl_price_lists / pl_overrides); PricePilot reads the same
 * tables. The list table + create/edit/duplicate lives here alongside the
 * per-product override editor (margins, custom prices, bulk update, CSV
 * import/export). Server-fetches the whole slice and hands it to the client
 * view. Empty-safe and migration-safe (see PriceListsView).
 */
export default async function OrderFlowPriceListsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;

  if (!orgId) {
    return <PriceListsView priceLists={[]} overrides={[]} products={[]} customers={[]} latestStatementPrices={{}} />;
  }

  const data = await getPriceListsData(orgId);

  return (
    <PriceListsView
      priceLists={data.priceLists}
      overrides={data.overrides}
      products={data.products}
      customers={data.customers}
      latestStatementPrices={data.latestStatementPrices}
    />
  );
}
