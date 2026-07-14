import { NextResponse, after } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processEmailIngest } from '@/lib/platform/email-ingest';
import { parseEmailAddress } from '@/lib/platform/email-ingest-policy';

export const maxDuration = 300;

/** Owner/admin of the caller's org, or null. These are the people who decide whose mail becomes invoices. */
async function requireOrgAdmin(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return null;
  const { data } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string }>();
  if (!data?.org_id) return null;
  if (data.role !== 'owner' && data.role !== 'admin') return null;
  return { userId: auth.userId, orgId: data.org_id };
}

/**
 * Approve or block a sender for inbound email ingestion.
 *
 * Approving is a security decision — it says "documents from this address may
 * become invoices in our books" — so it's owner/admin only, and the caller's org
 * comes from their verified profiles row, never the request body.
 *
 * On approval we also release anything from that sender that was quarantined while
 * they were unknown, and process it right away.
 * Body: { email, action: 'approve' | 'block' }.
 */
export async function POST(req: Request) {
  const admin = await requireOrgAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; action?: unknown };
  const email = typeof body.email === 'string' ? parseEmailAddress(body.email) : null;
  const action = body.action === 'approve' || body.action === 'block' ? body.action : null;
  if (!email || !action) {
    return NextResponse.json({ error: 'An email and an action are required.' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const status = action === 'approve' ? 'approved' : 'blocked';

  // Upsert the sender's standing, scoped to the admin's own org.
  // eq(), not ilike(): `%`/`_` are legal in an email and are ilike wildcards.
  const { data: existing } = await supabase
    .from('email_ingest_senders')
    .select('id')
    .eq('org_id', admin.orgId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('email_ingest_senders')
      .update({
        status,
        approved_by: admin.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id)
      .eq('org_id', admin.orgId);
  } else {
    await supabase.from('email_ingest_senders').insert({
      org_id: admin.orgId,
      email,
      status,
      approved_by: admin.userId,
      approved_at: new Date().toISOString(),
    });
  }

  if (action === 'block') {
    return NextResponse.json({ ok: true, email, status });
  }

  // Release this sender's quarantined mail and ingest it now.
  const { data: held } = await supabase
    .from('email_ingests')
    .select('id')
    .eq('org_id', admin.orgId)
    .eq('status', 'quarantined')
    .eq('from_email', email)
    .limit(20);

  const ids = ((held ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length) {
    await supabase
      .from('email_ingests')
      .update({ status: 'queued', error: null, attempts: 0 })
      .in('id', ids)
      .eq('org_id', admin.orgId);

    after(async () => {
      const client = createServiceSupabase();
      if (!client) return;
      for (const id of ids) {
        await processEmailIngest(client, id);
      }
    });
  }

  return NextResponse.json({ ok: true, email, status, released: ids.length });
}
