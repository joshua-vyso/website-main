import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getBuilderContext, type BuilderContext } from '@/lib/platform/orderflow-data';
import { DEFAULT_OF_SETTINGS } from '@/lib/platform/orderflow';
import { NewOrderBuilder } from '@/components/platform/orderflow/OrdersView';

const EMPTY_CONTEXT: BuilderContext = {
  customers: [],
  addresses: [],
  products: [],
  priceLists: [],
  overrides: [],
  paymentTerms: [],
  settings: { ...DEFAULT_OF_SETTINGS },
};

export default async function NewOrderPage(ctx: { searchParams: Promise<{ customer?: string }> }) {
  const sp = await ctx.searchParams;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const context = orgId ? await getBuilderContext(orgId) : EMPTY_CONTEXT;

  return <NewOrderBuilder context={context} defaultCustomerId={sp?.customer ?? null} />;
}
