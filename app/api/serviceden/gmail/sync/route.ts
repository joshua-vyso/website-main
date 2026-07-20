import { NextResponse } from 'next/server';
import { syncServiceDenGmail } from '@/lib/platform/serviceden-gmail';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { connectionId?: unknown };
  let connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
  if (!connectionId) {
    const { data } = await ctx.service
      .from('sd_gmail_connections')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('user_id', ctx.userId)
      .neq('status', 'disconnected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    connectionId = data?.id ? String(data.id) : '';
  }
  if (!connectionId) return NextResponse.json({ error: 'Connect Gmail first.' }, { status: 400 });

  try {
    const result = await syncServiceDenGmail(ctx, connectionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail sync failed.';
    const status = /already in progress|not active/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
