'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgentModule } from '@/lib/ai/vyso-agent/config';
import { BouncingDots } from './BouncingDots';

// Portals mount on document.body, outside the platform subtree's --radius
// override — re-declare it (else rounded corners collapse) plus the app font.
const PORTAL_STYLE = {
  fontFamily: 'var(--font-inter)',
  ['--radius' as string]: '0.625rem',
} as React.CSSProperties;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Render assistant text with minimal, safe formatting: `**bold**` → <strong>.
 * Builds React nodes (never dangerouslySetInnerHTML), so pasted content can't
 * inject markup. Newlines are preserved by the container's whitespace-pre-wrap.
 */
function renderContent(text: string) {
  return text.split('**').map((seg, i) =>
    i % 2 === 1 ? <strong key={i}>{seg}</strong> : <span key={i}>{seg}</span>,
  );
}

/** Parse an SSE `data:` payload line into our event shape. */
function parseSse(line: string): { text?: string; tool?: string; done?: boolean; error?: string } | null {
  if (!line.startsWith('data:')) return null;
  try {
    return JSON.parse(line.slice(5).trim());
  } catch {
    return null;
  }
}

export function VysoAIModal({
  open,
  onClose,
  module,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  module: AgentModule;
  orgName: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes; lock body scroll while open; focus the input on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Abort any in-flight stream when the modal closes.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  // Also abort if the component unmounts mid-stream (e.g. route change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the transcript pinned to the bottom as content grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
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
        throw new Error(detail.error ?? `Vyso AI request failed (${res.status})`);
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
        // Preserve any partial reply so the user still sees it.
        if (acc) setMessages((prev) => [...prev, { role: 'assistant', content: acc }]);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setStreaming(false);
        setStreamText('');
        setStreamStatus(null);
      }
    }
  }, [input, streaming, messages, module, orgName]);

  if (!mounted || !open) return null;

  const empty = messages.length === 0 && !streaming;
  const orgLabel = orgName?.trim() || 'you';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={PORTAL_STYLE}>
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-[#0F1720]/45 backdrop-blur-[3px]" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vyso AI"
        className="relative flex h-[560px] max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-[#E7E7E2] bg-white shadow-[0_30px_80px_-24px_rgba(15,23,32,0.55)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#F0F0EC] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="vyso-ai-gradient flex h-6 w-6 items-center justify-center rounded-full">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" fill="#fff" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold text-[#1A1C1E]">Vyso AI</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
          >
            ✕
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <BouncingDots size={9} />
              <p className="mt-4 max-w-[300px] text-[14px] leading-5 text-[#5F6368]">
                Ask me how to do anything in this module — creating orders, invoices, price lists, rebates and more.
              </p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-5 ${
                      m.role === 'user'
                        ? 'bg-[#EAF3FC] text-[#123]'
                        : 'border border-[#EFEFEA] bg-[#FBFBF9] text-[#1A1C1E]'
                    }`}
                  >
                    {m.role === 'assistant' ? renderContent(m.content) : m.content}
                  </div>
                </div>
              ))}
              {streaming ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl border border-[#EFEFEA] bg-[#FBFBF9] px-3.5 py-2.5 text-[13.5px] leading-5 text-[#1A1C1E]">
                    {streamText ? (
                      <span className="whitespace-pre-wrap">{renderContent(streamText)}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <BouncingDots size={7} />
                        {streamStatus ? <span className="text-[12px] text-[#5F6368]">{streamStatus}</span> : null}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
          {error ? <p className="px-1 text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>

        {/* Composer */}
        <div className="border-t border-[#F0F0EC] p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[#D7DAD8] bg-white px-3 py-2 focus-within:border-[#3E8FE0]/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={`How can I help ${orgLabel} today?`}
              className="max-h-28 flex-1 resize-none bg-transparent text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || streaming}
              aria-label="Send"
              className="vyso-ai-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12l16-8-6 8 6 8-16-8z" fill="#fff" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10.5px] text-[#B4B7B4]">
            Vyso AI can make mistakes — double-check anything important.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
