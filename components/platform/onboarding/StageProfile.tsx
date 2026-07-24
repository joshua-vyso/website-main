'use client';

import { useState } from 'react';
import { createClient } from '@/lib/platform/supabase-browser';
import { MigrationMissingCard, isMissingRpcError } from './shared';

const INDUSTRIES = [
  'Food & beverage wholesale',
  'Retail',
  'Manufacturing',
  'Logistics',
  'Services',
  'Construction',
  'Agriculture',
  'Other',
] as const;

const EMPLOYEE_BANDS = ['1-5', '6-20', '21-50', '51-200', '200+'] as const;

const FIELD =
  'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
const LABEL = 'mb-1.5 block text-[12.5px] font-medium text-[#57524c]';

export function StageProfile({
  defaultName,
  onDone,
}: {
  defaultName: string;
  onDone: (orgName: string) => void;
}) {
  const [fullName, setFullName] = useState(defaultName);
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState<string>('');
  const [otherIndustry, setOtherIndustry] = useState('');
  const [employees, setEmployees] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const industryValue = industry === 'Other' ? otherIndustry.trim() : industry;
  const canSubmit = fullName.trim() !== '' && company.trim() !== '' && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMigrationMissing(false);

    const supabase = createClient();
    if (!supabase) {
      setError('Backend not configured — add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    setSaving(true);
    const { error: rpcError } = await supabase.rpc('onboarding_create_org', {
      p_org_name: company.trim(),
      p_industry: industryValue || null,
      p_employee_count: employees || null,
      p_full_name: fullName.trim(),
    });
    setSaving(false);

    if (rpcError) {
      if (isMissingRpcError(rpcError.message)) {
        setMigrationMissing(true);
        return;
      }
      setError(rpcError.message);
      return;
    }
    onDone(company.trim());
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#E4E9F0] bg-white p-6 sm:p-7">
      <h1 className="of-display text-[20px] font-semibold text-[#171A17]">Tell us about your business</h1>
      <p className="mt-1 text-[13.5px] text-[#6B6F68]">This tailors your workspace. You can change any of it later.</p>

      {migrationMissing ? <MigrationMissingCard className="mt-5" /> : null}

      <div className="mt-6 space-y-5">
        <div>
          <label className={LABEL} htmlFor="ob-name">Your name</label>
          <input
            id="ob-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder="Alex Mokoena"
            className={FIELD}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="ob-company">Company name</label>
          <input
            id="ob-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            placeholder="e.g. Fresh Valley Produce"
            className={FIELD}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="ob-industry">Industry</label>
          <select
            id="ob-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={`${FIELD} appearance-none`}
          >
            <option value="">Select an industry…</option>
            {INDUSTRIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {industry === 'Other' ? (
            <input
              type="text"
              value={otherIndustry}
              onChange={(e) => setOtherIndustry(e.target.value)}
              placeholder="Tell us your industry"
              className={`${FIELD} mt-2.5`}
            />
          ) : null}
        </div>

        <div>
          <span className={LABEL}>Team size</span>
          <div className="flex flex-wrap gap-2">
            {EMPLOYEE_BANDS.map((band) => {
              const active = employees === band;
              return (
                <button
                  key={band}
                  type="button"
                  onClick={() => setEmployees(active ? '' : band)}
                  className={`h-10 rounded-[11px] border px-4 text-[13.5px] font-medium transition-colors ${
                    active
                      ? 'border-[#3E7BC4] bg-[#EAF2FC] text-[#174C87]'
                      : 'border-[#E4E9F0] bg-white text-[#3E4A57] hover:border-[#C9DEF7] hover:bg-[#F5F9FE]'
                  }`}
                >
                  {band}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2.5 text-[13px] text-[#A32D2D]">
          {error}
        </div>
      ) : null}

      <div className="mt-7 flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-[44px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}
