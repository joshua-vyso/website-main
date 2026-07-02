import { redirect } from 'next/navigation';

/** Invoicing grew into the real Invoices module — keep old links working. */
export default function OrderFlowInvoicingRedirect() {
  redirect('/app/orderflow/invoices');
}
