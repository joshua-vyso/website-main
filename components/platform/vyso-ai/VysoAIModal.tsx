'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { AgentModule } from '@/lib/ai/vyso-agent/config';
import { stashParsedOrder, type ParsedOrder } from '@/lib/ai/vyso-agent/order-handoff';
import { BouncingDots } from './BouncingDots';

/** Read a File as a data URL string. */
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** Read a File as base64 (no data: prefix) + its media type. */
async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const result = await readDataUrl(file);
  const comma = result.indexOf(',');
  return { base64: comma >= 0 ? result.slice(comma + 1) : result, mediaType: file.type || 'application/octet-stream' };
}

/**
 * Downscale an image to at most `maxDim` on the long edge and re-encode as JPEG,
 * so a 12MP phone photo (which would blow the request-size limit and 413) becomes
 * a few hundred KB while staying legible for the order reader. Falls back to the
 * raw bytes if the browser can't decode it.
 */
async function imageToScaledBase64(file: File, maxDim = 2000, quality = 0.82): Promise<{ base64: string; mediaType: string }> {
  try {
    const dataUrl = await readDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fileToBase64(file);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', quality);
    const comma = out.indexOf(',');
    return { base64: comma >= 0 ? out.slice(comma + 1) : out, mediaType: 'image/jpeg' };
  } catch {
    return fileToBase64(file);
  }
}

/** Turn a file into an upload payload — images are downscaled, PDFs pass through. */
async function fileToPayload(file: File): Promise<{ base64: string; mediaType: string }> {
  return file.type.startsWith('image/') ? imageToScaledBase64(file) : fileToBase64(file);
}

const MAX_ORDER_BYTES = 13 * 1024 * 1024;
// PDFs are sent base64-in-JSON to the ingest route; Vercel rejects request bodies over
// 4.5MB at the edge BEFORE the handler runs, and base64 inflates by ~33%, so a PDF above
// ~3.3MiB would fail as an opaque 413. Cap it client-side with a clear message. (Images
// are downscaled to a small JPEG before send, so the 13MB gate is fine for them.)
const MAX_PDF_BYTES = 3 * 1024 * 1024;
/** How many order files we'll read from a single drop/selection. */
const MAX_ORDER_FILES = 8;

/** Mirrors the server's order-intent detector so a natural-language "create an
 *  order for …" also enters order-building mode on the client. */
const CREATE_ORDER_RE =
  /\b(create|creating|make|making|start|place|build|draft|new|set up|put together|prepare)\b[\s\S]{0,24}\border\b|\border\s+for\b/i;

/** A "/customer" token being typed at the END of the composer — works mid-message
 *  (e.g. "create an order for /bak"), not just when the input starts with "/". */
const SLASH_TOKEN_RE = /(^|\s)\/([^\s/]*)$/;

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
interface IngestResult {
  documentId: string;
  documentType: string;
  customerName?: string | null;
  supplier?: string | null;
  itemCount?: number;
  invoiceNumber?: string | null;
  orderId?: string | null;
  needsReview?: boolean;
}

interface OrderSlot {
  id: string;
  filename: string;
  status: 'parsing' | 'done' | 'error';
  order?: ParsedOrder;
  /** An uploaded doc that was filed into Doc-U (+ invoiced, for orders). */
  ingest?: IngestResult;
  error?: string;
  /** Card heading — "Parsed order" for files, "Order draft" for workflow drafts. */
  label?: string;
}

/** A file the user attached but hasn't sent yet — shown as a chip in the composer
 *  and only read when they hit send (with any typed text as the note). */
