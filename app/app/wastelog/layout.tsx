import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getWasteWatchData } from '@/lib/platform/wastewatch-data';
import { SubNav } from '@/components/platform/SubNav';
import { WasteWatchProvider } from '@/components/platform/wastewatch/categories';

const EMPTY = { categories: [], events: [], devices: [], employeeStats: [], recipeStats: [], preventable: { preventable: 0, unavoidable: 0 } };

const TABS = [
  { label: 'Overview', href: '/app/wastelog' },
  { label: 'Waste Log', href: '/app/wastelog/log' },
  { label: 'Analytics', href: '/app/wastelog/analytics' },
  { label: 'Devices', href: '/app/wastelog/devices' },
];

/** WasteWatch chrome: Doc-U-style underline sub-nav across its waste-intelligence screens. */
export default async function WasteWatchLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getWasteWatchData(session.org.id) : EMPTY;

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/wastelog" />
      <WasteWatchProvider data={data}>
        <div className="mt-6">{children}</div>
      </WasteWatchProvider>
    </div>
  );
}
