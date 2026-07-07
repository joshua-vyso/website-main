'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { AgentModule } from '@/lib/ai/vyso-agent/config';
import { stashParsedOrder, type ParsedOrder } from '@/lib/ai/vyso-agent/order-handoff';
import { BouncingDots } from './BouncingDots';

/** Read a File as base64 (no data: prefix) + its media type. */
function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve({ base64: comma >= 0 ? result.slice(comma + 1) : result, mediaType: file.type || 'application/octet-stream' });
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

const MAX_ORDER_BYTES = 13 * 1024 * 1024;
/** How many order files we'll read from a single drop/selection. */
const MAX_ORDER_FILES = 8;

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

/** One dropped/selected order file, tracked from parsing → done/error so each
 *  gets its own card. Dropping several orders at once yields several slots. */
interface OrderSlot {
  id: string;
  filename: string;
  status: 'parsing' | 'done' | 'error';
  order?: ParsedOrder;
  error?: string;
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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Order-parsing (drag/drop or file select) — one slot per dropped file, so
  // dropping several orders at once yields several parsed-order cards.
  const [slots, setSlots] = useState<OrderSlot[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slotSeq = useRef(0);

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
  }, [messages, streamText, streaming, slots]);

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

  // Parse one already-accepted file, updating its slot in place.
  const parseInto = useCallback(async (file: File, id: string) => {
    const fail = (msg: string) =>
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'error', error: msg } : s)));
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/ai/agent/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType, filename: file.name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        customer_name?: string | null;
        customer_confidence?: number;
        line_items?: Array<{ description?: string; quantity?: string; unit_price?: string; amount?: string }>;
      };
      if (!res.ok) {
        fail(data.error ?? `Could not read the order (${res.status}).`);
        return;
      }
      const items = (data.line_items ?? [])
        .map((li) => {
          const name = String(li.description ?? '').trim();
          const qty = Number(li.quantity) > 0 ? Number(li.quantity) : 1;
          let unit = Number(li.unit_price) || 0;
          const amt = Number(li.amount) || 0;
          if (!unit && amt) unit = amt / qty;
          return { name, qty, unit_price: Math.round(unit * 100) / 100 };
        })
        .filter((it) => it.name);
      if (items.length === 0 && !data.customer_name) {
        fail("I couldn't read an order from this file. Try a clearer photo or the PDF.");
        return;
      }
      const order: ParsedOrder = {
        customerName: data.customer_name ?? null,
        customerConfidence: data.customer_confidence,
        items,
        filename: file.name,
      };
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'done', order } : s)));
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Could not read the order.');
    }
  }, []);

  // Accept one or more dropped/selected files: make a slot per file, then parse
  // the valid ones concurrently.
  const handleFiles = useCallback(
    (fileList: File[]) => {
      const files = fileList.slice(0, MAX_ORDER_FILES);
      const newSlots: OrderSlot[] = [];
      const toParse: Array<{ file: File; id: string }> = [];
      for (const file of files) {
        const id = `slot_${slotSeq.current++}`;
        const okType = file.type === 'application/pdf' || file.type.startsWith('image/');
        if (!okType) {
          newSlots.push({ id, filename: file.name, status: 'error', error: 'Not a PDF or image.' });
          continue;
        }
        if (file.size > MAX_ORDER_BYTES) {
          newSlots.push({ id, filename: file.name, status: 'error', error: 'Too large (max ~13MB).' });
          continue;
        }
        newSlots.push({ id, filename: file.name, status: 'parsing' });
        toParse.push({ file, id });
      }
      if (fileList.length > MAX_ORDER_FILES) {
        newSlots.push({
          id: `slot_${slotSeq.current++}`,
          filename: `${fileList.length - MAX_ORDER_FILES} more`,
          status: 'error',
          error: `Only the first ${MAX_ORDER_FILES} files were read.`,
        });
      }
      if (newSlots.length === 0) return;
      setSlots((prev) => [...prev, ...newSlots]);
      void Promise.all(toParse.map(({ file, id }) => parseInto(file, id)));
    },
    [parseInto],
  );

  function openInNewOrder(order: ParsedOrder) {
    stashParsedOrder(order);
    onClose();
    router.push('/app/orderflow/orders/new');
  }

  async function copyOrder(order: ParsedOrder) {
    const lines = order.items.map(
      (it) => `${it.name} — qty ${it.qty}${it.unit_price ? ` @ R ${it.unit_price.toFixed(2)}` : ''}`,
    );
    const text = [order.customerName ? `Order for ${order.customerName}` : 'Order', ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  const dismissSlot = (id: string) => setSlots((prev) => prev.filter((s) => s.id !== id));

  if (!mounted || !open) return null;

  const empty = messages.length === 0 && !streaming && slots.length === 0;
  const orgLabel = orgName?.trim() || 'you';

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={PORTAL_STYLE}>
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-[#0F1720]/45 backdrop-blur-[3px]" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vyso AI"
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) handleFiles(files);
        }}
        className="relative flex h-[560px] max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-[#E7E7E2] bg-white shadow-[0_30px_80px_-24px_rgba(15,23,32,0.55)]"
      >
        {dragOver ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-[#3E8FE0] bg-[#F2F8FE]/85 backdrop-blur-[1px]">
            <span className="text-[14px] font-semibold text-[#12324F]">Drop the order(s) to read them</span>
          </div>
        ) : null}
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
              <p className="mt-4 max-w-[310px] text-[14px] leading-5 text-[#5F6368]">
                Ask me how to do anything in this module, or about your live numbers, orders and customers. You can also
                drop one or more orders in to read them.
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

              {slots.map((slot) =>
                slot.status === 'parsing' ? (
                  <div
                    key={slot.id}
                    className="flex items-center gap-2 rounded-2xl border border-[#EFEFEA] bg-[#FBFBF9] px-3.5 py-2.5"
                  >
                    <BouncingDots size={7} />
                    <span className="truncate text-[12px] text-[#5F6368]">Reading {slot.filename}…</span>
                  </div>
                ) : slot.status === 'error' ? (
                  <p key={slot.id} className="px-1 text-[12px] text-[#A32D2D]">
                    {slot.filename}: {slot.error}
                  </p>
                ) : slot.order ? (
                  <ParsedOrderCard
                    key={slot.id}
                    order={slot.order}
                    onOpen={() => openInNewOrder(slot.order!)}
                    onCopy={() => copyOrder(slot.order!)}
                    onDismiss={() => dismissSlot(slot.id)}
                  />
                ) : null,
              )}
            </>
          )}
          {error ? <p className="px-1 text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>

        {/* Composer */}
        <div className="border-t border-[#F0F0EC] p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[#D7DAD8] bg-white px-3 py-2 focus-within:border-[#3E8FE0]/60">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) handleFiles(files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add order documents"
              title="Add one or more orders to read"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5F6368] transition-colors hover:bg-[#F0F0EC] disabled:opacity-40"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.9 17.5a1.6 1.6 0 0 1-2.3-2.3l7.6-7.6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
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

/** A parsed order shown in the chat, with actions to open it in a new order or copy it. */
function ParsedOrderCard({
  order,
  onOpen,
  onCopy,
  onDismiss,
}: {
  order: ParsedOrder;
  onOpen: () => void;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const lowConfidence = typeof order.customerConfidence === 'number' && order.customerConfidence < 60;
  const count = order.items.length;

  return (
    <div className="rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE] p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#12324F]">
        <span className="vyso-ai-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" fill="#fff" />
          </svg>
        </span>
        <span>Parsed order</span>
        {order.filename ? (
          <span className="min-w-0 truncate text-[11px] font-normal text-[#5F80A0]">· {order.filename}</span>
        ) : null}
      </div>

      {order.customerName ? (
        <div className="mt-1.5 text-[12px] text-[#12324F]">
          Customer: <span className="font-medium">{order.customerName}</span>
          {lowConfidence ? <span className="text-[#9A6A00]"> · please confirm</span> : null}
        </div>
      ) : (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">No customer detected — you can pick one in the order.</div>
      )}

      {count ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#D5E6F7] bg-white">
          {order.items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-[#EEF4FB] px-3 py-1.5 text-[12px] last:border-0"
            >
              <span className="truncate text-[#1A1C1E]">{it.name}</span>
              <span className="shrink-0 tabular-nums text-[#5F6368]">
                {it.qty}
                {it.unit_price ? ` × R ${it.unit_price.toFixed(2)}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[12px] text-[#5F6368]">No line items detected.</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="vyso-ai-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
        >
          Open in a new order
        </button>
        <button
          type="button"
          onClick={() => {
            onCopy();
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F7FAFD]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#E4EFFA]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
