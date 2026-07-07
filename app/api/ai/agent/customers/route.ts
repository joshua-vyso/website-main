import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';

/**
 * The caller's customer names, for Vyso AI's "/" order-workflow picker. Gated to
 * the preview allowlist and scoped to the caller's own org via their RLS client
 * (id + name only — no financials).
 */
export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

export async function GET(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  if (!isVysoAiAllowed(auth.email)) {
    return NextResponse.json({ error: 'Vyso AI is not enabled for your account.' }, { status: 403, headers: AI_CORS_HEADERS });
  }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null }>();
  const orgId = profile?.org_id;
  if (!orgId) {
    return NextResponse.json({ customers: [] }, { headers: AI_CORS_HEADERS });
  }

  const { data } = await auth.supabase
    .from('of_customers')
    .select('id, name')
    .eq('org_id', orgId)
    .order('name');

  return NextResponse.json({ customers: data ?? [] }, { headers: AI_CORS_HEADERS });
}
