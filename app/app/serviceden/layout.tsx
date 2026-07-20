import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getServiceDenData, EMPTY_SERVICEDEN } from '@/lib/platform/serviceden-data';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { SubNav } from '@/components/platform/SubNav';
import { ServiceDenProvider } from '@/components/platform/serviceden/context';

const TABS = [
  { label: 'Leads', href: '/app/serviceden/leads' },
  { label: 'Customers', href: '/app/serviceden' },
  { label: 'Services', href: '/app/serviceden/services' },
  { label: 'Invoices', href: '/app/serviceden/invoices' },
  { label: 'Settings', href: '/app/serviceden/settings' },
];

/**
 * ServiceDen chrome. Gated to a single account (Vyso's own service module): any
 * other signed-in user is bounced back to the platform home. Data is fetched
 * once and shared with every tab via the ServiceDen provider.
 */
export default async function ServiceDenLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (session.email.trim().toLowerCase() !== SERVICEDEN_ACCOUNT_EMAIL) redirect('/app');

  const data = session.org ? await getServiceDenData(session.org.id) : EMPTY_SERVICEDEN;

  return (
    <div className="px-8 py-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: '#E9E6FB', color: '#5B53C0' }} aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <path d="M2 13h20" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">ServiceDen</h1>
          <p className="mt-0.5 text-[14px] text-[#5F6368]">Leads, customers, services and invoicing for service businesses.</p>
        </div>
      </div>

      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/serviceden" />
      </div>

      <ServiceDenProvider data={data}>
        <div className="mt-6">{children}</div>
      </ServiceDenProvider>
    </div>
  );
}
