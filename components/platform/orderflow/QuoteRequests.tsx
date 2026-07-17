'use client';

/**
 * Website quote requests — the lead inbox that sits above the quotes list.
 *
 * EVERY quote-lane email lands here for a HUMAN to triage. Nothing is filtered out on
 * the way in: the AI's guess that something is a bounce/auto-reply/spam is shown as a
 * flag (the muted "Likely spam" group), never used to hide mail. A person decides.
 *
 * These arrive from a public contact form, so every field was typed by an anonymous
 * stranger. The UI treats them as claims, not facts:
 *  - Nothing is linked to a real customer until a human drafts the quote.
 *  - Nothing is priced, and the QTE- number is allocated only when the quote is drafted,
 *    so spam can never punch holes in your numbering.
 *
 * Values are rendered as text (React escapes them); none of this is ever injected as
 * HTML or handed to a tool.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
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
  useRealtimeRefresh('of_quote_requests');
  const { node: toastNode, show: toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSpam, setShowSpam] = useState(false);

  // Server already filters to 'new'. Split real leads from the AI-flagged likely-spam so
  // the real ones stay prominent and the noise is tucked away but still reachable.
  const leads = requests.filter((r) => !r.flagged_spam);
  const spam = requests.filter((r) => r.flagged_spam);
  if (requests.length === 0) return null;

  const hidden = Math.max(0, total - requests.length);

  async function act(id: string, patch: Record<string, unknown>) {
    const supabase = createClient();
    if (!supabase) return false;
    setBusy(id);
    // RLS scopes this to the caller's org; the id came from a row we just rendered.
    const { error } = await supabase
      .from('of_quote_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    setBusy(null);
    if (error) {
      toast('Could not update that.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function dismiss(id: string, who: string) {
    // Dismiss sits next to "Draft a quote" and a dismissed lead isn't shown again — a
    // stray click would bin a real enquiry, so confirm first.
    if (!confirm(`Dismiss the enquiry from ${who}? It won't show here again.`)) return;
    await act(id, { status: 'dismissed' });
  }

  function Row({ r }: { r: OfQuoteRequest }) {
    const isOpen = expanded === r.id;
    const items = Array.isArray(r.requested_items) ? r.requested_items : [];
    const who = quoteRequestWho(r);
    return (
      <div className="rounded-xl border border-[#F0E4CB] bg-white px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => setExpanded(isOpen ? null : r.id)}
            className="min-w-0 flex-1 truncate text-left text-[13px] text-[#1A1C1E]"
          >
            <span className="font-medium">{who}</span>
            {r.business_name && r.business_name !== who ? (
              <span className="text-[#5F6368]"> · {r.business_name}</span>
            ) : null}
            {r.message ? <span className="text-[#9A9DA1]"> — {r.message}</span> : null}
          </button>

          <span className="shrink-0 text-[12px] text-[#9A9DA1]">{fmtWhen(r.received_at)}</span>

          {/* A flagged row can be un-flagged in one click if the human disagrees — it
              then joins the real leads. Human decides, not the model. */}
          {r.flagged_spam ? (
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => void act(r.id, { flagged_spam: false })}
              className="shrink-0 rounded-lg border border-[#E7E7E2] bg-white px-2.5 py-1 text-[12px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30 disabled:opacity-40"
            >
              Not spam
            </button>
          ) : (
            <Link
              href={`/app/orderflow/quotes/new?request=${r.id}`}
              className="shrink-0 rounded-lg bg-[#1E5E54] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45]"
            >
              Draft a quote
            </Link>
          )}
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => void dismiss(r.id, who)}
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
                  <span key={`${r.id}_${i}`} className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[12px] text-[#1A1C1E]">
                    {[it.quantity, it.unit, it.description].filter(Boolean).join(' ')}
                  </span>
                ))}
              </div>
            ) : null}

            {/* For a flagged row, offer the draft action here too once it's expanded. */}
            {r.flagged_spam ? (
              <Link href={`/app/orderflow/quotes/new?request=${r.id}`} className="inline-block text-[12px] font-medium text-[#1E5E54] hover:underline">
                Draft a quote from this anyway →
              </Link>
            ) : null}

            <p className="text-[11px] text-[#9A9DA1]">Typed into a public form — treat the name and company as unverified.</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#FBEEDA] bg-[#FFFDF7] p-4">
      {toastNode}

      <div>
        <div className="text-[15px] font-medium text-[#1A1C1E]">
          {leads.length} quote request{leads.length === 1 ? '' : 's'} to review
        </div>
        <p className="mt-0.5 text-[13px] text-[#9A9DA1]">
          From the website contact form. Nothing is priced or linked to a customer until you draft the quote.
          {hidden > 0 ? ` Showing the newest ${requests.length}; ${hidden} more are waiting.` : ''}
        </p>
      </div>

      {leads.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {leads.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[#9A9DA1]">
          No un-flagged enquiries right now{spam.length > 0 ? ' — the rest are flagged as likely spam below.' : '.'}
        </p>
      )}

      {/* Likely-spam, tucked away but never hidden: a human can open it, un-flag anything
          the model got wrong, or dismiss the genuine junk. */}
      {spam.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowSpam((s) => !s)}
            className="text-[12px] font-medium text-[#9A9DA1] transition-colors hover:text-[#5F6368]"
          >
            {showSpam ? '▾' : '▸'} Likely spam ({spam.length})
          </button>
          {showSpam ? (
            <div className="mt-1.5 space-y-1.5 opacity-90">
              {spam.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
