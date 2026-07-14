import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processEmailIngest } from '@/lib/platform/email-ingest';

export const maxDuration = 300;

/** Give up on an email after this many attempts so a poison message can't loop. */
const MAX_ATTEMPTS = 3;
/** A row stuck in 'processing' longer than this lost its invocation (timeout/crash). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;
/** Bounded per run so one invocation can't run past its budget. */
const BATCH = 5;

/**
 * Safety net for the inbound-email queue.
 *
 * The happy path never needs this: /api/email/inbound processes each email in
 * after() right when it lands. This drains what that missed — emails whose
 * invocation timed out or crashed mid-way, and ones re-queued after a sender was
 * approved. Runs on a Vercel Cron (see vercel.json); the schedule is deliberately
 * not load-bearing, so a slow cron tier only delays recovery, never normal ingest.
 *
 * Authenticated with CRON_SECRET — Vercel Cron sends it as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  // Queued work, plus anything that died mid-flight.
  const { data: queued } = await supabase
    .from('email_ingests')
    .select('id')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  const { data: stale } = await supabase
    .from('email_ingests')
    .select('id')
    .eq('status', 'processing')
    .lt('attempts', MAX_ATTEMPTS)
    .lt('created_at', staleBefore)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  const ids = [
    ...((queued ?? []) as { id: string }[]).map((r) => r.id),
    ...((stale ?? []) as { id: string }[]).map((r) => r.id),
  ].slice(0, BATCH);

  // Serial on purpose: each one runs an AI extraction, and a burst of them would
  // blow both the function budget and the model rate limit.
  for (const id of ids) {
    await processEmailIngest(supabase, id);
  }

  // Anything that has burned through its attempts is dead — stop retrying it.
  await supabase
    .from('email_ingests')
    .update({ status: 'failed', error: 'Gave up after repeated failures.' })
    .in('status', ['queued', 'processing'])
    .gte('attempts', MAX_ATTEMPTS);

  return NextResponse.json({ ok: true, processed: ids.length });
}
