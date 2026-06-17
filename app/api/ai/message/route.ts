import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { runPrompt, aiConfigured } from '@/lib/ai/anthropic';

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * General-purpose AI endpoint for any module (summaries, drafting, Q&A).
 * Auth via cookie (web) or Bearer token (mobile). Body: { prompt, system? }.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string; system?: string };
  if (!body.prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  try {
    const text = await runPrompt(body.prompt, body.system);
    return NextResponse.json({ text }, { headers: AI_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500, headers: AI_CORS_HEADERS },
    );
  }
}
