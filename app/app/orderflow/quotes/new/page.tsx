import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getBuilderContext } from '@/lib/platform/orderflow-data';
import { QuoteBuilder } from '@/components/platform/orderflow/QuoteBuilder';

/** New-quote page — server-fetches builder context (customers, products, price lists, settings). */
export default async function NewQuotePage(ctx: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await ctx.searchParams;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Not connected</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">Sign in to create a quote.</p>
        <Link href="/app/orderflow/quotes" className="mt-3 inline-block text-[13px] font-medium text-[#1E5E54] hover:underline">
          ← Back to quotes
        </Link>
      </div>
    );
  }

  const ctxData = await getBuilderContext(orgId);

  return (
    <QuoteBuilder
      customers={ctxData.customers}
      addresses={ctxData.addresses}
      products={ctxData.products}
      priceLists={ctxData.priceLists}
      overrides={ctxData.overrides}
      settings={ctxData.settings}
      initialCustomerId={customer ?? null}
    />
  );
}
