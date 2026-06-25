import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { CustomersManager } from '@/components/platform/orderflow/CustomersManager';
import type { OfCustomer } from '@/lib/platform/orderflow';

export default async function OrderFlowCustomersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();
  const { data } = await db
    .from('of_customers')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  return <CustomersManager customers={(data ?? []) as OfCustomer[]} />;
}
