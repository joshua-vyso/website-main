import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getSupplySyncData, EMPTY_SUPPLYSYNC } from '@/lib/platform/supplysync-data';
import { SupplySyncProvider } from '@/components/platform/supplysync/context';
import { SupplySyncChrome } from '@/components/platform/supplysync/Chrome';

/** SupplySync chrome: fetch the org's supplier intelligence once, provide it to
 * every tab, and host the shared profile/compare/add overlays. */
export default async function SupplySyncLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getSupplySyncData(session.org.id) : EMPTY_SUPPLYSYNC;

  return (
    <div className="px-8 py-7">
      <SupplySyncProvider data={data}>
        <SupplySyncChrome>{children}</SupplySyncChrome>
      </SupplySyncProvider>
    </div>
  );
}
