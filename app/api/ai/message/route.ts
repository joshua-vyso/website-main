import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { runPrompt, aiConfigured } from '@/lib/ai/anthropic';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';

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

  // Per-user hourly cap — this is an Opus-backed endpoint, so a runaway loop is a direct
  // spend bomb even for one authenticated account.
  if (!(await rateLimitAllowed(`ai-msg:${auth.userId}`, 60, 60 * 60))) {
    return NextResponse.json({ error: 'You’ve hit the hourly AI limit. Please try again later.' }, {
      status: 429,
      headers: AI_CORS_HEADERS,
    });
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string; system?: string };
  if (!body.prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  // Bound the input before it reaches the model. This is an open, Opus-backed endpoint, so
  // an unbounded prompt+system is a direct cost bomb — ~4.5MB of text is ~1M input tokens,
  // and it can be looped. 40k chars is generous for real document Q&A. (A per-user token
  // quota / cheaper-model routing is the separate cost-controls decision.)
  if ((body.prompt.length ?? 0) + (body.system?.length ?? 0) > 40_000) {
    return NextResponse.json({ error: 'Input too large.' }, { status: 413, headers: AI_CORS_HEADERS });
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
