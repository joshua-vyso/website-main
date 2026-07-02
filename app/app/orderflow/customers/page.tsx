import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { getCustomersData } from '@/lib/platform/orderflow-data';
import { CustomersView } from '@/components/platform/orderflow/CustomersView';
import type { OfInvoiceItem } from '@/lib/platform/orderflow';

/**
 * Customers list — the operational customer book, built entirely on Core Data
 * (of_customers) with real invoice/payment aggregates. Server-fetches once and
 * hands the whole slice to the client view (no mocks).
 *
 * getCustomersData returns invoices + payments but not invoice items; we fetch
 * items here so the outstanding-balance column can be derived exactly via
 * docTotals + paymentsTotal (contract rule 10).
 */
export default async function OrderFlowCustomersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;

  if (!orgId) {
    return <CustomersView customers={[]} invoices={[]} invoiceItems={[]} payments={[]} paymentTerms={[]} />;
  }

  const [data, itemsRes] = await Promise.all([
    getCustomersData(orgId),
    createServerSupabase().then((sb) => sb.from('of_invoice_items').select('*').eq('org_id', orgId)),
  ]);
  const invoiceItems = ((itemsRes.data as OfInvoiceItem[] | null) ?? []) as OfInvoiceItem[];

  return (
    <CustomersView
      customers={data.customers}
      invoices={data.invoices}
      invoiceItems={invoiceItems}
      payments={data.payments}
      paymentTerms={data.paymentTerms}
    />
  );
}
