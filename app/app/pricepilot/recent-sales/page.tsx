import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function PricePilotRecentSalesPage() {
  return (
    <ModuleSkeleton
      title="Recent sales"
      subtitle="Every recent sale, linked to its OrderFlow invoice."
      capabilities={[
        'A live feed of recent sales as invoices are raised in OrderFlow.',
        'Each sale links straight to its underlying OrderFlow invoice.',
        'Filter by customer, product or date.',
        'Flag sales priced unusually vs the customer’s agreed price list.',
      ]}
      links={[
        { label: 'PricePilot · Sales hub', href: '/app/pricepilot/sales-hub' },
        { label: 'OrderFlow · Invoicing', href: '/app/orderflow/invoicing' },
      ]}
    />
  );
}
