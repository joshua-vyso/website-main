import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

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

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/wastelog" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
