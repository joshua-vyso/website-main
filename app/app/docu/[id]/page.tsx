import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { StatusPill, ConfidenceText } from '@/components/platform/ui';
import { ExtractionEditor } from '@/components/platform/ExtractionEditor';
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

  const fields = doc.extracted_data?.fields ?? [];

  return (
    <div className="px-8 py-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app/docu"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/30 hover:text-[#1A1C1E]"
          >
            <span aria-hidden>‹</span> Documents
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-[20px] font-bold leading-tight text-[#1A1C1E]">
              {doc.filename}
            </h1>
            <StatusPill status={doc.status} />
            <span className="shrink-0 text-[13px] text-[#5F6368]">
              <ConfidenceText value={doc.confidence} /> overall confidence
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mt-6 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
        {/* Left — original document */}
        <div className="flex flex-col rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#F0F0EC] px-6 py-5">
            <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Original document</h2>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E7E7E2] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30"
            >
              <span aria-hidden>↗</span> View original document
            </button>
          </div>

          {/* Placeholder preview */}
          <div className="flex-1 px-6 py-6">
            <div className="rounded-xl border border-dashed border-[#E7E7E2] bg-[#FAFAF8] px-6 py-10">
              <div className="text-[15px] font-semibold uppercase tracking-wide text-[#1A1C1E]">
                {doc.supplier?.name ?? 'Source document'}
              </div>
              <div className="mt-1 text-[12px] text-[#9A9DA1]">
                Scanned source PDF · {doc.filename}
              </div>
              <div className="mt-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-2.5 flex-1 rounded-full bg-[#ECECE6]" />
                    <div className="h-2.5 w-12 rounded-full bg-[#ECECE6]" />
                    <div className="h-2.5 w-16 rounded-full bg-[#ECECE6]" />
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-[#E7E7E2] pt-4 text-[12px] text-[#9A9DA1]">
                <span>Preview unavailable in-app</span>
                <span>scanned source PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — extraction editor */}
        <ExtractionEditor id={doc.id} status={doc.status} fields={fields} />
      </div>
    </div>
  );
}
