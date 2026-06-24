import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { Sidebar } from '@/components/platform/Sidebar';

export const metadata = {
  title: 'Vyso — Platform',
};

/** Auth guard for the desktop platform. Redirects to /login when unauthenticated. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return (
    <PlatformProvider value={session}>
      <div
        // Globals set --radius: 0 (sharp shadcn default), which zeroes the
        // rounded-sm/md/lg/xl scale and leaves buttons/inputs square. Give the
        // platform subtree a real radius so all corners round consistently.
        style={{ fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
        className="flex min-h-screen bg-[#F6F6F4] text-[#1A1C1E] antialiased"
      >
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </PlatformProvider>
  );
}
