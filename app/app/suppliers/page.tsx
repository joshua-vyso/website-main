import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { SupplySyncView } from '@/components/platform/skeletons/SupplySyncView';

export default async function SuppliersPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <SupplySyncView />
    </div>
  );
}
