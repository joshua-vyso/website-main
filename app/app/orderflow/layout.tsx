import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { isSetupError } from '@/lib/platform/orderflow';
import { SubNav } from '@/components/platform/SubNav';
import { OrderFlowSetupBanner } from '@/components/platform/orderflow/OrderFlowSetupBanner';

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
  { label: 'Rebates', href: '/app/orderflow/rebates' },
  { label: 'Settings', href: '/app/orderflow/settings' },
];

/** OrderFlow chrome: sub-nav across the invoicing hub's screens. */
export default async function OrderFlowLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  // Cheap once-per-navigation probe: if the v2 tables are missing (core-data.sql
  // not yet run), nudge the user to finish setup above the chrome.
  let needsSetup = false;
  if (session.org) {
    const sb = await createServerSupabase();
    const { error } = await sb.from('of_invoices').select('id').limit(1);
    needsSetup = !!error && isSetupError(error.message);
  }

  return (
    <div className="px-8 py-7">
      {needsSetup ? <OrderFlowSetupBanner /> : null}
      <SubNav tabs={TABS} rootHref="/app/orderflow" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
