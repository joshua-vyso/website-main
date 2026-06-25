import { ModuleSkeleton } from '@/components/platform/ModuleSkeleton';

export default function OrderFlowOrdersPage() {
  return (
    <ModuleSkeleton
      title="Orders"
      subtitle="Create and manage customer orders, pulling live products straight from ProcurePulse."
      capabilities={[
        'Build an order from your ProcurePulse product catalogue, with live stock levels and base prices.',
        'Apply each customer’s agreed pricing tier (daily / weekly / monthly) automatically.',
        'Track order status from draft → sent → fulfilled → paid.',
        'Auto-generate an invoice from any order in one click.',
        'Printed / scanned invoices flow back in via Doc-U and reconcile against the order.',
      ]}
      links={[
        { label: 'ProcurePulse · Products', href: '/app/procurepulse/products' },
        { label: 'OrderFlow · Invoicing', href: '/app/orderflow/invoicing' },
        { label: 'OrderFlow · Customers', href: '/app/orderflow/customers' },
      ]}
    />
  );
}
