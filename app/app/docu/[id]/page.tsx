import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocumentDetailPanel } from '@/components/platform/docu/DocumentDetailPanel';
import type { DocumentWithSupplier } from '@/lib/platform/types';

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

  // Sibling org documents power the cross-document intelligence (duplicate
  // detection, supplier history, relationships). Keep the same select shape.
  const { data: siblingData } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('org_id', doc.org_id)
    .order('created_at', { ascending: false });
  const orgDocs = (siblingData as DocumentWithSupplier[] | null) ?? [];

  let originalUrl: string | null = null;
  if (doc.storage_path) {
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 600);
    originalUrl = signed?.signedUrl ?? null;
  }

  // Detect image vs PDF by filename extension (the row carries no mime type).
  const ext = (doc.filename || doc.storage_path || '')
    .toLowerCase()
    .split('?')[0]
    .split('.')
    .pop();
  const isImage = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'].includes(ext ?? '');

  return (
    <div className="px-8 py-7">
      <DocumentDetailPanel doc={doc} orgDocs={orgDocs} originalUrl={originalUrl} isImage={isImage} />
    </div>
  );
}
