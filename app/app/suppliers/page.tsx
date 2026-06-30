import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getSupplySyncData } from '@/lib/platform/supplysync-data';
import { SupplySyncView } from '@/components/platform/supplysync/View';

export default async function SuppliersPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getSupplySyncData(session.org.id) : { suppliers: [] };

  return (
    <div className="px-8 py-7">
      <SupplySyncView data={data} />
    </div>
  );
}
