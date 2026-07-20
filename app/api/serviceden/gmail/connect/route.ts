import { NextResponse } from 'next/server';
import { createGmailAuthorizationUrl, gmailRedirectUri } from '@/lib/platform/serviceden-gmail';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const origin = new URL(request.url).origin;
    const authorizationUrl = await createGmailAuthorizationUrl(ctx, gmailRedirectUri(origin));
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Gmail.';
    const url = new URL('/app/serviceden/leads', request.url);
    url.searchParams.set('gmail_error', message.slice(0, 300));
    return NextResponse.redirect(url);
  }
}
