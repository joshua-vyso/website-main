'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  done: { bg: '#E9EFEC', fg: '#0F4C44', label: 'Filed' },
  queued: { bg: '#E6F1FB', fg: '#0C447C', label: 'Queued' },
  processing: { bg: '#E6F1FB', fg: '#0C447C', label: 'Working' },
  quarantined: { bg: '#FBEEDA', fg: '#854F0B', label: 'Held' },
  failed: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Failed' },
  ignored: { bg: '#F0F0EC', fg: '#5F6368', label: 'Ignored' },
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
  senders,
  events,
  configured,
  canManage,
}: {
  address: string | null;
  senders: IngestSender[];
  events: IngestEvent[];
  configured: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
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

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the address is selectable anyway */
    }
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
        <div className="text-[15px] font-medium text-[#1A1C1E]">Email ingestion</div>
        <p className="mt-1 text-[13px] text-[#9A9DA1]">
          Not configured yet. Set EMAIL_INGEST_DOMAIN, RESEND_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY
          to turn on forwarding.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="text-[15px] font-medium text-[#1A1C1E]">Email ingestion</div>
      <p className="mt-0.5 text-[13px] text-[#9A9DA1]">
        Forward supplier invoices and customer orders to this address and Vyso files them automatically.
      </p>

      {/* The address */}
      <div className="mt-3">
        {address ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-[#E7E7E2] bg-[#FAFAF8] px-3 py-2 text-[13px] text-[#1A1C1E]">
              {address}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className="h-9 shrink-0 rounded-lg border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {canManage ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm('Rotate the address? The old one stops working immediately.')) {
                    void post('/api/email/address', { rotate: true });
                  }
                }}
                className="h-9 shrink-0 rounded-lg px-3 text-[13px] text-[#5F6368] transition-colors hover:bg-[#FAFAF8] disabled:opacity-40"
              >
                Rotate
              </button>
            ) : null}
          </div>
        ) : canManage ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post('/api/email/address', {})}
            className="h-9 rounded-lg bg-[#1E5E54] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
          >
            {busy ? 'Creating…' : 'Create ingestion address'}
          </button>
        ) : (
          <p className="text-[13px] text-[#9A9DA1]">No address yet — an owner or admin can create one.</p>
        )}
      </div>

      {/* Senders awaiting approval */}
      {pending.length > 0 ? (
        <div className="mt-4 rounded-xl border border-[#FBEEDA] bg-[#FFFDF7] p-3">
          <div className="text-[13px] font-medium text-[#854F0B]">
            {pending.length} sender{pending.length === 1 ? '' : 's'} waiting for approval
          </div>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">
            Mail from these addresses is held, not filed. Approve one and its held mail is filed straight away.
          </p>
          <div className="mt-2 space-y-1.5">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#1A1C1E]">{s.email}</span>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'approve' })}
                      className="h-7 shrink-0 rounded-lg bg-[#1E5E54] px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'block' })}
                      className="h-7 shrink-0 rounded-lg px-2.5 text-[12px] text-[#5F6368] transition-colors hover:bg-black/[0.04] disabled:opacity-40"
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
        <div className="mt-4">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[#9A9DA1]">Approved senders</div>
          {approved.length === 0 ? (
            <p className="mt-1 text-[13px] text-[#9A9DA1]">
              None yet. Add the address your client forwards from, or approve it the first time they send.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {approved.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#E9EFEC] px-2.5 py-1 text-[12px] text-[#0F4C44]"
                >
                  {s.email}
                  {canManage ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void post('/api/email/senders', { email: s.email, action: 'block' })}
                      aria-label={`Block ${s.email}`}
                      className="text-[#0F4C44]/60 transition-colors hover:text-[#A32D2D] disabled:opacity-40"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          {canManage ? (
            <div className="mt-2 flex items-center gap-1.5">
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
                className="h-9 w-full max-w-[280px] rounded-lg border border-[#E7E7E2] bg-white px-2.5 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !newSender.trim()}
                onClick={() =>
                  void post('/api/email/senders', { email: newSender.trim(), action: 'approve' }).then((ok) => {
                    if (ok) setNewSender('');
                  })
                }
                className="h-9 shrink-0 rounded-lg border border-[#E7E7E2] bg-white px-3 text-[13px] text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/30 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ) : null}

          {blocked.length > 0 ? (
            <p className="mt-2 text-[12px] text-[#9A9DA1]">
              {blocked.length} blocked sender{blocked.length === 1 ? '' : 's'}.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Recent mail */}
      {events.length > 0 ? (
        <div className="mt-4">
          <div className="text-[12px] font-medium uppercase tracking-wide text-[#9A9DA1]">Recent mail</div>
          <div className="mt-1.5 space-y-1">
            {events.map((e) => {
              const style = STATUS_STYLE[e.status] ?? STATUS_STYLE.ignored;
              return (
                <div key={e.id} className="rounded-lg px-2 py-1.5 hover:bg-[#FAFAF8]">
                  <div className="flex items-center gap-2">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: style.bg, color: style.fg }}
                    >
                      {style.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#1A1C1E]">
                      {e.subject || '(no subject)'}
                      <span className="text-[#9A9DA1]"> — {e.from_email}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-[#9A9DA1]">
                      {e.documents_created > 0
                        ? `${e.documents_created} doc${e.documents_created === 1 ? '' : 's'}`
                        : '—'}
                    </span>
                    {canManage && e.status !== 'done' && e.status !== 'processing' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void post('/api/email/retry', { id: e.id })}
                        className="shrink-0 rounded-lg px-2 py-0.5 text-[12px] text-[#5F6368] transition-colors hover:bg-black/[0.05] disabled:opacity-40"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                  {/* Show the reason. "see error" told you nothing. */}
                  {e.error ? (
                    <p className="mt-0.5 pl-1 text-[12px] leading-snug text-[#A32D2D]">{e.error}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[13px] text-[#A32D2D]">{error}</p> : null}
    </div>
  );
}
