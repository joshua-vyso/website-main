'use client';

/**
 * Role gating — owners and admins can see financial figures (revenue, outstanding,
 * expenses); members cannot. `member` (and any unset/unknown role) is treated as
 * non-admin so finance data is never shown by default; a wrongly-blurred user is
 * fixed by setting their profiles.role to 'admin'.
 */

import { usePlatform } from '@/lib/platform/session';

/** True for owners/admins (may see finances); false for members. */
export function useIsAdmin(): boolean {
  const { profile } = usePlatform();
  const role = profile?.role;
  return role === 'owner' || role === 'admin';
}

/**
 * A KPI tile placeholder shown to members in place of a finance tile: the value
 * is a blurred dummy (the real figure is never put in the DOM) with an overlay
 * telling them to ask an admin.
 */
export function LockedTile({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="text-[12px] text-[#9A9DA1]">{label}</div>
      <div aria-hidden className="mt-1.5 select-none blur-[7px]">
        <div className="text-[22px] font-bold leading-none text-[#1A1C1E]">R 000 000</div>
        <div className="mt-1.5 text-[11px] text-[#9A9DA1]">•••••••••</div>
      </div>
      <div className="absolute inset-x-0 bottom-2 top-9 flex items-center justify-center px-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-[#5F6368] ring-1 ring-[#E7E7E2] backdrop-blur-[2px]">
          <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
            <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" />
          </svg>
          Contact an admin to see this tile
        </span>
      </div>
    </div>
  );
}
