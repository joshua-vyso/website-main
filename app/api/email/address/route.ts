import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import { INGEST_DOMAIN, addressFor, generateLocalPart } from '@/lib/platform/email-ingest-policy';

/**
 * Mint (or rotate) the org's inbound-email address — owner/admin only.
 *
 * The random suffix in the local part IS the shared secret that lets mail in, so
 * rotating deactivates the old address rather than editing it. The org always
 * comes from the caller's verified profiles row.
 * Body: { rotate?: boolean }.
 */
export async function POST(req: Request) {
  if (!INGEST_DOMAIN) {
    return NextResponse.json({ error: 'EMAIL_INGEST_DOMAIN is not set.' }, { status: 503 });
  }

  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string }>();
  if (!profile?.org_id || (profile.role !== 'owner' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Only an owner or admin can do this.' }, { status: 403 });
  }
  const orgId = profile.org_id;

  const body = (await req.json().catch(() => ({}))) as { rotate?: unknown };
  const rotate = body.rotate === true;

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const { data: current } = await supabase
    .from('email_ingest_addresses')
    .select('local_part')
    .eq('org_id', orgId)
    .eq('active', true)
    .maybeSingle();

  if (current && !rotate) {
    const localPart = (current as { local_part: string }).local_part;
    return NextResponse.json({ ok: true, address: addressFor(localPart) });
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .maybeSingle();
  const slug = (org as { slug: string | null } | null)?.slug ?? 'org';

  // Retire the old address first — the unique index allows only one active per org.
  if (current) {
    await supabase
      .from('email_ingest_addresses')
      .update({ active: false })
      .eq('org_id', orgId)
      .eq('active', true);
  }

  // The local part must be globally unique; a collision is astronomically unlikely
  // but retry rather than hand back an error.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const localPart = generateLocalPart(slug);
    const { error } = await supabase
      .from('email_ingest_addresses')
      .insert({ org_id: orgId, local_part: localPart, active: true });
    if (!error) {
      return NextResponse.json({ ok: true, address: addressFor(localPart), rotated: Boolean(current) });
    }
    if (!isUniqueViolation(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Could not generate an address.' }, { status: 500 });
}
