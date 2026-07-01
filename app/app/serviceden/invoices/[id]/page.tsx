import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getServiceDenData, EMPTY_SERVICEDEN } from '@/lib/platform/serviceden-data';
import { InvoiceDetail } from '@/components/platform/serviceden/InvoiceDetail';

/**
 * Server-fetches the invoice by id (fresh on every navigation) rather than
 * reading the layout's cached provider data — otherwise a just-created invoice
 * shows "not found" because the shared layout data hasn't re-fetched yet.
 */
export default async function ServiceDenInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPlatformSession();
  const data = session?.org ? await getServiceDenData(session.org.id) : EMPTY_SERVICEDEN;
  const invoice = data.invoices.find((i) => i.id === id) ?? null;
  const customer = invoice ? data.customers.find((c) => c.id === invoice.customerId) ?? null : null;

  return (
    <InvoiceDetail
      invoice={invoice}
      customer={customer}
      settings={data.settings}
      orgName={session?.org?.name ?? null}
      orgLocation={session?.org?.location ?? null}
    />
  );
}
