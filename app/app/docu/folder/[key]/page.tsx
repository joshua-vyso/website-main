import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { InboxView } from '@/components/platform/InboxView';
import { resolveFolderKey, scopeDocsToFolder } from '@/lib/platform/docu/folders';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * A single folder's documents — the month-organised inbox scoped to one folder
 * (a default document type, a custom folder, or "all"). Reached from the
 * Documents folder grid.
 */
export default async function DocuFolderPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const session = await getPlatformSession();
  if (!session) redirect('/login');

  if (!session.features.docu) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h1 className="of-display text-[18px] font-semibold text-[#171A17]">Doc-U is not enabled for your plan</h1>
          <p className="mt-2 text-[14px] text-[#6B6F68]">
            Contact your administrator to add Doc-U to your subscription.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const orgId = session.org?.id ?? '';
  const [{ data }, { data: folderData }] = await Promise.all([
    supabase
      .from('documents')
      .select('*, supplier:suppliers(id,name,initials)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_folders')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true }),
  ]);

  const allDocs = (data ?? []) as DocumentWithSupplier[];
  const folders = (folderData ?? []) as DocumentFolder[];

  const resolved = resolveFolderKey(key, folders);
  if (!resolved.valid) redirect('/app/docu');

  const scoped = scopeDocsToFolder(allDocs, resolved);

  return (
    <InboxView
      docs={scoped}
      folders={folders}
      title={resolved.title}
      subtitle={`${scoped.length} document${scoped.length === 1 ? '' : 's'} in this folder`}
      backHref="/app/docu"
      backLabel="All folders"
      hideFilter
      hideStats
    />
  );
}
