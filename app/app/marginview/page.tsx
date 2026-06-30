import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlanWiseView } from '@/components/platform/skeletons/PlanWiseView';

export default async function MarginViewPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <PlanWiseView />
    </div>
  );
}
