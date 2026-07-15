'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VysoAILauncher } from '@/components/platform/vyso-ai/VysoAILauncher';

const TABS = [
  { href: '/app/docu', label: 'Documents', match: 'documents' },
  { href: '/app/docu/review', label: 'Review', match: 'review' },
  { href: '/app/docu/recent', label: 'Recent', match: 'recent' },
  { href: '/app/docu/reconciliation', label: 'Reconciliation', match: 'reconciliation' },
  { href: '/app/docu/settings', label: 'Settings', match: 'settings' },
] as const;

/** Top tabs for the Doc-U section (Documents · Review · Recent · Reconciliation · Settings). */
export function DocuNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname() ?? '';
  const current = pathname.startsWith('/app/docu/review')
    ? 'review'
    : pathname.startsWith('/app/docu/recent')
      ? 'recent'
      : pathname.startsWith('/app/docu/reconciliation')
        ? 'reconciliation'
        : pathname.startsWith('/app/docu/settings')
          ? 'settings'
          : 'documents'; // /app/docu, /app/docu/folder/*, /app/docu/[id], awaiting/confidence/flagged

  return (
    <div className="flex items-center gap-5 border-b border-[#E7E7E2]">
      {TABS.map((t) => {
        const active = t.match === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] transition-colors ${
              active
                ? 'border-[#1E5E54] font-medium text-[#1A1C1E]'
                : 'border-transparent text-[#5F6368] hover:text-[#1A1C1E]'
            }`}
          >
            {t.label}
            {t.match === 'review' && reviewCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-[#FBEEDA] px-1.5 py-0.5 text-[11px] font-medium text-[#854F0B]">
                {reviewCount}
              </span>
            ) : null}
          </Link>
        );
      })}
      <div className="ml-auto self-center pb-1.5">
        <VysoAILauncher module="docu" />
      </div>
    </div>
  );
}
