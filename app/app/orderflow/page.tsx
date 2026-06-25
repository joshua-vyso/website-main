import { redirect } from 'next/navigation';

/** OrderFlow index → Orders. */
export default function OrderFlowIndex() {
  redirect('/app/orderflow/orders');
}
