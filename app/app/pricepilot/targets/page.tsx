import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { TargetsForm } from '@/components/platform/pricepilot/TargetsForm';
import type { PlTargets } from '@/lib/platform/pricepilot';

const SETUP_SQL = `create table if not exists pl_targets (
  org_id uuid primary key references organisations(id) on delete cascade,
  target_margin_pct numeric,
  monthly_revenue_target numeric,
  monthly_gross_profit_target numeric,
  monthly_opex numeric,
  updated_at timestamptz not null default now()
);
alter table pl_targets add column if not exists monthly_opex numeric;
alter table pl_targets enable row level security;
drop policy if exists pl_targets_all on pl_targets;
create policy pl_targets_all on pl_targets for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));`;

export default async function PricePilotTargetsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const { data, error } = await db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle();
  const needsSetup = !!error && /does not exist|relation .*pl_targets/i.test(error.message);
  const targets = (data ?? null) as PlTargets | null;

  return (
    <div className="max-w-2xl">
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">Targets</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          Set the goals PricePilot measures you against. These power your Pricing Health score, profit tracking and
          opportunity suggestions across the dashboard.
        </p>
      </div>

      {needsSetup ? (
        <div className="mt-6 rounded-2xl border border-[#FBEEDA] bg-[#FFFBF4] p-5">
          <h2 className="text-[14px] font-semibold text-[#854F0B]">One-time setup needed</h2>
          <p className="mt-1 text-[13px] text-[#7A6A4F]">
            The targets table isn’t in your database yet. Paste this once in the Supabase SQL editor, then come back and
            fill in your goals below.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-[#EEDFBF] bg-white p-4 text-[12px] leading-relaxed text-[#5F6368]">
            {SETUP_SQL}
          </pre>
        </div>
      ) : null}

      <div className="mt-6">
        <TargetsForm initial={targets} />
      </div>
    </div>
  );
}
