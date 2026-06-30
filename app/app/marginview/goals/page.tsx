import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { GoalsView } from '@/components/platform/planwise/GoalsView';
import type { PlTargets } from '@/lib/platform/pricepilot';

export default async function PlanWiseGoalsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();
  const { data, error } = await db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle();
  const needsSetup = !!error && /does not exist|relation .*pl_targets/i.test(error.message);
  return <GoalsView initial={(data ?? null) as PlTargets | null} needsSetup={needsSetup} />;
}
