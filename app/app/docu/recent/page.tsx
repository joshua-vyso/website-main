import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { InboxView } from '@/components/platform/InboxView';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Recent documents — added today / earlier this week (by created_at). Renders the
 * inbox in 'recent' grouping mode, so it carries the same Upload / Select /
 * Filter / Sort controls; the full archive lives on the Documents tab.
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
  const orgId = session.org?.id ?? '';
  // Last 7 days covers "today + this week"; the view buckets by local-time day
  // boundaries on the client (Today vs the rest).
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data }, { data: folderData }] = await Promise.all([
    supabase
      .from('documents')
      .select('*, supplier:suppliers(id,name,initials)')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_folders')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true }),
  ]);

  const docs = (data ?? []) as DocumentWithSupplier[];
  const folders = (folderData ?? []) as DocumentFolder[];

  return (
    <InboxView
      docs={docs}
      folders={folders}
      title="Recent"
      subtitle="Documents added to Doc-U today and earlier this week"
      groupMode="recent"
      hideStats
      emptyTitle="Nothing added recently"
      emptyBody="Documents you add this week will show here. See everything in the Documents tab."
    />
  );
}
