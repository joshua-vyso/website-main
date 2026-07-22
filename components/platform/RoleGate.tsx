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
    <div className="relative overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div aria-hidden className="mt-1.5 select-none blur-[7px]">
        <div className="of-num text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">R 000 000</div>
        <div className="mt-1.5 text-[11px] text-[#A0A49C]">•••••••••</div>
      </div>
      <div className="absolute inset-x-0 bottom-2 top-9 flex items-center justify-center px-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/85 px-2.5 py-1.5 text-[11px] font-medium text-[#6B6F68] ring-1 ring-[#E2E6EC] backdrop-blur-[2px]">
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
