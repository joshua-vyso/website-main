import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { syncServiceDenGmail } from '@/lib/platform/serviceden-gmail';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const secrets = [process.env.SERVICEDEN_GMAIL_CRON_SECRET, process.env.CRON_SECRET]
    .filter((secret): secret is string => Boolean(secret));
  if (!secrets.length || !supplied) return false;
  const suppliedBytes = Buffer.from(supplied);
  return secrets.some((secret) => {
    const expectedBytes = Buffer.from(secret);
    return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
  });
}

async function handle(request: Request) {
  if (!process.env.SERVICEDEN_GMAIL_CRON_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'ServiceDen Gmail cron is not configured.' }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });

  const { data: connections, error } = await service
    .from('sd_gmail_connections')
    .select('id,org_id,user_id,status,updated_at')
    .in('status', ['connected', 'error', 'syncing'])
    .order('updated_at', { ascending: true })
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staleCutoff = Date.now() - 5 * 60_000;
  const candidates = (connections ?? [])
    .filter((connection) =>
      connection.status !== 'syncing' || Date.parse(String(connection.updated_at)) < staleCutoff,
    );
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];
  for (const connection of candidates) {
    // The grant is the server-side allowlist; a stale connection cannot wake up
    // after its ServiceDen access has been revoked.
    const { data: grant } = await service
      .from('sd_access_grants')
      .select('user_id')
      .eq('user_id', connection.user_id)
      .eq('org_id', connection.org_id)
      .eq('enabled', true)
      .maybeSingle();
    if (!grant) continue;
    try {
      await syncServiceDenGmail(
        { service, orgId: String(connection.org_id), userId: String(connection.user_id) },
        String(connection.id),
      );
      results.push({ connectionId: String(connection.id), ok: true });
    } catch (syncError) {
      results.push({
        connectionId: String(connection.id),
        ok: false,
        error: syncError instanceof Error ? syncError.message.slice(0, 300) : 'Sync failed.',
      });
    }
    // One mailbox per invocation keeps the route inside the serverless budget.
    // Error writes update updated_at, so the secondary ordering rotates the next
    // eligible connection instead of allowing one broken inbox to starve others.
    break;
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

// Vercel Cron invokes GET; POST keeps the endpoint convenient for other
// schedulers. Both require the same bearer secret.
export const GET = handle;
export const POST = handle;
