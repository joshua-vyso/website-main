import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocumentDetailPanel } from '@/components/platform/docu/DocumentDetailPanel';
import { allUnits } from '@/lib/platform/procurepulse/units';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('id', id)
    .maybeSingle();

  const doc = data as DocumentWithSupplier | null;

  if (!doc) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Document not found</h1>
          <p className="mt-2 text-[14px] text-[#5F6368]">
            This document may have been removed or you don&apos;t have access to it.
          </p>
          <Link
            href="/app/docu"
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#1A1C1E] px-4 text-[14px] font-medium text-white transition-colors hover:bg-black"
          >
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  // Everything the detail page needs, fetched in PARALLEL (they have no
  // dependency on each other): sibling org documents power the cross-document
  // intelligence (duplicate detection, supplier history, relationships); folders
  // power the folder picker; pp_movements gives the ProcurePulse fed-item count
  // (RLS returns nothing for orgs without the feature); the signed URL is the
  // preview source. Previously these last two ran sequentially after the batch.
  const [{ data: siblingData }, { data: folderData }, { data: fedMoves }, { data: settingsData }, signedRes] =
    await Promise.all([
      supabase
        .from('documents')
        .select('*, supplier:suppliers(id,name,initials)')
        .eq('org_id', doc.org_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('document_folders')
        .select('*')
        .eq('org_id', doc.org_id)
        .order('name', { ascending: true }),
      supabase.from('pp_movements').select('stock_item_id').eq('source_document_id', doc.id),
      // The org's measurement units (workspace-managed) feed the unit dropdown.
      // Tolerant of pp_settings not existing → built-in units only.
      supabase.from('pp_settings').select('custom_units').eq('org_id', doc.org_id).maybeSingle(),
      doc.storage_path
        ? supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600)
        : Promise.resolve({ data: null }),
    ]);
  const orgDocs = (siblingData as DocumentWithSupplier[] | null) ?? [];
  const folders = (folderData as DocumentFolder[] | null) ?? [];
  const orgUnits = allUnits((settingsData as { custom_units?: string[] | null } | null)?.custom_units);

  const fedItemCount = new Set(
    (fedMoves as { stock_item_id: string }[] | null)?.map((m) => m.stock_item_id) ?? [],
  ).size;

  const originalUrl =
    (signedRes as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null;

  // Detect image vs PDF by filename extension (the row carries no mime type).
  const ext = (doc.filename || doc.storage_path || '')
    .toLowerCase()
    .split('?')[0]
    .split('.')
    .pop();
  const isImage = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'].includes(ext ?? '');

  return (
    // Own scroll container: html/body have overflow-x:hidden (which forces
    // overflow-y:auto on them and breaks position:sticky relative to the
    // viewport). Scrolling here instead keeps one clean page scroll AND lets
    // the preview stick.
    <div className="h-screen overflow-y-auto px-8 py-7">
      <DocumentDetailPanel
        doc={doc}
        orgDocs={orgDocs}
        folders={folders}
        features={session.features}
        fedItemCount={fedItemCount ?? 0}
        orgUnits={orgUnits}
        originalUrl={originalUrl}
        isImage={isImage}
      />
    </div>
  );
}
