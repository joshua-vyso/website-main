import { InvoiceDetail } from '@/components/platform/serviceden/InvoiceDetail';

export default async function ServiceDenInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail invoiceId={id} />;
}
