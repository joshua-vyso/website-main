import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { InsightGenView } from '@/components/platform/skeletons/InsightGenView';

export default async function ReportGenPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <div className="px-8 py-7">
      <InsightGenView />
    </div>
  );
}
