import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { TopBar } from '@/components/platform/TopBar';
import { ModuleLockGuard } from '@/components/platform/ModuleLockGuard';
import { TrialGate } from '@/components/platform/TrialGate';

export const metadata: Metadata = {
  title: 'Vyso — Platform',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/** Auth guard for the desktop platform. Redirects to /login when unauthenticated. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  // D3 — a signed-in user who hasn't finished onboarding is sent to the guided
  // /onboarding flow: no org yet (brand-new signup), or an org whose onboarding
  // isn't complete. `=== null` (not a falsy check) is deliberate — existing orgs
  // predating the onboarding migration have NO onboarding_completed_at column, so
  // the field is `undefined` there and they are never redirected. Orgs created by
  // the onboarding RPC have the column present-but-null until they finish.
  if (!session.org || session.org.onboarding_completed_at === null) redirect('/onboarding');

  return (
    <PlatformProvider value={session}>
      <div
        // Globals set --radius: 0 (sharp shadcn default), which zeroes the
        // rounded-sm/md/lg/xl scale and leaves buttons/inputs square. Give the
        // platform subtree a real radius so all corners round consistently.
        style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
        className="flex h-screen flex-col overflow-hidden bg-white text-[#171A17] antialiased"
      >
        <TopBar />
        {/* The cool wash every module sits on. It lives here rather than in each
            module layout so the nine of them can't drift apart. */}
        <main
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
          style={{ background: 'linear-gradient(180deg, #F3F8FF 0%, #FFFFFF 340px)' }}
        >
          <TrialGate>
            <ModuleLockGuard>{children}</ModuleLockGuard>
          </TrialGate>
        </main>
      </div>
    </PlatformProvider>
  );
}
