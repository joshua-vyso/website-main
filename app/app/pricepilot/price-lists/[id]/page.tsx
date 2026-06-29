import Link from 'next/link';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { PriceListDetail } from '@/components/platform/pricepilot/PriceListDetail';
import { VersionHistory } from '@/components/platform/pricepilot/VersionHistory';
import type { PlPriceList, PlOverride, PlVersion, MarginSnapshot } from '@/lib/platform/pricepilot';

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: listRow }, { data: products }, { data: overrideRows }, { data: versionRows }, { data: profileRows }] =
    await Promise.all([
      db.from('pl_price_lists').select('*').eq('id', id).maybeSingle(),
      db.from('pp_stock_items').select('id, name, unit, avg_unit_price').eq('org_id', orgId).order('name').limit(2000),
      db.from('pl_overrides').select('stock_item_id, margin_pct').eq('price_list_id', id),
      db.from('pl_price_list_versions').select('*').eq('price_list_id', id).order('version_no', { ascending: false }),
      db.from('profiles').select('*').eq('org_id', orgId),
    ]);

  const list = listRow as PlPriceList | null;
  if (!list) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Price list not found</h1>
          <Link href="/app/pricepilot/price-lists" className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#1A1C1E] px-4 text-[13px] font-medium text-white">
            Back to price lists
          </Link>
        </div>
      </div>
    );
  }

  let customerName = 'All customers';
  if (list.customer_id) {
    const { data: c } = await db.from('of_customers').select('name').eq('id', list.customer_id).maybeSingle();
    customerName = (c as { name?: string } | null)?.name ?? 'All customers';
  }

  const overrides: Record<string, number> = {};
  for (const o of (overrideRows ?? []) as Pick<PlOverride, 'stock_item_id' | 'margin_pct'>[]) {
    overrides[o.stock_item_id] = Number(o.margin_pct);
  }

  // Version history extras (degrade gracefully before pl-versions.sql is applied).
  const versions = ((versionRows ?? []) as PlVersion[]).map((v) => ({
    ...v,
    default_margin_pct: Number(v.default_margin_pct),
    overrides: Array.isArray(v.overrides) ? v.overrides.map((o) => ({ stock_item_id: o.stock_item_id, margin_pct: Number(o.margin_pct) })) : [],
  }));
  const live: MarginSnapshot = {
    defaultMargin: Number(list.default_margin_pct) || 0,
    overrides: Object.entries(overrides).map(([stock_item_id, margin_pct]) => ({ stock_item_id, margin_pct })),
  };
  const authors: Record<string, string> = {};
  for (const p of (profileRows ?? []) as Record<string, unknown>[]) {
    const pid = p.id ? String(p.id) : '';
    if (!pid) continue;
    const raw = (p.full_name || p.name || p.email || '') as string;
    authors[pid] = raw ? String(raw).split('@')[0] : 'Team';
  }
  const productNames: Record<string, string> = {};
  for (const p of (products ?? []) as { id: string; name: string }[]) productNames[p.id] = p.name;

  return (
    <div>
      <PriceListDetail
        list={list}
        customerName={customerName}
        products={(products ?? []) as { id: string; name: string; unit: string | null; avg_unit_price: number | null }[]}
        overrides={overrides}
      />
      <VersionHistory
        priceListId={list.id}
        orgId={list.org_id}
        live={live}
        versions={versions}
        authors={authors}
        productNames={productNames}
      />
    </div>
  );
}
