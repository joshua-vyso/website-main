'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import type { PlTargets } from '@/lib/platform/pricepilot';

type FieldKey = 'target_margin_pct' | 'monthly_revenue_target' | 'monthly_gross_profit_target' | 'monthly_opex';

const FIELDS: { key: FieldKey; label: string; help: string; adorn: string; side: 'left' | 'right' }[] = [
  {
    key: 'target_margin_pct',
    label: 'Target gross margin',
    help: 'Your goal margin on selling prices. Products below this surface as opportunities.',
    adorn: '%',
    side: 'right',
  },
  {
    key: 'monthly_revenue_target',
    label: 'Monthly revenue goal',
    help: 'Total sales you aim to bill each month.',
    adorn: 'R',
    side: 'left',
  },
  {
    key: 'monthly_gross_profit_target',
    label: 'Monthly gross profit goal',
    help: 'Revenue minus cost of goods you aim to keep each month.',
    adorn: 'R',
    side: 'left',
  },
  {
    key: 'monthly_opex',
    label: 'Monthly operating costs',
    help: 'Rent, salaries, transport, etc. Net profit = gross profit − this.',
    adorn: 'R',
    side: 'left',
  },
];

function toStr(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

/** In-app editor for the org's pricing targets (pl_targets). Upserts via the browser client. */
export function TargetsForm({ initial }: { initial: PlTargets | null }) {
  const router = useRouter();
  const { org } = usePlatform();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    target_margin_pct: toStr(initial?.target_margin_pct),
    monthly_revenue_target: toStr(initial?.monthly_revenue_target),
    monthly_gross_profit_target: toStr(initial?.monthly_gross_profit_target),
    monthly_opex: toStr(initial?.monthly_opex),
  });
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
      target_margin_pct: parse(values.target_margin_pct),
      monthly_revenue_target: parse(values.monthly_revenue_target),
      monthly_gross_profit_target: parse(values.monthly_gross_profit_target),
      monthly_opex: parse(values.monthly_opex),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase.from('pl_targets').upsert(patch, { onConflict: 'org_id' });
    if (upErr) {
      setError(
        /relation .* does not exist|pl_targets/i.test(upErr.message) && /exist/i.test(upErr.message)
          ? 'The targets table isn’t set up yet — run the one-time SQL shown above, then try again.'
          : upErr.message,
      );
      setBusy(false);
      return;
    }
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white">
      <div className="border-b border-[#F0F0EC] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Pricing targets</h2>
        <p className="mt-0.5 text-[12px] text-[#9A9DA1]">
          These drive your Pricing Health score, profit tracking and opportunity suggestions. Leave any blank to skip it.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[13px] font-medium text-[#1A1C1E]">{f.label}</span>
            <div className="mt-1.5 flex items-center rounded-lg border border-[#D7DAD8] bg-white px-3 transition-colors focus-within:border-[#1E5E54]">
              {f.side === 'left' ? <span className="mr-2 text-[14px] text-[#9A9DA1]">{f.adorn}</span> : null}
              <input
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setSaved(false);
                }}
                placeholder="—"
                className="w-full bg-transparent py-2.5 text-[14px] text-[#1A1C1E] outline-none placeholder:text-[#C7C9C5]"
              />
              {f.side === 'right' ? <span className="ml-2 text-[14px] text-[#9A9DA1]">{f.adorn}</span> : null}
            </div>
            <span className="mt-1 block text-[12px] text-[#9A9DA1]">{f.help}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-[#F0F0EC] px-5 py-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg bg-[#1E5E54] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save targets'}
        </button>
        {saved ? <span className="text-[13px] font-medium text-[#0F6E56]">✓ Saved</span> : null}
        {error ? <span className="text-[13px] text-[#A32D2D]">{error}</span> : null}
      </div>
    </div>
  );
}
