'use client';

/**
 * When the onboarding RPCs haven't been created yet (the migration wasn't pasted
 * into the Supabase dashboard), PostgREST returns "Could not find the function
 * public.onboarding_… in the schema cache". Detect that so the stage can show a
 * clear, actionable card naming the migration file instead of a raw error (or a
 * white screen). See .ai/plan_finch-onboarding.md §8.
 */
export function isMissingRpcError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /could not find|schema cache|does not exist|function .*onboarding_/i.test(message);
}

export function MigrationMissingCard({ className = '' }: { className?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-[#EBD9B0] bg-[#FBF3E4] px-4 py-3 text-[13px] leading-relaxed text-[#854F0B] ${className}`}
    >
      <span className="font-semibold">Setup migration missing.</span> The onboarding functions
      aren&apos;t in the database yet. Paste{' '}
      <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[12px]">supabase/onboarding.sql</code>{' '}
      into the Supabase dashboard SQL editor and run it, then try again.
    </div>
  );
}
