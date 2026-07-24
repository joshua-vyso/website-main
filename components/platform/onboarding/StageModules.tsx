'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/platform/supabase-browser';
import { MODULES } from '@/lib/platform/modules';
import { MODULE_META, type VysoModuleMeta } from '@/lib/platform/module-meta';
import { AppIcon } from '@/components/platform/AppIcon';
import type { FeatureKey } from '@/lib/platform/types';
import { MigrationMissingCard, isMissingRpcError } from './shared';

const REQUIRED = 3;

/** Map a FeatureKey → its display metadata (icon, accent, description). MODULE_META
 *  is keyed by friendly name, so index it by featureKey. */
const META_BY_FEATURE = Object.fromEntries(
  Object.values(MODULE_META).map((m) => [m.featureKey, m]),
) as Record<FeatureKey, VysoModuleMeta>;

export function StageModules({ onDone }: { onDone: (keys: FeatureKey[]) => void }) {
  const [selected, setSelected] = useState<Set<FeatureKey>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  // Doc-U is always included; the rest are the selectable trial modules.
  const selectable = useMemo(() => MODULES.filter((m) => m.key !== 'docu'), []);
  const count = selected.size;

  function toggle(key: FeatureKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < REQUIRED) next.add(key);
      return next;
    });
  }

  async function submit() {
    if (count !== REQUIRED) return;
    setError(null);
    setMigrationMissing(false);

    const supabase = createClient();
    if (!supabase) {
      setError('Backend not configured — add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    const keys = [...selected];
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('onboarding_choose_modules', { p_modules: keys });
    setSaving(false);

    if (rpcError) {
      if (isMissingRpcError(rpcError.message)) {
        setMigrationMissing(true);
        return;
      }
      setError(rpcError.message);
      return;
    }
    onDone(keys);
  }

  return (
    <div className="rounded-2xl border border-[#E4E9F0] bg-white p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="of-display text-[20px] font-semibold text-[#171A17]">Choose your modules</h1>
          <p className="mt-1 text-[13.5px] text-[#6B6F68]">
            Your 14-day trial includes Doc-U plus any 3 modules.
          </p>
        </div>
        <span
          className="mt-1 shrink-0 rounded-full px-3 py-1 text-[12.5px] font-semibold"
          style={{ backgroundColor: '#EAF2FC', color: '#174C87' }}
        >
          {count} of {REQUIRED} selected
        </span>
      </div>

      {migrationMissing ? <MigrationMissingCard className="mt-5" /> : null}

      {/* Doc-U — always included */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#D5E6F7] bg-[#F5F9FE] p-4">
        <AppIcon name={META_BY_FEATURE.docu.icon} size={34} />
        <div className="min-w-0 flex-1">
          <div className="of-display text-[14.5px] font-semibold text-[#171A17]">{META_BY_FEATURE.docu.name}</div>
          <div className="truncate text-[12.5px] text-[#6B6F68]">{META_BY_FEATURE.docu.description}</div>
        </div>
        <span className="shrink-0 rounded-full bg-[#DCEBFB] px-2.5 py-1 text-[11px] font-semibold text-[#174C87]">
          Always included
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {selectable.map((m) => {
          const meta = META_BY_FEATURE[m.key];
          const active = selected.has(m.key);
          const atLimit = count >= REQUIRED && !active;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              aria-pressed={active}
              disabled={atLimit}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? 'border-[#3E7BC4] bg-[#EAF2FC]'
                  : atLimit
                    ? 'cursor-not-allowed border-[#EEF1F5] bg-white opacity-55'
                    : 'border-[#E4E9F0] bg-white hover:border-[#C9DEF7] hover:bg-[#F5F9FE]'
              }`}
            >
              <AppIcon name={meta.icon} size={34} />
              <div className="min-w-0 flex-1">
                <div className="of-display text-[14.5px] font-semibold text-[#171A17]">{meta.name}</div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-[#6B6F68]">{meta.description}</div>
              </div>
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  active ? 'border-[#1F5FA8] bg-[#1F5FA8] text-white' : 'border-[#CBD5E1] bg-white text-transparent'
                }`}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2.5 text-[13px] text-[#A32D2D]">
          {error}
        </div>
      ) : null}

      <div className="mt-7 flex items-center justify-end">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={count !== REQUIRED || saving}
          className="inline-flex h-[44px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
