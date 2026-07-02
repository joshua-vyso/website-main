import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getDeliveryNotesData, type DeliveryNotesData } from '@/lib/platform/orderflow-data';
import { DeliveryNotesView } from '@/components/platform/orderflow/DeliveryNotesView';

const EMPTY: DeliveryNotesData = {
  deliveryNotes: [],
  items: [],
  customers: [],
  orders: [],
  invoices: [],
  companyProfile: null,
};

/** Delivery notes list — the picking/POD side of OrderFlow, one row per note. */
export default async function DeliveryNotesPage() {
  const session = await getPlatformSession();
  const data = session?.org ? await getDeliveryNotesData(session.org.id) : EMPTY;
  return <DeliveryNotesView data={data} />;
}
