import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getCustomerProfile } from '@/lib/platform/orderflow-data';
import { CustomerProfile } from '@/components/platform/orderflow/CustomerProfile';

/**
 * Customer profile — server-fetches the record fresh on every navigation (never
 * a shared layout provider, per contract rule 3) so a just-created customer is
 * always visible. Dynamic params are a Promise in this Next build.
 */
export default async function OrderFlowCustomerPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;

  if (!orgId) {
    return <CustomerProfile data={null} orgName={session?.org?.name ?? null} />;
  }

  const data = await getCustomerProfile(orgId, id);
  return <CustomerProfile data={data} orgName={session?.org?.name ?? null} />;
}
