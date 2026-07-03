'use client';

import { usePathname } from 'next/navigation';
import { MODULES } from '@/lib/platform/modules';
import { usePlatform } from '@/lib/platform/session';

/**
 * Blocks direct navigation to a module the org isn't entitled to.
 *
 * The sidebar already renders locked modules as non-links, but the routes still
 * exist — a user could type/paste a URL or follow a stale link. This guard sits
 * around the main content and, when the current path resolves to a locked
 * module, renders a locked screen INSTEAD of that module's page.
 *
 * Path → module resolution: match the MODULES entry whose `screens.desktop`
 * equals the pathname or is a path-segment prefix of it, then pick the LONGEST
 * such route so nested routes resolve to their own module (not to `/app`). Only
 * module routes are considered, so `/app`, `/app/organisation`, `/app/settings`,
 * `/app/notifications` and `/app/serviceden` are never locked.
 *
 * Degrades gracefully: if `locked_modules` is absent the session exposes an
 * empty `lockedModules`, so nothing is ever locked.
 */
export function ModuleLockGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lockedModules } = usePlatform();

  // Find the module that owns the current path (longest matching desktop route).
  let current: (typeof MODULES)[number] | null = null;
  for (const m of MODULES) {
    const route = m.screens.desktop;
    const matches = pathname === route || pathname.startsWith(`${route}/`);
    if (matches && (current === null || route.length > current.screens.desktop.length)) {
      current = m;
    }
  }

  if (!current || !lockedModules.includes(current.key)) {
    return <>{children}</>;
  }

  const label = current.label;
  const mailto = `mailto:joshua@vyso.co.za?subject=${encodeURIComponent(`Unlock ${label}`)}`;

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDEFF1] text-[#5F6368]"
          aria-hidden
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h1 className="mt-5 text-[18px] font-semibold text-[#1A1C1E]">{label} is locked</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#5F6368]">
          This module isn&apos;t part of your plan yet — contact joshua@vyso.co.za to unlock it.
        </p>
        <a
          href={mailto}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42]"
        >
          Email Joshua
        </a>
      </div>
    </div>
  );
}
