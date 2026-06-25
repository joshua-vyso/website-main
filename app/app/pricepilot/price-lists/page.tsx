import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { PriceListsView, type PriceListRow } from '@/components/platform/pricepilot/PriceListsView';
import type { PlPriceList } from '@/lib/platform/pricepilot';

export default async function PricePilotPriceListsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: lists }, { data: customers }] = await Promise.all([
    db.from('pl_price_lists').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    db.from('of_customers').select('id, name').eq('org_id', orgId).order('name'),
  ]);

  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const rows: PriceListRow[] = ((lists ?? []) as PlPriceList[]).map((l) => ({
    id: l.id,
    name: l.name,
    customer_name: (l.customer_id && custName.get(l.customer_id)) || 'All customers',
    default_margin_pct: l.default_margin_pct,
    cadence: l.cadence,
    created_at: l.created_at,
  }));

  return <PriceListsView lists={rows} customers={(customers ?? []) as { id: string; name: string }[]} />;
}
