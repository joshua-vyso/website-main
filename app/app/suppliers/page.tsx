import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { ComingSoon } from '@/components/platform/ComingSoon';

/** SupplierHub is now a standalone "coming soon" module. */
export default async function SuppliersPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  return <ComingSoon moduleKey="suppliers" />;
}
