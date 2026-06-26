import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchSettings } from '@/lib/platform/procurepulse-queries';
import { UnitsCard } from '@/components/platform/procurepulse/UnitsCard';

/**
 * Workspace settings — organisation-wide preferences reached from the profile
 * chip. Today it owns the single source of truth for the organisation's units of
 * measurement (used by Doc-U review + ProcurePulse), plus a link to the team hub.
 */
export default async function WorkspaceSettings() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const settings = await fetchSettings(db, orgId);

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
