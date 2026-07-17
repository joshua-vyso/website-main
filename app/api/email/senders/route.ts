import { NextResponse, after } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processEmailIngest } from '@/lib/platform/email-ingest';
import { parseEmailAddress } from '@/lib/platform/email-ingest-policy';
import { isUniqueViolation } from '@/lib/platform/db-errors';

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
  //
  // FAIL CLOSED. This is a security control: a Block that silently no-ops would leave a
  // compromised sender approved while telling the admin it's blocked, and their forged
  // invoices keep flowing. So every write is checked and a failure is a hard 500.
  const { data: existing, error: selErr } = await supabase
    .from('email_ingest_senders')
    .select('id')
    .eq('org_id', admin.orgId)
    .eq('email', email)
    .maybeSingle();
  if (selErr) {
    return NextResponse.json({ error: 'Could not update the sender.' }, { status: 500 });
  }

  const patch = { status, approved_by: admin.userId, approved_at: new Date().toISOString() };
  const updateExisting = (id: string) =>
    supabase.from('email_ingest_senders').update(patch).eq('id', id).eq('org_id', admin.orgId);

  let writeErr = existing
    ? (await updateExisting((existing as { id: string }).id)).error
    : (await supabase.from('email_ingest_senders').insert({ org_id: admin.orgId, email, ...patch })).error;

  // A unique violation means a concurrent request created the row between our select and
  // insert — not a failure. Re-apply as an update so OUR decision (approve/block) wins.
  if (writeErr && !existing && isUniqueViolation(writeErr)) {
    const { data: raced } = await supabase
      .from('email_ingest_senders')
      .select('id')
      .eq('org_id', admin.orgId)
      .eq('email', email)
      .maybeSingle();
    writeErr = raced ? (await updateExisting((raced as { id: string }).id)).error : writeErr;
  }

  if (writeErr) {
    return NextResponse.json({ error: 'Could not update the sender. Please try again.' }, { status: 500 });
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
  let released = 0;
  if (ids.length) {
    // Only process what we actually re-queued. If the release write fails, don't kick off
    // ingestion off stale state — the sender is approved, so the cron re-drives it later.
    const { error: releaseErr } = await supabase
      .from('email_ingests')
      .update({ status: 'queued', error: null, attempts: 0 })
      .in('id', ids)
      .eq('org_id', admin.orgId);

    if (!releaseErr) {
      released = ids.length;
      after(async () => {
        const client = createServiceSupabase();
        if (!client) return;
        for (const id of ids) {
          await processEmailIngest(client, id);
        }
      });
    }
  }

  return NextResponse.json({ ok: true, email, status, released });
}
