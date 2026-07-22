'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Generic horizontal sub-navigation for a module's screens — the calm underline
 * style shared with Doc-U: a thin baseline with the active tab underlined in blue.
 * The `rootHref` tab (module index) is matched exactly; the rest match by prefix.
 * An optional `right` slot renders a right-aligned action (e.g. the Vyso AI pill).
 * `accent` recolours the active underline for modules that run their own palette
 * (OrderFlow is orange); it defaults to the platform blue every other module uses.
 */
export function SubNav({
  tabs,
  rootHref,
  right,
  accent = '#3E7BC4',
}: {
  tabs: { label: string; href: string }[];
  rootHref: string;
  right?: ReactNode;
  accent?: string;
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
              active ? 'font-medium text-[#1A1C1E]' : 'border-transparent text-[#5F6368] hover:text-[#1A1C1E]'
            }`}
            style={active ? { borderBottomColor: accent } : undefined}
          >
            {t.label}
          </Link>
        );
      })}
      {right ? <div className="ml-auto self-center pb-1.5">{right}</div> : null}
    </nav>
  );
}
