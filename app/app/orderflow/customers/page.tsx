import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function OrderFlowCustomersPage() {
  return (
    <ModuleSkeleton
      title="Customers"
      subtitle="Customer profiles, pricing agreements and per-customer ordering parameters."
      capabilities={[
        'A profile per customer — contact, delivery and account details.',
        'Pricing status per customer: daily, weekly or monthly agreed prices, honoured everywhere.',
        'Per-customer parameters — e.g. Sandton Sun orders “garlic” but means crushed garlic, so their price list and invoices auto-create the crushed-garlic line.',
        'Drives PricePilot batch price lists, which can target all customers or a selected set.',
        'Customer complaints (photos + notes) raised against orders surface in PricePilot.',
      ]}
      links={[
        { label: 'PricePilot · Price lists', href: '/app/pricepilot/price-lists' },
        { label: 'PricePilot · Complaints', href: '/app/pricepilot/complaints' },
        { label: 'ProcurePulse · Products', href: '/app/procurepulse/products' },
      ]}
    />
  );
}
