import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchSettings } from '@/lib/platform/procurepulse-queries';
import { PageHead, Toggle } from '@/components/platform/procurepulse/ui';
import { UnitsCard } from '@/components/platform/procurepulse/UnitsCard';

export default async function ProcurePulseSettings() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const settings = await fetchSettings(db, orgId);

  const notifyLowStock = settings?.notify_low_stock ?? true;
  const notifyDirectDocs = settings?.notify_direct_docs ?? true;
  const notifyMarketStatements = settings?.notify_market_statements ?? true;
  const notifyPriceSpikes = settings?.notify_price_spikes ?? true;
  const weeklySummary = settings?.weekly_summary ?? false;
  const defaultSupplier = settings?.default_supplier ?? '—';
  const quietHours = settings?.quiet_hours ?? '—';

  const notificationRows = [
    {
      label: 'Low-stock alerts',
      sub: 'When a product drops below its threshold',
      on: notifyLowStock,
    },
    {
      label: 'New direct documents',
      sub: 'Invoices & delivery notes added in Doc-U',
      on: notifyDirectDocs,
    },
    {
      label: 'New market statements',
      sub: 'JHB Fresh Produce Market buyer statements',
      on: notifyMarketStatements,
    },
    {
      label: 'Price spikes',
      sub: "When a product's price jumps over 10%",
      on: notifyPriceSpikes,
    },
    {
      label: 'Weekly summary',
      sub: 'Monday digest of stock & spend',
      on: weeklySummary,
    },
  ];

  const defaultRows = [
    { label: 'Default supplier', value: defaultSupplier },
    { label: 'Quiet hours', value: quietHours },
  ];

  return (
    <div>
      <PageHead title="Settings" subtitle="Notifications, defaults and units · thresholds live on the Products tab" />

      <div className="mt-4 max-w-[820px] space-y-4">
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[15px] font-medium text-[#1A1C1E] mb-1">Notifications</div>
          <div>
            {notificationRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-t border-[#EFEFEC] py-3.5"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-[#1A1C1E]">{row.label}</div>
                  <div className="text-[12px] text-[#9A9DA1]">{row.sub}</div>
                </div>
                <div className="shrink-0">
                  <Toggle on={row.on} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
          <div className="text-[15px] font-medium text-[#1A1C1E] mb-1">Defaults</div>
          <div>
            {defaultRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-t border-[#EFEFEC] py-3.5"
              >
                <div className="text-[14px] font-medium text-[#1A1C1E]">{row.label}</div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[14px] text-[#5F6368]">{row.value}</span>
                  <span className="text-[16px] text-[#9A9DA1]">›</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <UnitsCard initialCustom={settings?.custom_units ?? []} />
      </div>
    </div>
  );
}
