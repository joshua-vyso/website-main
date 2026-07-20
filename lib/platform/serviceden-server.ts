import 'server-only';

import { createServiceSupabase } from './supabase-service';
import { getPlatformSession } from './supabase-server';
import { SERVICEDEN_ACCOUNT_EMAIL } from './serviceden';

export async function requireServiceDenServerContext() {
  const session = await getPlatformSession();
  if (
    !session ||
    !session.org ||
    session.email.trim().toLowerCase() !== SERVICEDEN_ACCOUNT_EMAIL.toLowerCase()
  ) {
    return null;
  }

  const service = createServiceSupabase();
  if (!service) return null;

  const { data: grant, error: grantError } = await service
    .from('sd_access_grants')
    .select('user_id')
    .eq('user_id', session.userId)
    .eq('org_id', session.org.id)
    .eq('enabled', true)
    .maybeSingle();
  if (grantError || !grant) return null;

  return {
    session,
    service,
    orgId: session.org.id,
    userId: session.userId,
  };
}
