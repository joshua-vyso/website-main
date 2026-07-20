import { NextResponse } from 'next/server';
import { disconnectServiceDenGmail } from '@/lib/platform/serviceden-gmail';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { connectionId?: unknown };
  const connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
  if (!connectionId) return NextResponse.json({ error: 'connectionId is required.' }, { status: 400 });

  try {
    const result = await disconnectServiceDenGmail(ctx, connectionId);
    return NextResponse.json({ ok: true, warning: result.warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not disconnect Gmail.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
