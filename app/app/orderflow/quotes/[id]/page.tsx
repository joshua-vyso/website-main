import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getQuoteDetail, getOfSettings } from '@/lib/platform/orderflow-data';
import { DEFAULT_OF_SETTINGS } from '@/lib/platform/orderflow';
import { QuoteDetail } from '@/components/platform/orderflow/QuoteDetail';

/**
 * Quote detail — server-fetches the quote fresh on every navigation (never the
 * layout provider) so a just-created quote is always found.
 */
export default async function OrderFlowQuotePage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return (
      <QuoteDetail
        quote={null}
        items={[]}
        customer={null}
        companyProfile={null}
        settings={DEFAULT_OF_SETTINGS}
        orgName={null}
      />
    );
  }

  const [detail, settings] = await Promise.all([getQuoteDetail(orgId, id), getOfSettings(orgId)]);

  return (
    <QuoteDetail
      quote={detail.quote}
      items={detail.items}
      customer={detail.customer}
      companyProfile={detail.companyProfile}
      settings={settings}
      orgName={session?.org?.name ?? null}
    />
  );
}
