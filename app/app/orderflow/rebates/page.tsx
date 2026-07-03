import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import type { OfCustomer } from '@/lib/platform/orderflow';
import { RebatesView } from '@/components/platform/orderflow/RebatesView';

/**
 * OrderFlow Rebates — set a standing rebate % per customer. The value is
 * snapshotted onto each new invoice and auto-deducted from its total (off the
 * subtotal, after any discount, before VAT). Server-fetches the customer list
 * and hands it to the client view. Empty-safe and migration-safe (rebate_pct
 * lives in supabase/rebates.sql; select('*') degrades if it hasn't been run).
 */
export default async function OrderFlowRebatesPage() {
  const session = await getPlatformSession();
  const org = session?.org ?? null;

  if (!org) {
    return <RebatesView customers={[]} />;
  }

  const sb = await createServerSupabase();
  const { data } = await sb.from('of_customers').select('*').eq('org_id', org.id).order('name');

  return <RebatesView customers={(data ?? []) as OfCustomer[]} />;
}
