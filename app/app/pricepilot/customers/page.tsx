import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { CustomersView, type CustomerRow } from '@/components/platform/pricepilot/CustomersView';
import {
  pickBaseList,
  priceListValidity,
  DEFAULT_TARGET_MARGIN,
  type PlPriceList,
  type PlTargets,
} from '@/lib/platform/pricepilot';

export default async function PricePilotCustomersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: customers }, { data: lists }, { data: targetsRow }] = await Promise.all([
    db.from('of_customers').select('id, name').eq('org_id', orgId).order('name', { ascending: true }),
    db.from('pl_price_lists').select('*').eq('org_id', orgId),
    db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
  ]);

  const priceLists = (lists ?? []) as PlPriceList[];
  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;
  const base = pickBaseList(priceLists);
  const baseMargin = base ? Number(base.default_margin_pct) : null;
  const today = new Date();

  const rows: CustomerRow[] = ((customers ?? []) as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
    lists: priceLists
      .filter((l) => l.customer_id === c.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((l) => ({
        id: l.id,
        name: l.name,
        margin: Number(l.default_margin_pct),
        cadence: l.cadence,
        valid_from: l.valid_from ?? null,
        valid_until: l.valid_until ?? null,
        validity: priceListValidity(l, today),
      })),
  }));

  return <CustomersView customers={rows} baseMargin={baseMargin} target={target} />;
}
