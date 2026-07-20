import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.service.rpc('sd_convert_lead', {
    p_lead_id: id,
    p_org_id: ctx.orgId,
    p_owner_user_id: ctx.userId,
  });
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Could not convert this lead.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, customerId: data });
}
