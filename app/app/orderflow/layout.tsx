import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SubNav } from '@/components/platform/SubNav';

const TABS = [
  { label: 'Dashboard', href: '/app/orderflow' },
  { label: 'Customers', href: '/app/orderflow/customers' },
  { label: 'Quotes', href: '/app/orderflow/quotes' },
  { label: 'Orders', href: '/app/orderflow/orders' },
  { label: 'Invoices', href: '/app/orderflow/invoices' },
  { label: 'Delivery notes', href: '/app/orderflow/delivery-notes' },
  { label: 'Credit notes', href: '/app/orderflow/credit-notes' },
  { label: 'Payments', href: '/app/orderflow/payments' },
  { label: 'Price lists', href: '/app/orderflow/pricelists' },
  { label: 'Settings', href: '/app/orderflow/settings' },
];

/** OrderFlow chrome: sub-nav across the invoicing hub's screens. */
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
