'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Generic horizontal sub-navigation for a module's screens — the calm underline
 * style shared with Doc-U: a thin baseline with the active tab underlined in teal.
 * The `rootHref` tab (module index) is matched exactly; the rest match by prefix.
 * An optional `right` slot renders a right-aligned action (e.g. the Vyso AI pill).
 */
export function SubNav({
  tabs,
  rootHref,
  right,
}: {
  tabs: { label: string; href: string }[];
  rootHref: string;
  right?: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#E7E7E2]">
      {tabs.map((t) => {
        const active =
          t.href === rootHref ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
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
      {right ? <div className="ml-auto self-center pb-1.5">{right}</div> : null}
    </nav>
  );
}
