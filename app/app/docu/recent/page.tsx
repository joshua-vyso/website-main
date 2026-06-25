import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { RecentView } from '@/components/platform/docu/RecentView';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Recent documents — added today / earlier this week (by created_at). Only those
 * two sections; the full archive lives on the Documents tab.
 */
export default async function DocuRecentPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  if (!session.features.docu) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Doc-U is not enabled for your plan</h1>
          <p className="mt-2 text-[14px] text-[#5F6368]">
            Contact your administrator to add Doc-U to your subscription.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  // Last ~14 days covers "today + this week" with margin; the view buckets by
  // local-time day boundaries on the client.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('org_id', session.org?.id ?? '')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  const docs = (data ?? []) as DocumentWithSupplier[];

  return <RecentView docs={docs} />;
}
