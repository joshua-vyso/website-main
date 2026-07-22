import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { FolderGridView } from '@/components/platform/docu/FolderGridView';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

/** Prominent entry point into Core Data (the shared operational tables). */
function DatabasesTile() {
  return (
    <div className="px-8 pt-7">
      <Link
        href="/app/docu/databases"
        className="group flex items-center gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#3E7BC4]/40 hover:bg-[#F5F9FE]"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#3E7BC41A' }}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3E7BC4" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="8" ry="3" />
            <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
            <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="of-display text-[16px] font-semibold text-[#171A17] transition-colors group-hover:text-[#174C87]">
              Databases
            </span>
            <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#6B6F68]">
              Core Data
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            Customers, products, price lists, company profile and more — the shared source of truth behind every document.
          </p>
        </div>
        <span className="shrink-0 text-[18px] text-[#BFC5CC] transition-colors group-hover:text-[#174C87]" aria-hidden>
          &rsaquo;
        </span>
      </Link>
    </div>
  );
}

export default async function DocuInboxPage() {
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

  const docs = (data ?? []) as DocumentWithSupplier[];
  const folders = (folderData ?? []) as DocumentFolder[];

  return (
    <>
      <DatabasesTile />
      <FolderGridView docs={docs} folders={folders} />
    </>
  );
}
