import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

const TABS = [
  { label: 'Orders', href: '/app/orderflow/orders' },
  { label: 'Invoicing', href: '/app/orderflow/invoicing' },
  { label: 'Customers', href: '/app/orderflow/customers' },
];

/** OrderFlow chrome: sub-nav across Orders / Invoicing / Customers. */
export default async function OrderFlowLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <SubNav tabs={TABS} rootHref="/app/orderflow" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
