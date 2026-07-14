'use client';

/**
 * Website quote requests — the lead inbox that sits above the quotes list.
 *
 * These arrive by email from the public contact form, so EVERY field here was typed
 * by an anonymous stranger. The UI treats them as claims, not facts:
 *
 *  - Nothing is linked to a real customer. "Woolworths" in a contact form is a name
 *    someone typed, and auto-matching it to the Woolworths on your books would let
 *    anyone on the internet attach themselves to a real account.
 *  - Nothing is priced. Drafting the quote is a human act, and that is when a QTE-
 *    number is finally allocated — so spam can never punch holes in your numbering.
 *
 * Values are rendered as text (React escapes them); none of this is ever injected as
 * HTML or handed to a tool.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { quoteRequestWho, type OfQuoteRequest } from '@/lib/platform/orderflow';
import { useToast } from './ui';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function QuoteRequests({ requests, total }: { requests: OfQuoteRequest[]; total: number }) {
  const router = useRouter();
  const { node: toastNode, show: toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // The server already filters to 'new' — no client-side filter, because it used to
  // shrink an already-truncated page and hide leads that were neither quoted nor
  // dismissed, just pushed out of the window by newer ones.
  const open = requests;
  if (open.length === 0) return null;

  const hidden = Math.max(0, total - open.length);

  async function dismiss(id: string, who: string) {
    // Dismissed leads are not shown again anywhere, and Dismiss sits right next to the
    // primary "Draft a quote" action — a stray click would bin a real lead irreversibly.
    if (!confirm(`Dismiss the enquiry from ${who}? It won't show here again.`)) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(id);
    // RLS scopes this to the caller's org; the id came from a row we just rendered.
    const { error } = await supabase
      .from('of_quote_requests')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', id);
    setBusy(null);
    if (error) {
      toast('Could not dismiss that.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-[#FBEEDA] bg-[#FFFDF7] p-4">
      {toastNode}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-medium text-[#1A1C1E]">
            {total} quote request{total === 1 ? '' : 's'}
          </div>
          <p className="mt-0.5 text-[13px] text-[#9A9DA1]">
            From the website contact form. Nothing is priced or linked to a customer until you draft the quote.
            {/* Say so when the list is truncated. A silently capped list reads as
                "that's all of them" — which is how a real lead gets lost. */}
            {hidden > 0 ? ` Showing the newest ${open.length}; ${hidden} more are waiting.` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {open.map((r) => {
          const isOpen = expanded === r.id;
          const items = Array.isArray(r.requested_items) ? r.requested_items : [];
          return (
            <div key={r.id} className="rounded-xl border border-[#F0E4CB] bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] text-[#1A1C1E]"
                >
                  <span className="font-medium">{quoteRequestWho(r)}</span>
                  {r.business_name && r.business_name !== quoteRequestWho(r) ? (
                    <span className="text-[#5F6368]"> · {r.business_name}</span>
                  ) : null}
                  {r.message ? <span className="text-[#9A9DA1]"> — {r.message}</span> : null}
                </button>

                <span className="shrink-0 text-[12px] text-[#9A9DA1]">{fmtWhen(r.received_at)}</span>

                <Link
                  href={`/app/orderflow/quotes/new?request=${r.id}`}
                  className="shrink-0 rounded-lg bg-[#1E5E54] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45]"
                >
                  Draft a quote
                </Link>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void dismiss(r.id, quoteRequestWho(r))}
                  className="shrink-0 rounded-lg px-2 py-1 text-[12px] text-[#5F6368] transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>

              {isOpen ? (
                <div className="mt-2 space-y-2 border-t border-[#F3F3EF] pt-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5F6368]">
                    {r.contact_email ? <span>{r.contact_email}</span> : null}
                    {r.contact_phone ? <span>{r.contact_phone}</span> : null}
                    {r.from_email ? <span className="text-[#9A9DA1]">via {r.from_email}</span> : null}
                  </div>

                  {r.message ? (
                    <p className="whitespace-pre-wrap text-[13px] leading-snug text-[#1A1C1E]">{r.message}</p>
                  ) : null}

                  {items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((it, i) => (
                        <span
                          key={`${r.id}_${i}`}
                          className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[12px] text-[#1A1C1E]"
                        >
                          {[it.quantity, it.unit, it.description].filter(Boolean).join(' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-[11px] text-[#9A9DA1]">
                    Typed into a public form — treat the name and company as unverified.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
