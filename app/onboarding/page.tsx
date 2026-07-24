import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { FEATURE_KEYS } from '@/lib/platform/modules';
import type { FeatureKey } from '@/lib/platform/types';
import { OnboardingFlow, type OnboardingStage } from '@/components/platform/onboarding/OnboardingFlow';

/**
 * Onboarding entry (D3). Reads the session, derives which stage to resume at from
 * the org's onboarding_stage, and infers the already-chosen modules from
 * locked_modules (chosen = valid non-docu keys NOT locked). Everything the client
 * needs is passed in; the flow itself is a client orchestrator.
 */
export default async function OnboardingPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (session.org?.onboarding_completed_at) redirect('/app');

  const org = session.org;

  // Resume stage: no org → collect the profile first. With an org, trust its
  // saved stage (modules|data); an unknown/legacy value with an org means the
  // profile is already done, so resume at the data step.
  let initialStage: OnboardingStage = 'profile';
  if (org) {
    initialStage = org.onboarding_stage === 'modules' ? 'modules' : 'data';
  }

  // Chosen modules = the valid non-docu feature keys that are NOT locked. Before
  // stage 2 every non-docu key is locked, so this is empty until modules are set.
  const locked = new Set((org?.locked_modules ?? []) as string[]);
  const chosenModules = FEATURE_KEYS.filter((k) => k !== 'docu' && !locked.has(k)) as FeatureKey[];

  // Prefill the name: the profiles row (set at stage 1) wins; before that, the
  // full_name captured in signUp metadata.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const metaName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const defaultName = session.profile?.full_name || metaName || '';

  return (
    // Provide the session so client components inside the flow (the embedded
    // ImportWizard, the data-stage counts) can read the org via usePlatform() —
    // the /onboarding layout has no PlatformProvider of its own. router.refresh()
    // after each stage keeps this value current as the org is created/updated.
    <PlatformProvider value={session}>
      <OnboardingFlow
        initialStage={initialStage}
        defaultName={defaultName}
        initialOrgName={org?.name ?? ''}
        email={session.email}
        initialChosenModules={chosenModules}
      />
    </PlatformProvider>
  );
}
