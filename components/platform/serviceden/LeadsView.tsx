'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { Badge, Kpi } from '@/components/platform/module-ui';
import { Drawer, RowActionsMenu, useToast } from '@/components/platform/orderflow/ui';
import {
  LEAD_STAGE_META,
  LEAD_STAGES,
  type SdLead,
  type SdLeadDetail,
  type SdLeadPageData,
  type SdLeadStage,
} from '@/lib/platform/serviceden';
import { Field, Modal, ModalButtons, SdPrimary, inputClass } from './ui';

type LeadView = 'inbox' | 'pipeline' | 'followups' | 'all';

const BLANK_LEAD = { contactName: '', company: '', email: '', phone: '', notes: '' };
const CLOSED = new Set<SdLeadStage>(['won', 'lost']);

function displayDate(iso: string | null, includeTime = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function inputDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function activityAt(lead: SdLead): string | null {
  const values = [lead.lastInboundAt, lead.lastOutboundAt].filter((value): value is string => Boolean(value));
  return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function daysWaiting(lead: SdLead): number | null {
  if (!lead.lastOutboundAt) return null;
  if (lead.lastInboundAt && Date.parse(lead.lastInboundAt) > Date.parse(lead.lastOutboundAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - Date.parse(lead.lastOutboundAt)) / 86_400_000));
}

function due(lead: SdLead): boolean {
  return Boolean(
    lead.reviewStatus === 'accepted' &&
      lead.nextFollowUpAt &&
      Date.parse(lead.nextFollowUpAt) <= Date.now() &&
      !CLOSED.has(lead.stage),
  );
}

function SecondaryButton({
  onClick,
  children,
  disabled = false,
  danger = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center rounded-xl border bg-white px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border-[#F2C9C9] text-[#A32D2D] hover:bg-[#FCEBEB]'
          : 'border-[#D7DAD8] text-[#1A1C1E] hover:border-[#5B53C0]/40'
      }`}
    >
      {children}
    </button>
  );
}

export function LeadsView({
  initialData,
  orgId,
  userId,
  notice,
  initialError,
}: {
  initialData: SdLeadPageData;
  orgId: string;
  userId: string;
  notice: string | null;
  initialError: string | null;
}) {
  const router = useRouter();
  const { node, show } = useToast();
  const leads = initialData.leads;
  const [view, setView] = useState<LeadView>('inbox');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(initialError);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState(BLANK_LEAD);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SdLead | null>(null);
  const [detail, setDetail] = useState<SdLeadDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const autoSyncAttempted = useRef(false);

  useEffect(() => {
    if (notice) show(notice);
  }, [notice, show]);

  const syncGmail = useCallback(async (quiet = false) => {
    const connection = initialData.gmailConnection;
    if (!connection || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch('/api/serviceden/gmail/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        leadsCreated?: number;
        leadsUpdated?: number;
      };
      if (!response.ok) throw new Error(result.error || 'Gmail sync failed.');
      if (!quiet) {
        show(
          `${result.leadsCreated ?? 0} new lead${result.leadsCreated === 1 ? '' : 's'} · ${
            result.leadsUpdated ?? 0
          } updated`,
        );
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gmail sync failed.';
      setSyncError(message);
      if (!quiet) show(message);
    } finally {
      setSyncing(false);
    }
  }, [initialData.gmailConnection, router, show, syncing]);

  useEffect(() => {
    const connection = initialData.gmailConnection;
    if (
      autoSyncAttempted.current ||
      !initialData.schemaReady ||
      !connection ||
      connection.status !== 'connected'
    ) return;
    const stale = !connection.lastSyncedAt || Date.now() - Date.parse(connection.lastSyncedAt) > 15 * 60_000;
    if (!stale) return;
    autoSyncAttempted.current = true;
    const timer = window.setTimeout(() => void syncGmail(true), 0);
    return () => window.clearTimeout(timer);
  }, [initialData.gmailConnection, initialData.schemaReady, syncGmail]);

  const counts = useMemo(() => {
    const accepted = leads.filter((lead) => lead.reviewStatus === 'accepted' && !CLOSED.has(lead.stage));
    return {
      active: accepted.length,
      inbox: leads.filter((lead) => lead.reviewStatus === 'suggested').length,
      due: accepted.filter(due).length,
      replied: accepted.filter((lead) => Boolean(
        lead.lastInboundAt && (!lead.lastOutboundAt || Date.parse(lead.lastInboundAt) > Date.parse(lead.lastOutboundAt)),
      )).length,
    };
  }, [leads]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (view === 'inbox' && lead.reviewStatus !== 'suggested') return false;
      if (view === 'pipeline' && (lead.reviewStatus !== 'accepted' || CLOSED.has(lead.stage))) return false;
      if (view === 'followups' && !due(lead)) return false;
      if (view === 'all' && lead.reviewStatus === 'rejected' && !term) return false;
      if (!term) return true;
      return `${lead.contactName} ${lead.company ?? ''} ${lead.email} ${lead.summary ?? ''}`.toLowerCase().includes(term);
    });
  }, [leads, search, view]);

  async function patchLead(lead: SdLead, patch: Record<string, unknown>, success?: string) {
    const supabase = createClient();
    if (!supabase) return false;
    setActionBusy(true);
    const { error } = await supabase
      .from('sd_leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
      .eq('org_id', orgId)
      .eq('owner_user_id', userId);
    setActionBusy(false);
    if (error) { show(error.message); return false; }
    if (success) show(success);
    setSelected((current) => current?.id === lead.id ? { ...current, ...clientPatch(patch) } : current);
    router.refresh();
    return true;
  }

  async function acceptLead(lead: SdLead) {
    await patchLead(lead, { review_status: 'accepted' }, `${lead.contactName} added to the pipeline`);
  }

  async function rejectLead(lead: SdLead) {
    if (!confirm(`Dismiss ${lead.contactName} as a lead? The Gmail conversation will stay stored for audit, but it will leave the pipeline.`)) return;
    const ok = await patchLead(lead, { review_status: 'rejected', next_follow_up_at: null }, 'Lead dismissed');
    if (ok) { setSelected(null); setDetail(null); }
  }

  async function createManualLead() {
    const contactName = manualForm.contactName.trim();
    const email = manualForm.email.trim().toLowerCase();
    if (!contactName || !/^\S+@\S+\.\S+$/.test(email)) {
      setManualError('Add a contact name and valid email address.');
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setManualBusy(true);
    setManualError(null);
    const { data, error } = await supabase.from('sd_leads').insert({
      org_id: orgId,
      owner_user_id: userId,
      contact_name: contactName,
      company: manualForm.company.trim() || null,
      email,
      phone: manualForm.phone.trim() || null,
      notes: manualForm.notes.trim() || null,
      source: 'manual',
      stage: 'new',
      review_status: 'accepted',
    }).select('*').single();
    setManualBusy(false);
    if (error || !data) { setManualError(error?.message || 'Could not add lead.'); return; }
    setManualOpen(false);
    setManualForm(BLANK_LEAD);
    setView('pipeline');
    show(`${contactName} added`);
    router.refresh();
  }

  async function openLead(lead: SdLead) {
    setSelected(lead);
    setDetail(null);
    setDetailBusy(true);
    try {
      const response = await fetch(`/api/serviceden/leads/${encodeURIComponent(lead.id)}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => ({}))) as SdLeadDetail & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not load the conversation.');
      setDetail(result);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not load the conversation.');
    } finally {
      setDetailBusy(false);
    }
  }

  async function convertLead(lead: SdLead) {
    if (!confirm(`Convert ${lead.contactName} into a ServiceDen customer?`)) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/serviceden/leads/${encodeURIComponent(lead.id)}/convert`, { method: 'POST' });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not convert this lead.');
      show(`${lead.contactName} converted to a customer`);
      setSelected(null);
      setDetail(null);
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not convert this lead.');
    } finally {
      setActionBusy(false);
    }
  }

  async function disconnectGmail() {
    const connection = initialData.gmailConnection;
    if (!connection || !confirm(`Disconnect ${connection.emailAddress}? Imported leads remain, but automatic email updates will stop.`)) return;
    setActionBusy(true);
    try {
      const response = await fetch('/api/serviceden/gmail/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; warning?: string | null };
      if (!response.ok) throw new Error(result.error || 'Could not disconnect Gmail.');
      show(result.warning || 'Gmail disconnected');
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not disconnect Gmail.');
    } finally {
      setActionBusy(false);
    }
  }

  const selectedLive = selected ? leads.find((lead) => lead.id === selected.id) ?? selected : null;

  return (
    <div className="space-y-5">
      {node}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Active leads" value={String(counts.active)} />
        <Kpi label="To review" value={String(counts.inbox)} accent="#5B53C0" sub="detected from Gmail" />
        <Kpi label="Follow-ups due" value={String(counts.due)} accent={counts.due ? '#A32D2D' : '#0F6E56'} />
        <Kpi label="Replied" value={String(counts.replied)} accent="#0F6E56" />
      </div>

      {!initialData.schemaReady ? (
        <div className="rounded-2xl border border-[#F2C9C9] bg-[#FFF8F8] p-5">
          <p className="text-[14px] font-semibold text-[#A32D2D]">ServiceDen lead tables are not installed yet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#5F6368]">
            Re-run <code className="rounded bg-white px-1 py-0.5 text-[12px]">supabase/serviceden.sql</code> in the Supabase SQL editor before connecting Gmail.
          </p>
        </div>
      ) : (
        <GmailConnectionCard
          data={initialData}
          syncing={syncing}
          actionBusy={actionBusy}
          syncError={syncError}
          onSync={() => void syncGmail(false)}
          onDisconnect={() => void disconnectGmail()}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-[#E7E7E2] bg-white p-1">
          {([
            ['inbox', `Inbox${counts.inbox ? ` ${counts.inbox}` : ''}`],
            ['pipeline', 'Pipeline'],
            ['followups', `Follow-ups${counts.due ? ` ${counts.due}` : ''}`],
            ['all', 'All leads'],
          ] as Array<[LeadView, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                view === key ? 'bg-[#E9E6FB] text-[#4C45A6]' : 'text-[#5F6368] hover:bg-[#F6F6F2]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leads…"
            className={`${inputClass} w-[220px]`}
          />
          <SdPrimary onClick={() => { setManualError(null); setManualOpen(true); }}>+ Add lead</SdPrimary>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[#1A1C1E]">
            {view === 'inbox' ? 'No leads waiting for review' : view === 'followups' ? 'No follow-ups due' : 'No leads here yet'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">
            {view === 'inbox'
              ? 'When Gmail finds a likely Vyso sales conversation, it will appear here for your approval.'
              : view === 'followups'
                ? 'You are caught up. Replies automatically stop the follow-up clock after the next Gmail sync.'
                : 'Connect Gmail or add a lead manually to begin building the pipeline.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                  <th className="px-4 py-2.5 text-left font-medium">Contact</th>
                  <th className="px-3 py-2.5 text-left font-medium">Stage</th>
                  <th className="px-3 py-2.5 text-left font-medium">Last activity</th>
                  <th className="px-3 py-2.5 text-left font-medium">Follow-up</th>
                  <th className="px-3 py-2.5 text-left font-medium">Next action</th>
                  <th className="px-3 py-2.5 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const waiting = daysWaiting(lead);
                  const stage = LEAD_STAGE_META[lead.stage];
                  return (
                    <tr key={lead.id} className="border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void openLead(lead)} className="block text-left font-medium text-[#1A1C1E] hover:text-[#5B53C0] hover:underline">
                          {lead.contactName}
                        </button>
                        <div className="mt-0.5 text-[12px] text-[#9A9DA1]">{lead.company ? `${lead.company} · ` : ''}{lead.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        {lead.reviewStatus === 'suggested' ? <Badge label="Review" tone="warning" /> : lead.reviewStatus === 'rejected' ? <Badge label="Dismissed" /> : <Badge label={stage.label} tone={stage.tone} />}
                      </td>
                      <td className="px-3 py-3 text-[#5F6368]">
                        <div>{displayDate(activityAt(lead))}</div>
                        {waiting != null && waiting > 0 ? <div className="mt-0.5 text-[11px] text-[#9A9DA1]">waiting {waiting}d</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        {due(lead) ? <span className="font-medium text-[#A32D2D]">Due {displayDate(lead.nextFollowUpAt)}</span> : <span className="text-[#5F6368]">{displayDate(lead.nextFollowUpAt)}</span>}
                      </td>
                      <td className="max-w-[280px] px-3 py-3 text-[#5F6368]">
                        <p className="line-clamp-2">{lead.agentNextAction ?? lead.summary ?? '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {lead.reviewStatus === 'suggested' ? (
                          <div className="flex justify-end gap-1.5">
                            <button type="button" disabled={actionBusy} onClick={() => void acceptLead(lead)} className="rounded-lg bg-[#5B53C0] px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">Accept</button>
                            <button type="button" disabled={actionBusy} onClick={() => void rejectLead(lead)} className="rounded-lg px-2 py-1.5 text-[12px] text-[#5F6368] hover:bg-[#F0F0EC] disabled:opacity-50">Dismiss</button>
                          </div>
                        ) : (
                          <RowActionsMenu actions={[
                            { label: 'Open lead', onClick: () => void openLead(lead) },
                            ...(!lead.convertedCustomerId && lead.reviewStatus === 'accepted' ? [{ label: 'Convert to customer', onClick: () => void convertLead(lead) }] : []),
                            ...(lead.reviewStatus !== 'rejected' ? [{ label: 'Dismiss', onClick: () => void rejectLead(lead), danger: true }] : []),
                          ]} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Add lead"
        subtitle="A prospect you want to track in ServiceDen."
        busy={manualBusy}
        footer={<ModalButtons onCancel={() => setManualOpen(false)} onSave={() => void createManualLead()} busy={manualBusy} saveLabel="Add lead" />}
      >
        <Field label="Contact name"><input autoFocus value={manualForm.contactName} onChange={(event) => setManualForm({ ...manualForm, contactName: event.target.value })} placeholder="e.g. Greg" className={inputClass} /></Field>
        <Field label="Company" hint="(optional)"><input value={manualForm.company} onChange={(event) => setManualForm({ ...manualForm, company: event.target.value })} placeholder="e.g. Pasta Boys" className={inputClass} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email"><input type="email" value={manualForm.email} onChange={(event) => setManualForm({ ...manualForm, email: event.target.value })} placeholder="name@company.co.za" className={inputClass} /></Field>
          <Field label="Phone" hint="(optional)"><input value={manualForm.phone} onChange={(event) => setManualForm({ ...manualForm, phone: event.target.value })} className={inputClass} /></Field>
        </div>
        <Field label="Notes" hint="(optional)"><textarea value={manualForm.notes} onChange={(event) => setManualForm({ ...manualForm, notes: event.target.value })} className={`${inputClass} h-20 py-2`} /></Field>
        {manualError ? <p className="text-[12px] text-[#A32D2D]">{manualError}</p> : null}
      </Modal>

      <Drawer
        open={Boolean(selectedLive)}
        onClose={() => { setSelected(null); setDetail(null); }}
        title={selectedLive?.contactName ?? 'Lead'}
        subtitle={selectedLive ? [selectedLive.company, selectedLive.email].filter(Boolean).join(' · ') : undefined}
        width={620}
        right={selectedLive ? <Badge label={selectedLive.reviewStatus === 'suggested' ? 'Review' : LEAD_STAGE_META[selectedLive.stage].label} tone={selectedLive.reviewStatus === 'suggested' ? 'warning' : LEAD_STAGE_META[selectedLive.stage].tone} /> : null}
        footer={selectedLive ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href={`mailto:${selectedLive.email}`} className="inline-flex h-10 items-center rounded-xl border border-[#D7DAD8] bg-white px-3.5 text-[13px] font-medium text-[#1A1C1E] hover:border-[#5B53C0]/40">Email contact</a>
            <div className="flex gap-2">
              {selectedLive.reviewStatus === 'suggested' ? <SecondaryButton onClick={() => void rejectLead(selectedLive)} disabled={actionBusy} danger>Dismiss</SecondaryButton> : null}
              {selectedLive.reviewStatus === 'suggested' ? <SdPrimary onClick={() => void acceptLead(selectedLive)} disabled={actionBusy}>Accept lead</SdPrimary> : null}
              {selectedLive.reviewStatus === 'accepted' && !selectedLive.convertedCustomerId ? <SdPrimary onClick={() => void convertLead(selectedLive)} disabled={actionBusy}>Convert to customer</SdPrimary> : null}
            </div>
          </div>
        ) : null}
      >
        {selectedLive ? (
          <LeadDrawerBody
            lead={selectedLive}
            detail={detail}
            busy={detailBusy}
            actionBusy={actionBusy}
            onStage={(stage) => void patchLead(selectedLive, { stage, ...(CLOSED.has(stage) ? { next_follow_up_at: null } : {}) }, 'Stage updated')}
            onFollowUp={(date) => void patchLead(selectedLive, { next_follow_up_at: date ? new Date(`${date}T08:00:00.000Z`).toISOString() : null }, 'Follow-up updated')}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function GmailConnectionCard({
  data,
  syncing,
  actionBusy,
  syncError,
  onSync,
  onDisconnect,
}: {
  data: SdLeadPageData;
  syncing: boolean;
  actionBusy: boolean;
  syncError: string | null;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const connection = data.gmailConnection;
  if (!data.gmailConfigured) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E7E2] bg-white p-5">
        <div>
          <p className="text-[14px] font-semibold text-[#1A1C1E]">Gmail setup required</p>
          <p className="mt-1 max-w-2xl text-[13px] text-[#5F6368]">Add the Google OAuth client, secret, redirect URI and ServiceDen token-encryption key to the server environment before connecting an inbox.</p>
        </div>
        <Badge label="Not configured" tone="neutral" />
      </div>
    );
  }
  if (!connection) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7E7E2] bg-white p-5">
        <div>
          <p className="text-[14px] font-semibold text-[#1A1C1E]">Connect your Vyso Gmail inbox</p>
          <p className="mt-1 max-w-2xl text-[13px] text-[#5F6368]">Read-only access finds likely Vyso sales conversations and analyzes selected candidates with Vyso&apos;s configured AI provider. Label any unusual thread <span className="font-medium text-[#1A1C1E]">VysoLead</span> to track it explicitly. ServiceDen never sends email automatically.</p>
        </div>
        <a href="/api/serviceden/gmail/connect" className="inline-flex h-10 items-center rounded-xl bg-[#5B53C0] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#4C45A6]">Connect Gmail</a>
      </div>
    );
  }
  const needsReconnect = connection.status === 'reauth_required';
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9E6FB] text-[18px]" aria-hidden>✉</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-[#1A1C1E]">{connection.emailAddress}</p>
              <Badge label={needsReconnect ? 'Reconnect required' : syncing || connection.status === 'syncing' ? 'Syncing' : connection.status === 'error' ? 'Sync error' : 'Connected'} tone={needsReconnect || connection.status === 'error' ? 'critical' : syncing || connection.status === 'syncing' ? 'warning' : 'positive'} />
            </div>
            <p className="mt-1 text-[12px] text-[#9A9DA1]">Read-only · AI-assisted review · last synced {displayDate(connection.lastSyncedAt, true)} · label exceptions VysoLead</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {needsReconnect ? <a href="/api/serviceden/gmail/connect" className="inline-flex h-10 items-center rounded-xl bg-[#5B53C0] px-4 text-[13px] font-medium text-white">Reconnect Gmail</a> : <SecondaryButton onClick={onSync} disabled={syncing || actionBusy}>{syncing ? 'Syncing…' : 'Sync now'}</SecondaryButton>}
          <SecondaryButton onClick={onDisconnect} disabled={syncing || actionBusy} danger>Disconnect</SecondaryButton>
        </div>
      </div>
      {syncError || connection.lastError ? <p className="mt-3 rounded-lg bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#A32D2D]">{syncError || connection.lastError}</p> : null}
    </div>
  );
}

function LeadDrawerBody({
  lead,
  detail,
  busy,
  actionBusy,
  onStage,
  onFollowUp,
}: {
  lead: SdLead;
  detail: SdLeadDetail | null;
  busy: boolean;
  actionBusy: boolean;
  onStage: (stage: SdLeadStage) => void;
  onFollowUp: (date: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Pipeline stage">
          <select value={lead.stage} disabled={actionBusy} onChange={(event) => onStage(event.target.value as SdLeadStage)} className={inputClass}>
            {LEAD_STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
        </Field>
        <Field label="Next follow-up" hint="(optional)">
          <input type="date" value={inputDate(lead.nextFollowUpAt)} disabled={actionBusy} onChange={(event) => onFollowUp(event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="rounded-xl border border-[#E9E6FB] bg-[#F8F7FE] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5B53C0]">Agent readout</p>
          {lead.source === 'gmail_agent' ? <span className="text-[11px] text-[#9A9DA1]">{lead.agentConfidence}% confidence</span> : null}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#1A1C1E]">{lead.summary ?? 'No conversation summary yet.'}</p>
        {lead.primaryPain ? <p className="mt-2 text-[12px] text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">Possible pain:</span> {lead.primaryPain}</p> : null}
        {lead.agentNextAction ? <p className="mt-2 text-[12px] text-[#5F6368]"><span className="font-medium text-[#1A1C1E]">Suggested next step:</span> {lead.agentNextAction}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-xl border border-[#E7E7E2] p-3"><div className="text-[#9A9DA1]">Last outbound</div><div className="mt-1 font-medium text-[#1A1C1E]">{displayDate(lead.lastOutboundAt, true)}</div></div>
        <div className="rounded-xl border border-[#E7E7E2] p-3"><div className="text-[#9A9DA1]">Last inbound</div><div className="mt-1 font-medium text-[#1A1C1E]">{displayDate(lead.lastInboundAt, true)}</div></div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-[#1A1C1E]">Gmail conversation</h3>
          <span className="text-[11px] text-[#9A9DA1]">Email content is displayed as plain text</span>
        </div>
        {busy ? (
          <div className="rounded-xl border border-[#E7E7E2] px-4 py-8 text-center text-[13px] text-[#9A9DA1]">Loading conversation…</div>
        ) : !detail || detail.threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D7DAD8] px-4 py-8 text-center text-[13px] text-[#9A9DA1]">No Gmail conversation attached.</div>
        ) : (
          <div className="space-y-5">
            {detail.threads.map((thread) => (
              <div key={thread.id}>
                <p className="mb-2 text-[12px] font-medium text-[#5F6368]">{thread.subject || '(No subject)'}</p>
                <div className="space-y-2">
                  {thread.messages.map((message) => (
                    <div key={message.id} className={`rounded-xl border p-3 ${message.direction === 'outbound' ? 'ml-6 border-[#DDD8F6] bg-[#F8F7FE]' : 'mr-6 border-[#E7E7E2] bg-white'}`}>
                      <div className="flex items-center justify-between gap-3 text-[11px] text-[#9A9DA1]">
                        <span>{message.direction === 'outbound' ? 'You' : message.fromAddress}</span>
                        <span>{displayDate(message.sentAt, true)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#1A1C1E]">{message.bodyText ?? message.snippet ?? '(No readable message body)'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function clientPatch(patch: Record<string, unknown>): Partial<SdLead> {
  const out: Partial<SdLead> = {};
  if ('review_status' in patch) out.reviewStatus = patch.review_status as SdLead['reviewStatus'];
  if ('stage' in patch) out.stage = patch.stage as SdLeadStage;
  if ('next_follow_up_at' in patch) out.nextFollowUpAt = patch.next_follow_up_at as string | null;
  return out;
}
