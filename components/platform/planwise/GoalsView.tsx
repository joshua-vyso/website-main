'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { MODULE_META, type VysoModuleKey } from '@/lib/platform/module-meta';
import type { PlTargets } from '@/lib/platform/pricepilot';

type FieldKey = 'monthly_revenue_target' | 'monthly_gross_profit_target' | 'monthly_opex' | 'target_margin_pct';

const REAL_FIELDS: { key: FieldKey; label: string; adorn: string; side: 'left' | 'right'; help: string; module: VysoModuleKey; used: string }[] = [
  { key: 'monthly_revenue_target', label: 'Revenue goal', adorn: 'R', side: 'left', help: 'Total sales you aim to bill each month.', module: 'orderflow', used: 'Measured from OrderFlow sales' },
  { key: 'monthly_gross_profit_target', label: 'Desired monthly profit', adorn: 'R', side: 'left', help: 'Gross profit you aim to keep each month.', module: 'pricepilot', used: 'Tracked against PricePilot margins' },
  { key: 'monthly_opex', label: 'Maximum expenses', adorn: 'R', side: 'left', help: 'Operating-cost ceiling — rent, salaries, transport, etc.', module: 'procurepulse', used: 'Spend visibility from ProcurePulse & Doc-U' },
  { key: 'target_margin_pct', label: 'Target gross margin', adorn: '%', side: 'right', help: 'Goal margin on selling prices.', module: 'pricepilot', used: 'Drives PricePilot pricing recommendations' },
];

const MOCK_GOALS = [
  { id: 'cash', label: 'Cash reserve target', adorn: 'R', placeholder: '300 000', module: undefined as VysoModuleKey | undefined, used: 'Operational safety buffer' },
  { id: 'growth', label: 'Growth target', adorn: '%', placeholder: '8', module: undefined, used: 'Month-on-month revenue growth' },
  { id: 'outstanding', label: 'Outstanding invoice target', adorn: 'R', placeholder: '10 000', module: 'orderflow' as VysoModuleKey, used: 'Keep overdue below this in OrderFlow' },
];

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

function toStr(n: number | null | undefined) {
  return n == null ? '' : String(n);
}

export function GoalsView({ initial, needsSetup }: { initial: PlTargets | null; needsSetup: boolean }) {
  const router = useRouter();
  const { org } = usePlatform();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    monthly_revenue_target: toStr(initial?.monthly_revenue_target),
    monthly_gross_profit_target: toStr(initial?.monthly_gross_profit_target),
    monthly_opex: toStr(initial?.monthly_opex),
    target_margin_pct: toStr(initial?.target_margin_pct),
  });
  const [mock, setMock] = useState<Record<string, string>>({ cash: '', growth: '', outstanding: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parse(v: string): number | null {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not signed in.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const patch = {
      org_id: org.id,
      monthly_revenue_target: parse(values.monthly_revenue_target),
      monthly_gross_profit_target: parse(values.monthly_gross_profit_target),
      monthly_opex: parse(values.monthly_opex),
      target_margin_pct: parse(values.target_margin_pct),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase.from('pl_targets').upsert(patch, { onConflict: 'org_id' });
    if (upErr) {
      setError(/relation .* does not exist|pl_targets/i.test(upErr.message) ? 'Run the one-time SQL shown above, then try again.' : upErr.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  const inputBox = 'mt-1.5 flex items-center rounded-lg border border-[#D7DAD8] bg-white px-3 transition-colors focus-within:border-[#1E5E54]';
  const inputEl = 'w-full bg-transparent py-2.5 text-[14px] text-[#1A1C1E] outline-none placeholder:text-[#C7C9C5]';

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">Goals</h1>
        <p className="mt-0.5 text-[14px] text-[#5F6368]">Define where you want the business to go. Vyso measures progress against these across every module.</p>
      </div>

      {needsSetup ? (
        <div className="rounded-2xl border border-[#FBEEDA] bg-[#FFFBF4] p-5">
          <h2 className="text-[14px] font-semibold text-[#854F0B]">One-time setup needed</h2>
          <p className="mt-1 text-[13px] text-[#7A6A4F]">Paste this once in the Supabase SQL editor, then fill in your goals below.</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-[#EEDFBF] bg-white p-4 text-[12px] leading-relaxed text-[#5F6368]">{SETUP_SQL}</pre>
        </div>
      ) : null}

      {/* Core goals — persisted to pl_targets (the shared store other modules read) */}
      <div className="rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="border-b border-[#F0F0EC] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Core goals</h2>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Saved to your workspace and read by the modules that act on them. Leave any blank to skip it.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          {REAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-[13px] font-medium text-[#1A1C1E]">{f.label}</span>
              <div className={inputBox}>
                {f.side === 'left' ? <span className="mr-2 text-[14px] text-[#9A9DA1]">{f.adorn}</span> : null}
                <input inputMode="decimal" value={values[f.key]} onChange={(e) => { setValues((v) => ({ ...v, [f.key]: e.target.value })); setSaved(false); }} placeholder="—" className={inputEl} />
                {f.side === 'right' ? <span className="ml-2 text-[14px] text-[#9A9DA1]">{f.adorn}</span> : null}
              </div>
              <span className="mt-1 block text-[12px] text-[#9A9DA1]">{f.help}</span>
              <Link href={MODULE_META[f.module].route} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: MODULE_META[f.module].accent.fg }}>
                {f.used} →
              </Link>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-[#F0F0EC] px-5 py-4">
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center justify-center rounded-lg bg-[#1E5E54] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-50">
            {busy ? 'Saving…' : 'Save goals'}
          </button>
          {saved ? <span className="text-[13px] font-medium text-[#0F6E56]">✓ Saved</span> : null}
          {error ? <span className="text-[13px] text-[#A32D2D]">{error}</span> : null}
        </div>
      </div>

      {/* Additional strategic goals — UI ready, persistence coming with the planning store */}
      <div className="rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="border-b border-[#F0F0EC] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Strategic goals</h2>
          <p className="mt-0.5 text-[12px] text-[#9A9DA1]">Captured here for now — wired to live data as PlanWise grows.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
          {MOCK_GOALS.map((g) => (
            <label key={g.id} className="block">
              <span className="text-[13px] font-medium text-[#1A1C1E]">{g.label}</span>
              <div className={inputBox}>
                {g.adorn === 'R' ? <span className="mr-2 text-[14px] text-[#9A9DA1]">R</span> : null}
                <input inputMode="decimal" value={mock[g.id] ?? ''} onChange={(e) => setMock((m) => ({ ...m, [g.id]: e.target.value }))} placeholder={g.placeholder} className={inputEl} />
                {g.adorn === '%' ? <span className="ml-2 text-[14px] text-[#9A9DA1]">%</span> : null}
              </div>
              <span className="mt-1 block text-[12px] text-[#9A9DA1]">{g.used}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
