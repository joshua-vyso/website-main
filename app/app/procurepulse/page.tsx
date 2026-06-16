import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { ComingSoon } from '@/components/platform/ComingSoon';

export default async function ProcurePulsePage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  return <ComingSoon moduleKey="procurepulse" />;
}
