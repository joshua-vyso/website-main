import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocuNav } from '@/components/platform/docu/DocuNav';
import { allUnits } from '@/lib/platform/procurepulse/units';

/**
 * Doc-U settings. The unit list is workspace-wide (one source of truth), so it's
 * shown here read-only with a link to manage it in Workspace settings.
 */
export default async function DocuSettings() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const { data } = await db.from('pp_settings').select('custom_units').eq('org_id', orgId).maybeSingle();
  const units = allUnits((data as { custom_units?: string[] | null } | null)?.custom_units);

  return (
    <div className="px-8 py-7">
      <DocuNav />
      <div className="mt-6">
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Doc-U settings</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          How documents are reviewed and routed
        </p>

        <div className="mt-6 max-w-[820px]">
          <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-[#1A1C1E]">Units of measurement</div>
                <p className="mt-0.5 text-[13px] text-[#9A9DA1]">
                  These fill the unit dropdown when you review a document. Managed once for the whole
                  workspace.
                </p>
              </div>
              <Link
                href="/app/settings"
                className="shrink-0 rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1E5E54] transition-colors hover:border-[#1E5E54]/40"
              >
                Manage units
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#EFEFEC] pt-3">
              {units.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center rounded-full bg-[#F2F2EF] px-2.5 py-1 text-[12px] text-[#5F6368]"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
