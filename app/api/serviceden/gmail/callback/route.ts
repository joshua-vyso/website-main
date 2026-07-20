import { NextResponse } from 'next/server';
import { finishGmailAuthorization, gmailRedirectUri } from '@/lib/platform/serviceden-gmail';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.redirect(new URL('/login', request.url));

  const requestUrl = new URL(request.url);
  const destination = new URL('/app/serviceden/leads', request.url);
  const providerError = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  if (providerError) {
    destination.searchParams.set('gmail_error', `Google authorization was cancelled: ${providerError}`);
    return NextResponse.redirect(destination);
  }
  if (!code || !state) {
    destination.searchParams.set('gmail_error', 'Google did not return a valid authorization response.');
    return NextResponse.redirect(destination);
  }

  try {
    const result = await finishGmailAuthorization(ctx, {
      code,
      state,
      redirectUri: gmailRedirectUri(requestUrl.origin),
    });
    destination.searchParams.set('gmail_connected', result.emailAddress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not finish the Gmail connection.';
    destination.searchParams.set('gmail_error', message.slice(0, 300));
  }
  return NextResponse.redirect(destination);
}
