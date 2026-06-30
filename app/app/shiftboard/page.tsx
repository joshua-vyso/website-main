import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { ShiftBoardView } from '@/components/platform/skeletons/ShiftBoardView';

export default async function ShiftBoardPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <ShiftBoardView />
    </div>
  );
}
