import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getQuotesData, getOfSettings } from '@/lib/platform/orderflow-data';
import { DEFAULT_OF_SETTINGS } from '@/lib/platform/orderflow';
import { QuotesView } from '@/components/platform/orderflow/QuotesView';

/** Quotes list — server-fetches quotes + their items + customers + settings. */
export default async function OrderFlowQuotesPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return <QuotesView quotes={[]} items={[]} customers={[]} settings={DEFAULT_OF_SETTINGS} />;
  }

  const [data, settings] = await Promise.all([getQuotesData(orgId), getOfSettings(orgId)]);

  return <QuotesView quotes={data.quotes} items={data.items} customers={data.customers} settings={settings} />;
}
