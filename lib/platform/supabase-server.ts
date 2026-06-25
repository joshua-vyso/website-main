import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './env';
import { FEATURE_KEYS } from './modules';
import type { FeatureKey, Organisation, OrgFeature, Profile } from './types';

/**
 * Server Supabase client bound to the request cookies (Next 16 — `cookies()` is async).
 * `setAll` is wrapped in try/catch because Server Components cannot write cookies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — refresh handled on the next request.
        }
      },
    },
  });
}

export interface PlatformSession {
  userId: string;
  email: string;
  profile: Profile | null;
  org: Organisation | null;
  features: Record<FeatureKey, boolean>;
}

const emptyFeatures = (): Record<FeatureKey, boolean> =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<FeatureKey, boolean>;

/**
 * Resolve the authenticated platform session (user + profile + org + features),
 * or null when unauthenticated/unconfigured. The /app layout uses this to guard.
 *
 * Wrapped in React `cache()` so the layout + page (+ nested layout) all share a
 * SINGLE execution per request instead of each re-running the auth → profile →
 * org/features round-trips. This deduped ~8 redundant queries per ProcurePulse
 * navigation down to one set.
 */
export const getPlatformSession = cache(async (): Promise<PlatformSession | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  const features = emptyFeatures();
  let org: Organisation | null = null;

  if (profile?.org_id) {
    const [{ data: orgRow }, { data: featureRows }] = await Promise.all([
      supabase.from('organisations').select('*').eq('id', profile.org_id).maybeSingle<Organisation>(),
      supabase.from('org_features').select('*').eq('org_id', profile.org_id).returns<OrgFeature[]>(),
    ]);
    org = orgRow ?? null;
    for (const row of featureRows ?? []) {
      if ((FEATURE_KEYS as readonly string[]).includes(row.feature_key)) {
        features[row.feature_key as FeatureKey] = row.enabled;
      }
    }
  }

  return { userId: user.id, email: user.email ?? '', profile: profile ?? null, org, features };
});
