import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function PricePilotDashboardPage() {
  return (
    <ModuleSkeleton
      title="PricePilot"
      subtitle="Pricing and sales at a glance — margins, price changes and revenue."
      capabilities={[
        'Margin overview across the whole catalogue, fed from ProcurePulse base prices.',
        'Top movers and price changes pulled from ProcurePulse stock.',
        'Sales trend and this month’s revenue, sourced from OrderFlow invoices.',
        'Outstanding customer complaints needing attention.',
      ]}
      links={[
        { label: 'PricePilot · Price lists', href: '/app/pricepilot/price-lists' },
        { label: 'PricePilot · Sales hub', href: '/app/pricepilot/sales-hub' },
        { label: 'ProcurePulse · Products', href: '/app/procurepulse/products' },
      ]}
    />
  );
}
