import { NextResponse } from 'next/server';
import { getServiceDenLeadDetail } from '@/lib/platform/serviceden-leads-data';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const detail = await getServiceDenLeadDetail(ctx.orgId, id);
  if (!detail || detail.lead.ownerUserId !== ctx.userId) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }
  return NextResponse.json(detail, { headers: { 'cache-control': 'no-store' } });
}
