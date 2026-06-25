import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function PricePilotComplaintsPage() {
  return (
    <ModuleSkeleton
      title="Customer complaints"
      subtitle="Issues customers raise about their orders — with photos and notes."
      capabilities={[
        'Customers attach images and notes about an order issue (via a later ordering portal).',
        'Each complaint links to the order / invoice in OrderFlow.',
        'Track status: open → investigating → resolved.',
        'Trends by customer and product feed back into pricing and sourcing decisions.',
      ]}
      links={[
        { label: 'OrderFlow · Customers', href: '/app/orderflow/customers' },
        { label: 'PricePilot · Sales hub', href: '/app/pricepilot/sales-hub' },
      ]}
    />
  );
}
