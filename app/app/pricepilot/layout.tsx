import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

const TABS = [
  { label: 'Dashboard', href: '/app/pricepilot' },
  { label: 'Products', href: '/app/pricepilot/products' },
  { label: 'Price lists', href: '/app/pricepilot/price-lists' },
  { label: 'Recommendations', href: '/app/pricepilot/recommendations' },
  { label: 'Recent sales', href: '/app/pricepilot/recent-sales' },
  { label: 'Sales hub', href: '/app/pricepilot/sales-hub' },
  { label: 'Complaints', href: '/app/pricepilot/complaints' },
  { label: 'Targets', href: '/app/pricepilot/targets' },
];

/** PricePilot chrome: sub-nav across its screens. */
export default async function PricePilotLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/pricepilot" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
