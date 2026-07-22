'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { BUILT_IN_UNITS } from '@/lib/platform/procurepulse/units';

/**
 * Units of measurement — built-ins (read-only) plus org-defined custom units the
 * user can add/remove. Persists to pp_settings.custom_units. These feed the
 * typeable unit dropdown on the Products page.
 */
export function UnitsCard({ initialCustom }: { initialCustom: string[] }) {
  const router = useRouter();
  const { org } = usePlatform();
  const [units, setUnits] = useState<string[]>(initialCustom);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist(next: string[]) {
    const supabase = createClient();
    if (!supabase || !org?.id) return;
    setBusy(true);
    const { data: existing } = await supabase
      .from('pp_settings')
      .select('org_id')
      .eq('org_id', org.id)
      .maybeSingle();
    if (existing) await supabase.from('pp_settings').update({ custom_units: next }).eq('org_id', org.id);
    else await supabase.from('pp_settings').insert({ org_id: org.id, custom_units: next });
    setBusy(false);
    router.refresh();
  }

  function add() {
    const u = value.trim();
    if (!u) return;
    const exists =
      units.some((x) => x.toLowerCase() === u.toLowerCase()) ||
      BUILT_IN_UNITS.some((x) => x.toLowerCase() === u.toLowerCase());
    if (exists) {
      setValue('');
      return;
    }
    const next = [...units, u];
    setUnits(next);
    setValue('');
    void persist(next);
  }

  function remove(u: string) {
    const next = units.filter((x) => x !== u);
    setUnits(next);
    void persist(next);
  }

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="of-display mb-1 text-[16px] font-semibold text-[#171A17]">Units of measurement</div>
      <p className="mb-3 text-[13px] text-[#6B6F68]">
        Built-in units plus your own. These appear in the unit dropdown on every product.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {BUILT_IN_UNITS.map((u) => (
          <span
            key={u}
            className="inline-flex items-center rounded-full bg-[#F2F2EF] px-2.5 py-1 text-[12px] text-[#6B6F68]"
          >
            {u}
          </span>
        ))}
        {units.map((u) => (
          <span
            key={u}
            className="inline-flex items-center gap-1 rounded-full bg-[#EAF2FC] px-2.5 py-1 text-[12px] font-medium text-[#174C87]"
          >
            {u}
            <button
              type="button"
              onClick={() => remove(u)}
              disabled={busy}
              aria-label={`Remove ${u}`}
              className="text-[#1F5FA8] transition-colors hover:text-[#A32D2D] disabled:opacity-40"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-[#EEF1F5] pt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Add a custom unit (e.g. sack, dozen)"
          className="h-11 flex-1 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !value.trim()}
          className="inline-flex h-[42px] shrink-0 items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}
