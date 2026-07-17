'use client';

/**
 * The Doc-U review queue: email-ingested documents extracted but NOT yet committed.
 *
 * Save runs the document's side effects — an order becomes an OrderFlow order/invoice,
 * an invoice/statement/delivery-note feeds ProcurePulse stock + supplier prices — and
 * marks it approved. Discard rejects it. Nothing here has touched stock or money yet,
 * which is the whole point: the human is the commit gate.
 *
 * All extracted values were read off a forwarded document — shown as text (React
 * escapes them), never rendered as HTML or handed to a tool.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import type { DocumentWithSupplier, ExtractedLineItem } from '@/lib/platform/types';

const TYPE_LABEL: Record<string, string> = {
  invoice: 'Invoice',
  statement: 'Statement',
  delivery_note: 'Delivery note',
  price_list: 'Price list',
  order: 'Order',
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function lineLabel(it: ExtractedLineItem): string {
  return [it.quantity, it.unit, it.description].filter(Boolean).join(' ') || it.description || '—';
}

export function DocumentReviewQueue({ docs, canReview }: { docs: DocumentWithSupplier[]; canReview: boolean }) {
  const router = useRouter();
  // A forwarded document now appears the moment it's extracted — no manual refresh.
  useRealtimeRefresh('documents');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Drop rows locally the instant they're actioned so a slow refresh doesn't let a
  // second click hit the same document.
  const [done, setDone] = useState<Set<string>>(new Set());

  const visible = docs.filter((d) => !done.has(d.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
        <p className="text-[15px] font-medium text-[#1A1C1E]">Nothing to review</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">
          Forwarded documents land here for a quick check before they update your stock and orders.
        </p>
      </div>
    );
  }

  async function act(id: string, action: 'save' | 'discard') {
    if (action === 'discard' && !confirm('Discard this document? It won’t update anything and leaves the queue.')) {
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const res = await fetch('/api/docu/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.');
        return;
      }
      setDone((prev) => new Set(prev).add(id));
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-[13px] text-[#A32D2D]">{error}</p> : null}

      {visible.map((d) => {
        const isOpen = expanded === d.id;
        const data = d.extracted_data;
        const items = (data?.line_items ?? []) as ExtractedLineItem[];
        const who = d.supplier?.name || data?.supplier || data?.customer_name || null;
        const typeLabel = d.document_type ? TYPE_LABEL[d.document_type] ?? d.document_type : 'Document';

        return (
          <div key={d.id} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="flex flex-wrap items-start gap-3">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[11px] font-medium text-[#5F6368]">
                    {typeLabel}
                  </span>
                  <span className="truncate text-[14px] font-medium text-[#1A1C1E]">{d.filename}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-[#9A9DA1]">
                  {who ? <span className="text-[#5F6368]">{who}</span> : null}
                  <span>{fmtWhen(d.created_at)}</span>
                  {items.length > 0 ? <span>{items.length} line{items.length === 1 ? '' : 's'}</span> : null}
                  {typeof d.confidence === 'number' ? <span>{d.confidence}% confident</span> : null}
                </div>
              </button>

              {canReview ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => void act(d.id, 'save')}
                    className="h-9 rounded-lg bg-[#1E5E54] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                  >
                    {busy === d.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => void act(d.id, 'discard')}
                    className="h-9 rounded-lg px-3 text-[13px] text-[#5F6368] transition-colors hover:bg-[#FAFAF8] disabled:opacity-40"
                  >
                    Discard
                  </button>
                </div>
              ) : (
                <span className="shrink-0 self-center text-[12px] text-[#9A9DA1]">Owner/admin reviews</span>
              )}
            </div>

            {isOpen ? (
              <div className="mt-3 space-y-3 border-t border-[#F3F3EF] pt-3">
                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                          <th className="pb-1.5 pr-3 font-medium">Item</th>
                          <th className="pb-1.5 pr-3 font-medium">Unit price</th>
                          <th className="pb-1.5 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.slice(0, 100).map((it, i) => (
                          <tr key={i} className="border-t border-[#F3F3EF]">
                            <td className="py-1.5 pr-3 text-[#1A1C1E]">{lineLabel(it)}</td>
                            <td className="py-1.5 pr-3 text-[#5F6368]">{it.unit_price || '—'}</td>
                            <td className="py-1.5 text-[#5F6368]">{it.amount || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[13px] text-[#9A9DA1]">No line items were read from this document.</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-[12px]">
                  <Link href={`/app/docu/${d.id}`} className="font-medium text-[#1E5E54] hover:underline">
                    Open full document →
                  </Link>
                  <span className="text-[#9A9DA1]">
                    Saving {d.document_type === 'order' ? 'creates the OrderFlow order' : 'updates stock and supplier prices'}.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