interface PendingAtt {
  id: string;
  name: string;
  base64: string;
  mediaType: string;
  isImage: boolean;
  /** Data URL for the chip thumbnail (images only). */
  previewUrl?: string;
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

interface OrderDraftEvent {
  customerName?: string | null;
  items?: Array<{ name: string; qty: number; unit_price: number }>;
}

/** Parse an SSE `data:` payload line into our event shape. */
function parseSse(
  line: string,
): { text?: string; tool?: string; done?: boolean; error?: string; orderDraft?: OrderDraftEvent } | null {
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

  // Order-parsing — attachments wait as chips in the composer and are read on
  // send (with the typed text as the note); each yields a parsed-order card.
  const [slots, setSlots] = useState<OrderSlot[]>([]);
  const [pending, setPending] = useState<PendingAtt[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // "/" order-workflow customer picker.
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }> | null>(null);
  const [customerMenu, setCustomerMenu] = useState(false);
  // We're actively building an order — armed by the "/" picker or an order-looking
  // message, and kept ON across the whole exchange (including any clarifying
  // question the model asks) so follow-up replies stay on the workflow tier. It's
  // reset when a draft arrives or the modal closes.
  const [orderMode, setOrderMode] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slotSeq = useRef(0);
  const customersLoading = useRef(false);

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

  // Abort any in-flight stream when the modal closes, and drop order-building
  // state so a fresh open never carries a stale workflow arm onto an unrelated
  // question.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setOrderMode(false);
      setCustomerMenu(false);
      setPending([]);
      setAttachError(null);
    }
  }, [open]);

  // Also abort if the component unmounts mid-stream (e.g. route change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the transcript pinned to the bottom as content grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText, streaming, slots]);

  // File one attachment into Doc-U: classify it, save it, and (for orders) build
  // the OrderFlow order — auto-invoicing when confident, else holding a draft to
  // review. The typed text rides along as a note that guides the order reader.
  const ingestPayload = useCallback(
    async (att: { base64: string; mediaType: string; name: string }, id: string, note?: string) => {
      const fail = (msg: string) =>
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'error', error: msg } : s)));
      try {
        const res = await fetch('/api/ai/agent/ingest-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: att.base64, mediaType: att.mediaType, filename: att.name, note }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          documentId?: string;
          documentType?: string;
          customerName?: string | null;
          supplier?: string | null;
          itemCount?: number;
          orderSync?: { orderId?: string; invoice_number?: string | null; needsCustomerReview?: boolean } | null;
        };
        if (!res.ok || !data.documentId) {
          fail(data.error ?? `Could not file the document (${res.status}).`);
          return;
        }
        const sync = data.orderSync ?? undefined;
        const ingest: IngestResult = {
          documentId: data.documentId,
          documentType: data.documentType ?? 'document',
          customerName: data.customerName ?? null,
          supplier: data.supplier ?? null,
          itemCount: data.itemCount,
          invoiceNumber: sync?.invoice_number ?? null,
          orderId: sync?.orderId ?? null,
          // Raw flag from the sync — the card derives invoiced / draft / failed
          // from orderId + invoiceNumber + this.
          needsReview: !!sync?.needsCustomerReview,
        };
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'done', ingest, filename: att.name } : s)));
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Could not file the document.');
      }
    },
    [],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (streaming) return;

    // Attach, type, send: if files are waiting, read them now (deferred from
    // attach time) using any typed text as the note that guides the reading.
    if (pending.length) {
      const atts = pending;
      // A typed note guides the reading of ONE doc. With several files it's
      // ambiguous (which customer is it for?), so we don't broadcast it across
      // the batch — that would mis-attribute every order to one customer.
      const note = atts.length === 1 ? text || undefined : undefined;
      setInput('');
      setPending([]);
      setAttachError(null);
      setCustomerMenu(false);
      const newSlots: OrderSlot[] = atts.map((a) => ({ id: `slot_${slotSeq.current++}`, filename: a.name, status: 'parsing' }));
      setSlots((prev) => [...prev, ...newSlots]);
      // Sequential, not concurrent: each file's create-on-upload (a new customer
      // or product) must commit before the next runs, so a batch that's several
      // pages of ONE new customer's order doesn't race into duplicate customer /
      // order / invoice rows.
      for (let i = 0; i < atts.length; i++) {
        const a = atts[i];
        await ingestPayload({ base64: a.base64, mediaType: a.mediaType, name: a.name }, newSlots[i].id, note);
      }
      return;
    }
    if (!text) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setCustomerMenu(false);
    setError(null);
    setStreaming(true);
    setStreamText('');
    setStreamStatus(null);

    // Stay in the order workflow for the whole exchange: once armed (via "/" or
    // an order-looking message) every turn routes to the workflow tier until a
    // draft arrives or the modal closes — so the model's clarifying follow-ups
    // aren't dropped back to the Q&A tier.
    const isOrderText = CREATE_ORDER_RE.test(text);
    const workflow = orderMode || isOrderText;
    if (isOrderText && !orderMode) setOrderMode(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, module, orgName, workflow }),
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
          else if (evt.orderDraft) {
            const draft = evt.orderDraft;
            const items = Array.isArray(draft.items) ? draft.items : [];
            setSlots((prev) => [
              ...prev,
              {
                id: `draft_${slotSeq.current++}`,
                filename: '',
                label: 'Order draft',
                status: 'done',
                order: { customerName: draft.customerName ?? null, items },
              },
            ]);
            // Order built — leave workflow mode so later questions run on Q&A tier.
            setOrderMode(false);
          } else if (evt.tool) setStreamStatus(evt.tool);
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
  }, [input, streaming, messages, module, orgName, orderMode, pending, ingestPayload]);

  // Attach one or more dropped/selected files: validate + downscale images, and
  // hold them as chips in the composer. They are NOT read until the user sends —
  // so they can type instructions first (attach, type, send).
  const attachFiles = useCallback(async (fileList: File[]) => {
    const files = fileList.slice(0, MAX_ORDER_FILES);
    const errs: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const okType = file.type === 'application/pdf' || isImage;
      if (!okType) {
        errs.push(`${file.name}: not a PDF or image.`);
        continue;
      }
      const cap = isImage ? MAX_ORDER_BYTES : MAX_PDF_BYTES;
      if (file.size > cap) {
        errs.push(`${file.name}: too large (max ${isImage ? '~13MB' : '3MB for PDFs'}).`);
        continue;
      }
      accepted.push(file);
    }
    if (fileList.length > MAX_ORDER_FILES) errs.push(`Only the first ${MAX_ORDER_FILES} files were added.`);
    setAttachError(errs.length ? errs.join(' ') : null);
    if (!accepted.length) return;
    const added = await Promise.all(
      accepted.map(async (file): Promise<PendingAtt> => {
        const { base64, mediaType } = await fileToPayload(file);
        const isImage = file.type.startsWith('image/');
        return {
          id: `att_${slotSeq.current++}`,
          name: file.name,
          base64,
          mediaType,
          isImage,
          previewUrl: isImage ? `data:${mediaType};base64,${base64}` : undefined,
        };
      }),
    );
    setPending((prev) => [...prev, ...added].slice(0, MAX_ORDER_FILES));
  }, []);

  const removePending = (id: string) => setPending((prev) => prev.filter((p) => p.id !== id));

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

  // Lazily load the customer list for the "/" order picker (id + name only).
  // Guarded so rapid keystrokes before the first response don't fire duplicates.
  const ensureCustomers = useCallback(async () => {
    if (customers || customersLoading.current) return;
    customersLoading.current = true;
    try {
      const res = await fetch('/api/ai/agent/customers');
      const data = (await res.json().catch(() => ({}))) as { customers?: Array<{ id: string; name: string }> };
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch {
      setCustomers([]);
    } finally {
      customersLoading.current = false;
    }
  }, [customers]);

  // The user picked a customer from the "/" menu. If they were only typing "/"
  // (nothing before it) prefill the friendly full prompt; if they typed it
  // mid-message ("… for /bak") just swap the token for the name. Either way enter
  // order mode so the reply builds a draft order.
  function pickWorkflowCustomer(name: string) {
    setInput((prev) => {
      const m = SLASH_TOKEN_RE.exec(prev);
      if (m) {
        const start = m.index + m[1].length; // index of the "/"
        const before = prev.slice(0, start);
        return before.trim() === '' ? `Create an order for ${name}: ` : `${before}${name} `;
      }
      return `Create an order for ${name}: `;
    });
    setOrderMode(true);
    setCustomerMenu(false);
    inputRef.current?.focus();
  }

  // Customers matching the "/token" being typed (anywhere in the message).
  const slashMatch = SLASH_TOKEN_RE.exec(input);
  const customerQuery = slashMatch ? slashMatch[2].trim().toLowerCase() : '';
  const customerMatches = customerMenu
    ? (customers ?? []).filter((c) => !customerQuery || c.name.toLowerCase().includes(customerQuery)).slice(0, 6)
    : [];

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
          if (files.length) void attachFiles(files);
        }}
        className="relative flex h-[560px] max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-[#E7E7E2] bg-white shadow-[0_30px_80px_-24px_rgba(15,23,32,0.55)]"
      >
        {dragOver ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-[#3E8FE0] bg-[#F2F8FE]/85 backdrop-blur-[1px]">
            <span className="text-[14px] font-semibold text-[#12324F]">Drop a document to attach it</span>
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
              <p className="mt-4 max-w-[320px] text-[14px] leading-5 text-[#5F6368]">
                Ask me how to do anything in this module, or about your live numbers, orders and customers. You can also
                attach a document (📎) — an order, invoice or statement — add a note, and send: I'll file it in Doc-U and
                invoice orders automatically
                {module === 'orderflow' ? ', or type / to build an order for a customer' : ''}.
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
                    <span className="truncate text-[12px] text-[#5F6368]">Reading &amp; filing {slot.filename}…</span>
                  </div>
                ) : slot.status === 'error' ? (
                  <p key={slot.id} className="px-1 text-[12px] text-[#A32D2D]">
                    {slot.filename}: {slot.error}
                  </p>
                ) : slot.ingest ? (
                  <IngestResultCard
                    key={slot.id}
                    result={slot.ingest}
                    filename={slot.filename}
                    onOpenOrder={(orderId) => {
                      router.push(`/app/orderflow/orders/${orderId}`);
                      onClose();
                    }}
                    onOpenDoc={(docId) => {
                      router.push(`/app/docu/${docId}`);
                      onClose();
                    }}
                    onDismiss={() => dismissSlot(slot.id)}
                  />
                ) : slot.order ? (
                  <ParsedOrderCard
                    key={slot.id}
                    order={slot.order}
                    label={slot.label}
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
          {customerMenu ? (
            <div className="mb-2 max-h-44 overflow-y-auto rounded-xl border border-[#D7DAD8] bg-white py-1 shadow-[0_12px_30px_-12px_rgba(15,23,32,0.3)]">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#9A9DA1]">
                Create an order for…
              </div>
              {customers === null ? (
                <div className="px-3 py-1.5 text-[12px] text-[#5F6368]">Loading customers…</div>
              ) : customerMatches.length ? (
                customerMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickWorkflowCustomer(c.name)}
                    className="block w-full truncate px-3 py-1.5 text-left text-[13px] text-[#1A1C1E] transition-colors hover:bg-[#F2F8FE]"
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-1.5 text-[12px] text-[#5F6368]">
                  {customerQuery ? `No customer matches “${customerQuery}”.` : 'No customers yet.'}
                </div>
              )}
            </div>
          ) : null}
          {attachError ? <p className="mb-1.5 px-1 text-[12px] text-[#A32D2D]">{attachError}</p> : null}
          {pending.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-[#F7FAFD] py-1 pl-1 pr-1.5"
                >
                  {p.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.previewUrl} alt="" className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-[#E7EEF6] text-[10px] font-semibold text-[#5F80A0]">
                      PDF
                    </span>
                  )}
                  <span className="max-w-[120px] truncate text-[11.5px] text-[#1A1C1E]">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[12px] text-[#9A9DA1] transition-colors hover:bg-[#E4EFFA] hover:text-[#1A1C1E]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-2xl border border-[#D7DAD8] bg-white px-3 py-2 focus-within:border-[#3E8FE0]/60">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void attachFiles(files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach order documents"
              title="Attach one or more orders"
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
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
                if (SLASH_TOKEN_RE.test(v)) {
                  setCustomerMenu(true);
                  void ensureCustomers();
                } else if (customerMenu) {
                  setCustomerMenu(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && customerMenu) {
                  e.preventDefault();
                  // Stop the window-level Escape handler from also closing the
                  // whole modal — the first Escape should only close the picker.
                  e.stopPropagation();
                  setCustomerMenu(false);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // If the "/" picker is open with matches, pick the first.
                  if (customerMenu && customerMatches.length) pickWorkflowCustomer(customerMatches[0].name);
                  else void send();
                }
              }}
              rows={1}
              placeholder={`How can I help ${orgLabel} today?`}
              className="max-h-28 flex-1 resize-none bg-transparent text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={(!input.trim() && pending.length === 0) || streaming}
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
  label,
  onOpen,
  onCopy,
  onDismiss,
}: {
  order: ParsedOrder;
  label?: string;
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
        <span>{label ?? 'Parsed order'}</span>
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

const DOC_TYPE_LABEL: Record<string, string> = {
  order: 'customer order',
  invoice: 'supplier invoice',
  statement: 'market statement',
  delivery_note: 'delivery note',
  price_list: 'price list',
};

/** Result of filing an uploaded doc into Doc-U (and, for orders, invoicing it). */
function IngestResultCard({
  result,
  filename,
  onOpenOrder,
  onOpenDoc,
  onDismiss,
}: {
  result: IngestResult;
  filename: string;
  onOpenOrder: (orderId: string) => void;
  onOpenDoc: (docId: string) => void;
  onDismiss: () => void;
}) {
  const typeLabel = DOC_TYPE_LABEL[result.documentType] ?? 'document';
  const isOrder = result.documentType === 'order';
  const orderBuilt = isOrder && !!result.orderId; // an of_orders row exists
  const invoiced = orderBuilt && !!result.invoiceNumber && !result.needsReview;
  const draftHeld = orderBuilt && !invoiced; // order exists but not invoiced yet
  const orderNotBuilt = isOrder && !orderBuilt; // sync failed / not yet an order

  return (
    <div className="rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE] p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#12324F]">
        <span className="vyso-ai-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4 4 10-11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>Filed in Doc-U</span>
        <span className="min-w-0 truncate text-[11px] font-normal text-[#5F80A0]">· {filename}</span>
      </div>

      <div className="mt-1.5 text-[12px] text-[#12324F]">
        Read as a <span className="font-medium">{typeLabel}</span>
        {result.customerName ? (
          <>
            {' '}for <span className="font-medium">{result.customerName}</span>
          </>
        ) : null}
        {result.supplier ? (
          <>
            {' '}from <span className="font-medium">{result.supplier}</span>
          </>
        ) : null}
        {typeof result.itemCount === 'number' && result.itemCount > 0
          ? ` · ${result.itemCount} line${result.itemCount === 1 ? '' : 's'}`
          : ''}
        .
      </div>

      {invoiced ? (
        <div className="mt-1.5 text-[12px] font-medium text-[#1F5FA8]">Invoice {result.invoiceNumber} created.</div>
      ) : draftHeld ? (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">Saved as a draft order — confirm the customer to invoice it.</div>
      ) : orderNotBuilt ? (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">Filed in Doc-U — open it to finish building the order.</div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {invoiced && result.orderId ? (
          <>
            <button
              type="button"
              onClick={() => onOpenOrder(result.orderId!)}
              className="vyso-ai-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
            >
              View order &amp; invoice
            </button>
            <button
              type="button"
              onClick={() => onOpenDoc(result.documentId)}
              className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F7FAFD]"
            >
              Open in Doc-U
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDoc(result.documentId)}
            className="vyso-ai-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
          >
            {draftHeld ? 'Review order' : 'Open in Doc-U'}
          </button>
        )}
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
