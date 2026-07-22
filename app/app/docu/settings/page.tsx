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
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Doc-U settings</h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">
          How documents are reviewed and routed
        </p>

        <div className="mt-6 max-w-[820px]">
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="of-display text-[16px] font-semibold text-[#171A17]">Units of measurement</div>
                <p className="mt-1 text-[13px] text-[#6B6F68]">
                  These fill the unit dropdown when you review a document. Managed once for the whole
                  workspace.
                </p>
              </div>
              <Link
                href="/app/settings"
                className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                Manage units
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#EEF1F5] pt-3">
              {units.map((u) => (
                <span
                  key={u}
                  className="inline-flex items-center rounded-full bg-[#EEF1F5] px-2.5 py-1 text-[12px] font-medium text-[#6B6F68]"
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
