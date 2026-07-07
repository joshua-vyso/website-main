import { NextResponse } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { agentClient, agentConfigured, sanitizeMessages } from '@/lib/ai/vyso-agent/runtime';
import { AGENT_MODEL, AGENT_MAX_TOKENS, isAgentModule, isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';
import { buildSystemPrompt } from '@/lib/ai/vyso-agent/knowledge';

// A chat turn is short, but give it headroom over the default.
export const maxDuration = 30;

const SSE_HEADERS: Record<string, string> = {
  ...AI_CORS_HEADERS,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Vyso AI chat — streams a Haiku reply as Server-Sent Events. Preview-gated to
 * VYSO_AI_EMAILS on the server (the client also hides the button, but never
 * trust the client). Body: { messages: {role,content}[], module, orgName? }.
 */
export async function POST(req: Request) {
  if (!agentConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  if (!isVysoAiAllowed(auth.email)) {
    return NextResponse.json({ error: 'Vyso AI is not enabled for your account.' }, { status: 403, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    messages?: unknown;
    module?: unknown;
    orgName?: unknown;
  };

  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const module = isAgentModule(body.module) ? body.module : 'orderflow';
  const orgName = typeof body.orgName === 'string' ? body.orgName.slice(0, 120) : null;
  const system = buildSystemPrompt({ module, orgName });

  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const modelStream = agentClient().messages.stream(
        { model: AGENT_MODEL, max_tokens: AGENT_MAX_TOKENS, system, messages },
        { signal: req.signal },
      );
      // Terminal controller ops throw if the client already cancelled the stream
      // (modal closed / navigated away). Guard them so an abort race can't turn
      // into an unhandled rejection.
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          /* stream already cancelled */
        }
      };
      try {
        for await (const event of modelStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            safeEnqueue(send({ text: event.delta.text }));
          }
        }
        safeEnqueue(send({ done: true }));
      } catch (err) {
        // Client aborts are expected — don't surface them as errors.
        if (!req.signal.aborted) {
          safeEnqueue(send({ error: err instanceof Error ? err.message : 'Vyso AI request failed' }));
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed/cancelled */
        }
      }
    },
    cancel() {
      // The browser closed the stream (modal closed / navigated away).
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
