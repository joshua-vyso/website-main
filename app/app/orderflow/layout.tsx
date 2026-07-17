import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { isSetupError } from '@/lib/platform/orderflow';
import { SubNav } from '@/components/platform/SubNav';
import { OrderFlowSetupBanner } from '@/components/platform/orderflow/OrderFlowSetupBanner';
import { VysoAILauncher } from '@/components/platform/vyso-ai/VysoAILauncher';

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

// Whether the v2 tables are missing is a GLOBAL, deploy-time fact (the table either
// exists in the DB or doesn't) — not per-org data. It used to be probed on EVERY
// OrderFlow navigation, an extra DB round-trip on a hot path. Cache it at module scope so
// it runs at most once per serverless instance instead of once per click.
let setupProbe: boolean | null = null;
async function needsOrderFlowSetup(): Promise<boolean> {
  if (setupProbe !== null) return setupProbe;
  const sb = await createServerSupabase();
  const { error } = await sb.from('of_invoices').select('id').limit(1);
  setupProbe = !!error && isSetupError(error.message);
  return setupProbe;
}

/** OrderFlow chrome: sub-nav across the invoicing hub's screens. */
export default async function OrderFlowLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const needsSetup = session.org ? await needsOrderFlowSetup() : false;

  return (
    <div className="px-8 py-7">
      {needsSetup ? <OrderFlowSetupBanner /> : null}
      <SubNav tabs={TABS} rootHref="/app/orderflow" right={<VysoAILauncher module="orderflow" />} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
