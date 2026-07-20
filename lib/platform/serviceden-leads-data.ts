import 'server-only';

import { createServerSupabase } from './supabase-server';
import type {
  SdGmailConnection,
  SdLead,
  SdLeadDetail,
  SdLeadPageData,
  SdLeadReviewStatus,
  SdLeadSource,
  SdLeadStage,
  SdMailMessage,
  SdMailThread,
} from './serviceden';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const serviceDenGmailConfigured = Boolean(
  process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.SERVICEDEN_GMAIL_TOKEN_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function mapSdLead(r: any): SdLead {
  return {
    id: String(r.id),
    ownerUserId: String(r.owner_user_id),
    gmailConnectionId: r.gmail_connection_id ?? null,
    convertedCustomerId: r.converted_customer_id ?? null,
    contactName: r.contact_name ?? '',
    company: r.company ?? null,
    email: r.email ?? '',
    phone: r.phone ?? null,
    source: (r.source as SdLeadSource) ?? 'manual',
    stage: (r.stage as SdLeadStage) ?? 'new',
    reviewStatus: (r.review_status as SdLeadReviewStatus) ?? 'accepted',
    primaryPain: r.primary_pain ?? null,
    summary: r.summary ?? null,
    agentNextAction: r.agent_next_action ?? null,
    agentConfidence: Number(r.agent_confidence) || 0,
    lastInboundAt: r.last_inbound_at ?? null,
    lastOutboundAt: r.last_outbound_at ?? null,
    nextFollowUpAt: r.next_follow_up_at ?? null,
    followUpCount: Number(r.follow_up_count) || 0,
    notes: r.notes ?? null,
    wonAt: r.won_at ?? null,
    lostAt: r.lost_at ?? null,
    lostReason: r.lost_reason ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

function mapConnection(r: any): SdGmailConnection {
  return {
    id: String(r.id),
    emailAddress: r.email_address ?? '',
    scopes: Array.isArray(r.scopes) ? r.scopes.map(String) : [],
    status: r.status ?? 'connected',
    lastSyncedAt: r.last_synced_at ?? null,
    lastError: r.last_error ?? null,
  };
}

export async function getServiceDenLeadPageData(orgId: string, userId: string): Promise<SdLeadPageData> {
  const sb = await createServerSupabase();
  const [leadRes, connectionRes] = await Promise.all([
    sb.from('sd_leads').select('*').eq('org_id', orgId).order('updated_at', { ascending: false }),
    sb
      .from('sd_gmail_connections')
      .select('id,email_address,scopes,status,last_synced_at,last_error')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .neq('status', 'disconnected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Before serviceden.sql has been re-run, the new tables do not exist. Return
  // an empty, configuration-aware state so the rest of ServiceDen still loads.
  const leads = leadRes.error ? [] : ((leadRes.data as any[]) ?? []).map(mapSdLead);
  const gmailConnection = connectionRes.error || !connectionRes.data ? null : mapConnection(connectionRes.data);

  return {
    leads,
    gmailConnection,
    gmailConfigured: serviceDenGmailConfigured,
    schemaReady: !leadRes.error && !connectionRes.error,
  };
}

export async function getServiceDenLeadDetail(orgId: string, leadId: string): Promise<SdLeadDetail | null> {
  const sb = await createServerSupabase();
  const { data: leadRow, error: leadError } = await sb
    .from('sd_leads')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', leadId)
    .maybeSingle();
  if (leadError || !leadRow) return null;

  const { data: threadRows, error: threadError } = await sb
    .from('sd_mail_threads')
    .select('id,provider_thread_id,subject,participants,latest_message_at')
    .eq('org_id', orgId)
    .eq('lead_id', leadId)
    .order('latest_message_at', { ascending: false });
  if (threadError) return { lead: mapSdLead(leadRow), threads: [] };

  const rows = (threadRows as any[]) ?? [];
  const threadIds = rows.map((r) => String(r.id));
  const { data: messageRows } = threadIds.length
    ? await sb
        .from('sd_mail_messages')
        .select('id,thread_id,direction,from_address,to_addresses,cc_addresses,subject,sent_at,snippet,body_text')
        .eq('org_id', orgId)
        .in('thread_id', threadIds)
        .order('sent_at', { ascending: true })
    : { data: [] as any[] };

  const byThread = new Map<string, SdMailMessage[]>();
  for (const r of (messageRows as any[]) ?? []) {
    const message: SdMailMessage = {
      id: String(r.id),
      direction: r.direction === 'outbound' ? 'outbound' : 'inbound',
      fromAddress: r.from_address ?? '',
      toAddresses: Array.isArray(r.to_addresses) ? r.to_addresses.map(String) : [],
      ccAddresses: Array.isArray(r.cc_addresses) ? r.cc_addresses.map(String) : [],
      subject: r.subject ?? null,
      sentAt: r.sent_at ?? '',
      snippet: r.snippet ?? null,
      bodyText: r.body_text ?? null,
    };
    const list = byThread.get(String(r.thread_id)) ?? [];
    list.push(message);
    byThread.set(String(r.thread_id), list);
  }

  const threads: SdMailThread[] = rows.map((r) => ({
    id: String(r.id),
    providerThreadId: r.provider_thread_id ?? '',
    subject: r.subject ?? null,
    participants: Array.isArray(r.participants) ? r.participants.map(String) : [],
    latestMessageAt: r.latest_message_at ?? null,
    messages: byThread.get(String(r.id)) ?? [],
  }));

  return { lead: mapSdLead(leadRow), threads };
}
