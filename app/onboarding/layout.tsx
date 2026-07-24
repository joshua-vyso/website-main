import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { FinchMark } from '@/components/platform/finch/FinchMark';
import { OnboardingSignOut } from '@/components/platform/onboarding/OnboardingSignOut';

export const metadata: Metadata = {
  title: 'Set up your workspace | Vyso',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Onboarding shell (D3). Server-guarded:
 *  - no session → /login
 *  - onboarding already complete → /app
 * Full-screen, platform-styled (Instrument Sans + a real --radius so the portal
 * rule holds for anything mounted inside), page bg #F6F6F4 with the same top
 * wash gradient the app shell uses. Minimal chrome: Finch mark + title + sign-out.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (session.org?.onboarding_completed_at) redirect('/app');

  return (
    <div
      // Globals set --radius: 0; give this subtree (and any portal it renders) a
      // real radius + the platform font, matching app/app/layout.tsx.
      style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
      className="flex min-h-screen flex-col bg-[#F6F6F4] text-[#171A17] antialiased"
    >
      <header className="flex items-center justify-between border-b border-[#E9EEF4] bg-white/85 px-6 py-3.5 backdrop-blur-[10px]">
        <div className="flex items-center gap-2.5">
          <span className="finch-gradient flex h-7 w-7 items-center justify-center rounded-full">
            <FinchMark size={15} title="" />
          </span>
          <span className="of-display text-[15px] font-semibold text-[#171A17]">Set up your workspace</span>
        </div>
        <OnboardingSignOut />
      </header>

      <main
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #F3F8FF 0%, #F6F6F4 340px)' }}
      >
        {children}
      </main>
    </div>
  );
}
