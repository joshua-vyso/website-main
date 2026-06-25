import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function OrderFlowInvoicingPage() {
  return (
    <ModuleSkeleton
      title="Invoicing"
      subtitle="Auto-generate invoices from orders and the product catalogue."
      capabilities={[
        'Generate an invoice from an order in one click, line items pre-filled from the catalogue.',
        'Pull sell prices from PricePilot price lists, with per-customer margins applied.',
        'Honour each customer’s agreed pricing status (daily / weekly / monthly).',
        'Printed or scanned invoices import through Doc-U and match back to the order here.',
        'Export / send invoices to customers; mark paid and feed PricePilot sales.',
      ]}
      links={[
        { label: 'OrderFlow · Orders', href: '/app/orderflow/orders' },
        { label: 'PricePilot · Price lists', href: '/app/pricepilot/price-lists' },
        { label: 'ProcurePulse · Products', href: '/app/procurepulse/products' },
      ]}
    />
  );
}
