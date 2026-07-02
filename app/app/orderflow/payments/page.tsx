import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getPaymentsData } from '@/lib/platform/orderflow-data';
import { PaymentsView } from '@/components/platform/orderflow/PaymentsView';

/**
 * Payments list — every recorded receipt across invoices, with month/today/
 * outstanding/overdue KPIs, search + method + date filters, and a two-step
 * "Record payment" flow (pick an open invoice → RecordPaymentModal). Balances
 * and overdue counts are derived from the invoices + items + payments + credit
 * notes slice via docTotals/paymentsTotal/balanceDue (contract rule 10), so the
 * page server-fetches the whole thing and hands it to the client view.
 */
export default async function OrderFlowPaymentsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;

  if (!orgId) {
    return (
      <PaymentsView
        payments={[]}
        invoices={[]}
        invoiceItems={[]}
        creditNotes={[]}
        creditNoteItems={[]}
        customers={[]}
      />
    );
  }

  const data = await getPaymentsData(orgId);

  return (
    <PaymentsView
      payments={data.payments}
      invoices={data.invoices}
      invoiceItems={data.invoiceItems}
      creditNotes={data.creditNotes}
      creditNoteItems={data.creditNoteItems}
      customers={data.customers}
    />
  );
}
