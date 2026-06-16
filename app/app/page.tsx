import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { MODULES } from '@/lib/platform/modules';

/** Redirect to the first module the org actually has enabled. */
export default async function AppIndex() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const first =
    MODULES.find((m) => m.status === 'active' && session.features[m.key]) ?? MODULES[0];
  redirect(first.screens.desktop);
}
