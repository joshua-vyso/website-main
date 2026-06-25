'use client';

import { useEffect, useState } from 'react';
import { DocuNav } from './DocuNav';
import { DocumentTable, type DocGroup } from './DocumentTable';
import { recentBuckets, type RecentBuckets } from '@/lib/platform/docu/recent';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * The Recent view: documents by the date they were ADDED to Doc-U (created_at),
 * split into Today and earlier This week — and only those two sections. Bucketed
 * on the client so the day boundaries follow the viewer's local timezone.
 */
export function RecentView({ docs }: { docs: DocumentWithSupplier[] }) {
  // Computed after mount to (a) use local time and (b) avoid an SSR/CSR mismatch
  // on the day boundary.
  const [buckets, setBuckets] = useState<RecentBuckets | null>(null);
  useEffect(() => {
    setBuckets(recentBuckets(docs));
  }, [docs]);

  const groups: DocGroup[] = [];
  if (buckets) {
    if (buckets.today.length) groups.push({ key: 'today', label: 'Today', docs: buckets.today });
    if (buckets.week.length) groups.push({ key: 'week', label: 'This week', docs: buckets.week });
  }

  return (
    <div className="px-8 py-7">
      <DocuNav />

      <div className="mt-6">
        <h1 className="text-[26px] font-bold leading-tight text-[#1A1C1E]">Recent</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          Documents added to Doc-U today and earlier this week
        </p>
      </div>

      <div className="mt-6">
        {!buckets ? (
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-2xl border border-[#E7E7E2] bg-[#FAFAF8]" />
            <div className="h-14 animate-pulse rounded-2xl border border-[#E7E7E2] bg-[#FAFAF8]" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7E7E2] bg-white px-8 py-14 text-center">
            <h2 className="text-[18px] font-semibold text-[#1A1C1E]">Nothing added recently</h2>
            <p className="mx-auto mt-1 max-w-md text-[14px] text-[#5F6368]">
              Documents you add this week will show here. See everything in the{' '}
              <span className="font-medium text-[#1A1C1E]">Documents</span> tab.
            </p>
          </div>
        ) : (
          <DocumentTable groups={groups} allDocs={docs} />
        )}
      </div>
    </div>
  );
}
