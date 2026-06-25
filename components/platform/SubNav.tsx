'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Generic horizontal sub-navigation for a module's screens. The `rootHref` tab
 * (the module index) is matched exactly; the rest match by path prefix.
 */
export function SubNav({
  tabs,
  rootHref,
}: {
  tabs: { label: string; href: string }[];
  rootHref: string;
}) {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const active =
          t.href === rootHref ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? 'bg-[#1A1C1E] text-white'
                : 'border border-[#E7E7E2] bg-white text-[#5F6368] hover:bg-black/[0.03]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
