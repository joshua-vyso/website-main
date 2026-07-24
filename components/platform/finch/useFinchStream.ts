'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentModule } from '@/lib/ai/finch/config';

/**
 * Shared Finch chat streaming hook — a plain text conversation over the
 * `/api/ai/agent` SSE endpoint (events `{text}|{tool}|{done}|{error}`). This is
 * the small, self-contained reader FinchModal open-codes inline; it's extracted
 * here so simpler surfaces (the onboarding data stage) can stream a Finch reply
 * without re-deriving the fetch → getReader → split('\n\n') → parse loop.
 *
 * NOTE (Phase D): FinchModal was intentionally NOT refactored onto this hook —
 * its `send` carries extra branches (deferred file attachments, order-draft
 * cards, the order-workflow tier arming) that don't belong in a generic text
 * chat. Duplicating the ~15-line reader here is cleaner than widening the hook
 * to cover those cases. See .ai/plan_finch-onboarding.md §4 Phase D.
 */

export interface FinchChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SseEvent {
  text?: string;
  tool?: string;
  done?: boolean;
  error?: string;
}

function parseSse(line: string): SseEvent | null {
  if (!line.startsWith('data:')) return null;
  try {
    return JSON.parse(line.slice(5).trim());
  } catch {
    return null;
  }
}

export interface UseFinchStream {
  messages: FinchChatMessage[];
  streaming: boolean;
  streamText: string;
  streamStatus: string | null;
  error: string | null;
  send: (text: string) => Promise<void>;
}

export function useFinchStream(opts: { module: AgentModule; orgName: string | null }): UseFinchStream {
  const { module, orgName } = opts;
  const [messages, setMessages] = useState<FinchChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;

      const nextMessages: FinchChatMessage[] = [...messages, { role: 'user', content: text }];
      setMessages(nextMessages);
      setError(null);
      setStreaming(true);
      setStreamText('');
      setStreamStatus(null);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let acc = '';

      try {
        const res = await fetch('/api/ai/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages, module, orgName }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const detail = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(detail.error ?? `Finch request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamError: string | null = null;

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const evt = parseSse(part.trim());
            if (!evt) continue;
            if (evt.error) streamError = evt.error;
            else if (evt.tool) setStreamStatus(evt.tool);
            else if (evt.text) {
              acc += evt.text;
              setStreamText(acc);
            }
          }
        }

        if (streamError) throw new Error(streamError);
        setMessages((prev) => [...prev, { role: 'assistant', content: acc || '…' }]);
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          if (acc) setMessages((prev) => [...prev, { role: 'assistant', content: acc }]);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setStreaming(false);
          setStreamText('');
          setStreamStatus(null);
        }
      }
    },
    [messages, module, orgName, streaming],
  );

  return { messages, streaming, streamText, streamStatus, error, send };
}
