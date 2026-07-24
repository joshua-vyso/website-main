'use client';

import { usePlatform } from '@/lib/platform/session';

/**
 * Hard-locks the whole platform once the 14-day trial has ended (Q2 resolved:
 * hard lock, not a banner — see .ai/plan_finch-onboarding.md §2/§4 Phase E).
 *
 * Renders a full-screen "trial ended" screen INSTEAD of `children` when
 * `session.trial.expired` is true. Mirrors ModuleLockGuard's lock-screen visual
 * grammar (icon chip, heading, copy, mailto CTA) so the two locked states read
 * as the same product language. Data is retained — only access is paused — and
 * the CTA copy says so. TopBar renders above this in app/app/layout.tsx so
 * sign-out stays reachable.
 *
 * Degrades gracefully: `trial` is null for orgs with no trial dates (existing
 * orgs, or onboarding not yet run), so nothing is ever gated for them.
 */
export function TrialGate({ children }: { children: React.ReactNode }) {
  const { trial } = usePlatform();

  if (!trial?.expired) {
    return <>{children}</>;
  }

  const endedOn = trial.endsAt
    ? new Date(trial.endsAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const mailto = `mailto:joshua@vyso.co.za?subject=${encodeURIComponent('Continue with Vyso')}`;

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDEFF1] text-[#6B6F68]"
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
        <h1 className="mt-5 text-[18px] font-semibold text-[#171A17]">Your trial has ended</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B6F68]">
          {endedOn ? `Your 14-day trial ended on ${endedOn}. ` : 'Your 14-day trial has ended. '}
          Your data is safe and nothing has been deleted — contact joshua@vyso.co.za to continue with Vyso.
        </p>
        <a
          href={mailto}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174C87]"
        >
          Email Joshua
        </a>
      </div>
    </div>
  );
}
