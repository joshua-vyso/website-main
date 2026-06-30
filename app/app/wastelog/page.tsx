import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { WasteWatchView } from '@/components/platform/skeletons/WasteWatchView';

export default async function WasteLogPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <WasteWatchView />
    </div>
  );
}
