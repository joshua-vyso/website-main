import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getInvoicesData, type InvoicesData } from '@/lib/platform/orderflow-data';
import { InvoicesViewV2 } from '@/components/platform/orderflow/InvoicesViewV2';

const EMPTY: InvoicesData = {
  invoices: [],
  items: [],
  payments: [],
  creditNotes: [],
  creditNoteItems: [],
  customers: [],
};

/** Invoices list — server-fetches everything the health row + table need. */
export default async function OrderFlowInvoicesPage() {
  const session = await getPlatformSession();
  const data = session?.org ? await getInvoicesData(session.org.id) : EMPTY;
  return <InvoicesViewV2 data={data} />;
}
