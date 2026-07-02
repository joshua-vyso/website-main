import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getCreditNotesData } from '@/lib/platform/orderflow-data';
import { CreditNotesView } from '@/components/platform/orderflow/CreditNotesView';

const EMPTY = {
  creditNotes: [],
  items: [],
  invoices: [],
  invoiceItems: [],
  payments: [],
  customers: [],
  companyProfile: null,
};

/** Credit notes list — server-fetches credit notes + their items + invoices + customers. */
export default async function OrderFlowCreditNotesPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';

  if (!orgId) return <CreditNotesView data={EMPTY} />;

  const data = await getCreditNotesData(orgId);
  return <CreditNotesView data={data} />;
}
