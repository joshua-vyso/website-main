import { NextResponse, after } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processEmailIngest } from '@/lib/platform/email-ingest';

export const maxDuration = 300;

/**
 * Re-run one received email — owner/admin only.
 *
 * For mail that was held or failed (an unapproved sender since approved, a transient
 * download error, a rejection we've since fixed). Re-queues the row and processes it
 * immediately.
 *
 * Re-processing is safe: the worker claims the row with a compare-and-swap and skips
 * attachments already recorded in processed_attachment_ids, so retrying can't file a
 * document twice.
 *
 * Body: { id }.
 */
export async function POST(req: Request) {
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

  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'An email id is required.' }, { status: 400 });

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  // Scoped to the caller's own org — the id comes from the request, so it is not
  // trusted on its own.
  const { data: updated } = await supabase
    .from('email_ingests')
    .update({ status: 'queued', error: null, attempts: 0 })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id')
    .maybeSingle();

  if (!updated) {
    return NextResponse.json({ error: 'That email is not in your organisation.' }, { status: 404 });
  }

  after(async () => {
    const client = createServiceSupabase();
    if (client) await processEmailIngest(client, id);
  });

  return NextResponse.json({ ok: true, id });
}
