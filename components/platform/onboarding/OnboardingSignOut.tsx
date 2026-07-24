'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';

/** A small "Sign out" link for the onboarding chrome. Mirrors the TopBar sign-out
 *  idiom (signOut → push /login), minus the parsed-order clear (there's no Finch
 *  order draft to leak during onboarding). */
export function OnboardingSignOut() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#171A17]"
    >
      Sign out
    </button>
  );
}
