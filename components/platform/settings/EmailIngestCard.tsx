'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';

export interface IngestSender {
  id: string;
  email: string;
  status: string;
}

export interface IngestEvent {
  id: string;
  from_email: string;
  subject: string | null;
  status: string;
  documents_created: number;
  error: string | null;
  created_at: string;
  /** Which lane it arrived on: null/'documents' or 'quotes'. */
  tag: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  done: { bg: '#E7EEF8', fg: '#174C87', label: 'Filed' },
  queued: { bg: '#E6F1FB', fg: '#0C447C', label: 'Queued' },
  processing: { bg: '#E6F1FB', fg: '#0C447C', label: 'Working' },
  quarantined: { bg: '#FBEEDA', fg: '#854F0B', label: 'Held' },
  failed: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Failed' },
  ignored: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Ignored' },
};

/**
 * Email ingestion — the org's forwarding address, who's allowed to send to it,
 * and what has arrived.
 *
 * Approving a sender is a real security decision (it lets their attachments become
 * invoices), so unknown senders are held until someone approves them here.
 */
export function EmailIngestCard({
  address,
  quotesAddress,
  senders,
  events,
  configured,
  canManage,
}: {
  address: string | null;
  /** The org's SEPARATE enquiry address (its own secret, not derived from `address`). */
  quotesAddress?: string | null;
  senders: IngestSender[];
  events: IngestEvent[];
  configured: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  useRealtimeRefresh('email_ingests');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSender, setNewSender] = useState('');

  const pending = senders.filter((s) => s.status === 'pending');
  const approved = senders.filter((s) => s.status === 'approved');
  const blocked = senders.filter((s) => s.status === 'blocked');

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable — the address is selectable anyway */
    }
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="of-display text-[16px] font-semibold text-[#171A17]">Email ingestion</div>
        <p className="mt-1 text-[13px] text-[#6B6F68]">
          Not configured yet. Set EMAIL_INGEST_DOMAIN, RESEND_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY
          to turn on forwarding.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="of-display text-[16px] font-semibold text-[#171A17]">Email ingestion</div>
      <p className="mt-1 text-[13px] text-[#6B6F68]">
        Forward supplier invoices and customer orders to this address and Vyso files them automatically.
      </p>

      {/* Two SEPARATE addresses, each its own secret, with deliberately different trust
          models (documents need an approved sender; enquiries come from strangers by
          definition). They are kept apart so publishing the enquiry address — which
          rides in every website form submission — never exposes the document one. */}
      <div className="mt-4">
        {address ? (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
                Documents — invoices, delivery notes
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-[11px] border border-[#E4E9F0] bg-[#F5F9FE] px-3.5 py-[11px] text-[13px] text-[#171A17]">
                  {address}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(address)}
                  className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
                >
                  {copied === address ? 'Copied' : 'Copy'}
                </button>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          'Rotate the document address? Every supplier forwarding invoices to the old one will stop reaching you until you give them the new one.',
                        )
                      ) {
                        void post('/api/email/address', { purpose: 'documents', rotate: true });
                      }
                    }}
                    className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] px-[14px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
                  >
                    Rotate
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] text-[#A0A49C]">
                Attachments only, and only from an approved sender.
              </p>
            </div>

            {/* A SEPARATE secret. This one gets pasted into a website form vendor's
                config and rides in the To: header of every enquiry, so it leaks by
                design — which is exactly why it must not be derived from the address
                above. Rotating it doesn't touch your suppliers. */}
            <div>
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
                Website enquiries — quote requests
              </div>
              {quotesAddress ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-[11px] border border-[#E4E9F0] bg-[#F5F9FE] px-3.5 py-[11px] text-[13px] text-[#171A17]">
                      {quotesAddress}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(quotesAddress)}
                      className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
                    >
                      {copied === quotesAddress ? 'Copied' : 'Copy'}
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm('Rotate the enquiry address? Update your website form afterwards. Your suppliers are unaffected.')) {
                            void post('/api/email/address', { purpose: 'quotes', rotate: true });
                          }
                        }}
                        className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] px-[14px] text-[14px] font-medium text-[#6B6F68] transition-colors hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
                      >
                        Rotate
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#A0A49C]">
                    Send your website&apos;s contact form here. No sender approval — enquiries come from the public — so
                    they land on the Quotes page to triage, capped at 100/day, and nothing is priced automatically.
                  </p>
                </>
              ) : canManage ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post('/api/email/address', { purpose: 'quotes' })}
                    className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
                  >
                    {busy ? 'Creating…' : 'Create enquiry address'}
                  </button>
                  <p className="mt-1.5 text-[12px] text-[#A0A49C]">
                    A separate address for your website&apos;s contact form. Kept apart from the document address so
                    publishing one never exposes the other.
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-[#6B6F68]">None yet — an owner or admin can create one.</p>
              )}
            </div>
          </div>
        ) : canManage ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post('/api/email/address', { purpose: 'documents' })}
            className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
          >
            {busy ? 'Creating…' : 'Create ingestion address'}
          </button>
        ) : (
          <p className="text-[13px] text-[#6B6F68]">No address yet — an owner or admin can create one.</p>
        )}
      </div>

      {/* Senders awaiting approval */}
      {pending.length > 0 ? (
        <div className="mt-5 rounded-[14px] border border-[#FBEEDA] bg-[#FFFDF7] p-4">
          <div className="text-[13px] font-semibold text-[#854F0B]">
            <span className="of-num">{pending.length}</span> sender{pending.length === 1 ? '' : 's'} waiting for approval
          </div>
          <p className="mt-1 text-[12px] text-[#8A8E86]">
            Mail from these addresses is held, not filed. Approve one and its held mail is filed straight away.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] text-[#171A17]">{s.email}</span>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'approve' })}
                      className="inline-flex h-8 shrink-0 items-center rounded-[9px] bg-[#1F5FA8] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'block' })}
                      className="inline-flex h-8 shrink-0 items-center rounded-[9px] px-3 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                    >
                      Block
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Approved senders + add */}
      {address ? (
        <div className="mt-5">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Approved senders</div>
          {approved.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[#6B6F68]">
              None yet. Add the address your client forwards from, or approve it the first time they send.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {approved.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#E7EEF8] px-2.5 py-1 text-[12px] font-medium text-[#174C87]"
                >
                  {s.email}
                  {canManage ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'block' })}
                      aria-label={`Block ${s.email}`}
                      className="text-[#174C87]/60 transition-colors hover:text-[#A32D2D] disabled:opacity-40"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          {canManage ? (
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="email"
                value={newSender}
                onChange={(e) => setNewSender(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSender.trim()) {
                    void post('/api/email/senders', { email: newSender.trim(), action: 'approve' }).then((ok) => {
                      if (ok) setNewSender('');
                    });
                  }
                }}
                placeholder="Approve a sender by email…"
                className="h-11 w-full max-w-[300px] rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
              />
              <button
                type="button"
                disabled={busy || !newSender.trim()}
                onClick={() =>
                  void post('/api/email/senders', { email: newSender.trim(), action: 'approve' }).then((ok) => {
                    if (ok) setNewSender('');
                  })
                }
                className="inline-flex h-11 shrink-0 items-center rounded-[12px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ) : null}

          {blocked.length > 0 ? (
            <p className="mt-2.5 text-[12px] text-[#A0A49C]">
              <span className="of-num">{blocked.length}</span> blocked sender{blocked.length === 1 ? '' : 's'}.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Recent mail */}
      {events.length > 0 ? (
        <div className="mt-5">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Recent mail</div>
          <div className="mt-2 space-y-1">
            {events.map((e) => {
              const style = STATUS_STYLE[e.status] ?? STATUS_STYLE.ignored;
              return (
                <div key={e.id} className="rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[#F5F9FE]">
                  <div className="flex items-center gap-2">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: style.bg, color: style.fg }}
                    >
                      {style.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[#171A17]">
                      {e.subject || '(no subject)'}
                      <span className="text-[#8A8E86]"> — {e.from_email}</span>
                    </span>
                    <span className="of-num shrink-0 text-[12px] text-[#A0A49C]">
                      {e.documents_created === 0
                        ? '—'
                        : e.tag === 'quotes'
                          ? 'enquiry'
                          : `${e.documents_created} doc${e.documents_created === 1 ? '' : 's'}`}
                    </span>
                    {canManage && e.status !== 'done' && e.status !== 'processing' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void post('/api/email/retry', { id: e.id })}
                        className="inline-flex h-8 shrink-0 items-center rounded-[9px] px-3 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-black/[0.05] disabled:opacity-40"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                  {/* Show the reason. "see error" told you nothing. */}
                  {e.error ? (
                    <p className="mt-1 pl-1 text-[12px] leading-snug text-[#A32D2D]">{e.error}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-[13px] text-[#A32D2D]">{error}</p> : null}
    </div>
  );
}
