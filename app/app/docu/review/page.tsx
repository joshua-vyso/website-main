import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocuNav } from '@/components/platform/docu/DocuNav';
import { DocumentReviewQueue } from '@/components/platform/docu/DocumentReviewQueue';
import { COMMIT_STALE_MS, reviewClaimableOr } from '@/lib/platform/document-ingest';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * The review queue — every EMAIL-ingested document waits here, extracted but not
 * committed, until a human clicks Save (which is the first thing to touch stock or
 * money) or Discard.
 *
 * Scoped to email-ingested, not-yet-actioned documents: chat and manual uploads commit
 * inline and never enter this queue. Filtering on email_ingest_id keeps them out even
 * though they share the 'extracted' status.
 */
export default async function DocuReviewPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  if (!session.features.docu) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#E7E7E2] bg-white px-8 py-10 text-center">
          <h1 className="text-[18px] font-bold text-[#1A1C1E]">Doc-U is not enabled for your plan</h1>
          <p className="mt-2 text-[14px] text-[#5F6368]">Contact your administrator to add Doc-U to your subscription.</p>
        </div>
      </div>
    );
  }

  const role = session.profile?.role;
  const canReview = role === 'owner' || role === 'admin';

  // Show email documents that are free to act on: still 'extracted'/'pending', and either
  // unclaimed or with a STALE claim (a commit that crashed mid-flight reappears so it can
  // be retried). A doc being actively saved (fresh approved_at) is correctly hidden.
  const supabase = await createServerSupabase();
  const staleBefore = new Date(Date.now() - COMMIT_STALE_MS).toISOString();
  const { data } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('org_id', session.org?.id ?? '')
    .not('email_ingest_id', 'is', null)
    .in('status', ['extracted', 'pending'])
    .or(reviewClaimableOr(staleBefore))
    .order('created_at', { ascending: false })
    .limit(200);

  const docs = (data ?? []) as DocumentWithSupplier[];

  return (
    <div className="px-8 py-7">
      <DocuNav reviewCount={docs.length} />
      <div className="mb-5 mt-5">
        <h1 className="text-[22px] font-bold text-[#1A1C1E]">Review queue</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          Forwarded documents, extracted and waiting for you. Nothing updates your stock, orders or invoices until
          you Save.
        </p>
      </div>
      <DocumentReviewQueue docs={docs} canReview={canReview} />
    </div>
  );
}
