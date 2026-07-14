import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchSettings } from '@/lib/platform/procurepulse-queries';
import { UnitsCard } from '@/components/platform/procurepulse/UnitsCard';
import {
  EmailIngestCard,
  type IngestEvent,
  type IngestSender,
} from '@/components/platform/settings/EmailIngestCard';
import { INGEST_DOMAIN, addressFor } from '@/lib/platform/email-ingest-policy';

/**
 * Workspace settings — organisation-wide preferences reached from the profile
 * chip. Owns the organisation's units of measurement (used by Doc-U review +
 * ProcurePulse) and its email-ingestion address, plus a link to the team hub.
 */
export default async function WorkspaceSettings() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const settings = await fetchSettings(db, orgId);

  // Email ingestion. RLS scopes all three reads to the caller's org.
  const [addressRow, senderRows, eventRows] = await Promise.all([
    db.from('email_ingest_addresses').select('local_part').eq('org_id', orgId).eq('active', true).maybeSingle(),
    db.from('email_ingest_senders').select('id, email, status').eq('org_id', orgId).order('created_at', { ascending: false }),
    db
      .from('email_ingests')
      .select('id, from_email, subject, status, documents_created, error, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const localPart = (addressRow.data as { local_part: string } | null)?.local_part ?? null;
  const role = session.profile?.role;
  const canManage = role === 'owner' || role === 'admin';

  return (
    <div className="px-8 py-7">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Workspace settings</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          Settings for {session.org?.name ?? 'your organisation'}
        </p>
      </div>

      <div className="mt-6 max-w-[820px] space-y-4">
        <UnitsCard initialCustom={settings?.custom_units ?? []} />

        <EmailIngestCard
          configured={Boolean(INGEST_DOMAIN)}
          canManage={canManage}
          address={localPart ? addressFor(localPart) : null}
          senders={(senderRows.data ?? []) as IngestSender[]}
          events={(eventRows.data ?? []) as IngestEvent[]}
        />

        <Link
          href="/app/organisation"
          className="flex items-center justify-between gap-4 rounded-2xl border border-[#E7E7E2] bg-white p-4 transition-colors hover:border-[#1E5E54]/30"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-[#1A1C1E]">My Organisation</div>
            <p className="mt-0.5 text-[13px] text-[#9A9DA1]">Team members and recent workspace activity</p>
          </div>
          <span className="shrink-0 text-[18px] text-[#9A9DA1]" aria-hidden>
            ›
          </span>
        </Link>
      </div>
    </div>
  );
}
