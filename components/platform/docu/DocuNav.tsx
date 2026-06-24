'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/app/docu', label: 'Documents' },
  { href: '/app/docu/reconciliation', label: 'Reconciliation' },
];

/** Top tabs for the Doc-U section (Documents · Reconciliation). */
export function DocuNav() {
  const pathname = usePathname();
  const isRecon = pathname?.startsWith('/app/docu/reconciliation') ?? false;

  return (
    <div className="flex items-center gap-5 border-b border-[#E7E7E2]">
      {TABS.map((t) => {
        const active = t.href === '/app/docu/reconciliation' ? isRecon : !isRecon;
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
          </Link>
        );
      })}
    </div>
  );
}
