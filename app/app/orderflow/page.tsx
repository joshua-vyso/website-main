import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getOrderFlowSnapshot } from '@/lib/platform/orderflow-data';
import { DEFAULT_OF_SETTINGS } from '@/lib/platform/orderflow';
import { Dashboard } from '@/components/platform/orderflow/Dashboard';

/**
 * OrderFlow dashboard — the operational home of the invoicing hub. Server-fetches
 * the org snapshot once and hands it to the (client) Dashboard. When there's no
 * org (unconfigured session) it renders an empty, non-crashing dashboard.
 */
export default async function OrderFlowDashboardPage() {
  const session = await getPlatformSession();
  const org = session?.org ?? null;

  const snapshot = org
    ? await getOrderFlowSnapshot(org.id)
    : {
        customers: [],
        orders: [],
        quotes: [],
        invoices: [],
        invoiceItems: [],
        payments: [],
        creditNotes: [],
        creditNoteItems: [],
        activity: [],
        settings: { ...DEFAULT_OF_SETTINGS },
        quoteRequestsNew: 0,
      };

  return <Dashboard {...snapshot} orgName={org?.name ?? null} email={session?.email ?? null} />;
}
