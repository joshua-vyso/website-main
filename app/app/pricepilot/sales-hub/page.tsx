import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function PricePilotSalesHubPage() {
  return (
    <ModuleSkeleton
      title="Sales hub"
      subtitle="All sales grouped by month, each linked to its invoice in OrderFlow."
      capabilities={[
        'Sales grouped into collapsible monthly tiles.',
        'Drill into any month and open the underlying OrderFlow invoice directly.',
        'Revenue and margin totals per month.',
        'Export a month for accounting / reconciliation.',
      ]}
      links={[
        { label: 'OrderFlow · Invoicing', href: '/app/orderflow/invoicing' },
        { label: 'PricePilot · Recent sales', href: '/app/pricepilot/recent-sales' },
        { label: 'OrderFlow · Customers', href: '/app/orderflow/customers' },
      ]}
    />
  );
}
