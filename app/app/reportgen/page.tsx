import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getInsightGenData } from '@/lib/platform/insightgen-data';
import { InsightGenView } from '@/components/platform/insightgen/View';

export default async function ReportGenPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getInsightGenData(session.org.id) : { insights: [], reports: [] };

  return (
    <div className="px-8 py-7">
      <InsightGenView data={data} />
    </div>
  );
}
