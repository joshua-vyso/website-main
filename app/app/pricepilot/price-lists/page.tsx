import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function PricePilotPriceListsPage() {
  return (
    <ModuleSkeleton
      title="Price lists"
      subtitle="Build customer price lists from live stock prices with custom margins."
      capabilities={[
        'Fetch each product’s base price from the ProcurePulse catalogue.',
        'Set a custom margin per item — or per customer — to derive the sell price.',
        'Per-customer parameter rules auto-add lines (e.g. crushed garlic for Sandton Sun).',
        'Daily / weekly / monthly variants per the customer’s agreed pricing status.',
        'Batch-send price lists on a schedule — to all customers or only a selected set.',
      ]}
      links={[
        { label: 'ProcurePulse · Products', href: '/app/procurepulse/products' },
        { label: 'OrderFlow · Customers', href: '/app/orderflow/customers' },
        { label: 'PricePilot · Recent sales', href: '/app/pricepilot/recent-sales' },
      ]}
    />
  );
}
