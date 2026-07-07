import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { agentClient, agentConfigured, sanitizeMessages } from '@/lib/ai/vyso-agent/runtime';
import { AGENT_MODEL, AGENT_MAX_TOKENS, isAgentModule, isVysoAiAllowed } from '@/lib/ai/vyso-agent/config';
import { buildSystemPrompt } from '@/lib/ai/vyso-agent/knowledge';
import { toolDefsFor, runTool, type ToolContext } from '@/lib/ai/vyso-agent/tools';

// Tool-use turns can chain a couple of round-trips; give headroom.
export const maxDuration = 45;

// Safety cap on the agentic loop (each iteration = one model turn ± tool calls).
const MAX_TURNS = 5;

/** A short, user-facing status shown while a tool runs. */
const TOOL_ACTIVITY: Record<string, string> = {
  orderflow_get_business_snapshot: 'Checking the numbers…',
  orderflow_list_recent_invoices: 'Reading recent invoices…',
  orderflow_list_recent_orders: 'Reading recent orders…',
  orderflow_find_customer: 'Looking up the customer…',
};

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
 * Vyso AI chat — streams a Haiku reply as Server-Sent Events, with tool use so
 * the agent can read the caller's live OrderFlow data (via their RLS-scoped
 * Supabase client — a tool can only ever touch the caller's own org). Preview-
 * gated to VYSO_AI_EMAILS on the server. Body: { messages, module, orgName? }.
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

  // Resolve the caller's org + role (for tools + the finance gate). RLS lets a
  // user read their own profile only.
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string | null }>();
  const orgId = profile?.org_id ?? null;
  const canSeeMoney = profile?.role !== 'member';

  const toolCtx: ToolContext = { supabase: auth.supabase, orgId: orgId ?? '', canSeeMoney };
  // Only offer tools when we have an org to read from.
  const tools = orgId ? toolDefsFor(module) : [];

  const client = agentClient();
  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          /* stream already cancelled */
        }
      };

      const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const modelStream = client.messages.stream(
            {
              model: AGENT_MODEL,
              max_tokens: AGENT_MAX_TOKENS,
              system,
              messages: convo,
              ...(tools.length ? { tools } : {}),
            },
            { signal: req.signal },
          );
          for await (const event of modelStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              safeEnqueue(send({ text: event.delta.text }));
            }
          }
          const finalMsg = await modelStream.finalMessage();
          convo.push({ role: 'assistant', content: finalMsg.content });

          if (finalMsg.stop_reason !== 'tool_use') break;

          // Run each requested tool through the RLS-scoped client, then feed the
          // results back for the model's next turn.
          const toolUses = finalMsg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            safeEnqueue(send({ tool: TOOL_ACTIVITY[tu.name] ?? 'Looking things up…' }));
            const { content, isError } = await runTool(
              module,
              tu.name,
              toolCtx,
              (tu.input ?? {}) as Record<string, unknown>,
            );
            results.push({ type: 'tool_result', tool_use_id: tu.id, content, is_error: isError });
          }
          convo.push({ role: 'user', content: results });
        }
        safeEnqueue(send({ done: true }));
      } catch (err) {
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
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
