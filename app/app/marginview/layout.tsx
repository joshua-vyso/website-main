import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

const TABS = [
  { label: 'Overview', href: '/app/marginview' },
  { label: 'Budget', href: '/app/marginview/budget' },
  { label: 'Goals', href: '/app/marginview/goals' },
  { label: 'Forecast', href: '/app/marginview/forecast' },
  { label: 'Scenarios', href: '/app/marginview/scenarios' },
];

/** PlanWise chrome: Doc-U-style underline sub-nav across its planning screens. */
export default async function PlanWiseLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/marginview" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
