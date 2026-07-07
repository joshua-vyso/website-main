import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/platform/env';

export interface ResolvedUser {
  /** Supabase client scoped to the caller (RLS applies as that user). */
  supabase: SupabaseClient;
  userId: string;
  /** The caller's email (lower-cased), for feature gating. */
  email: string | null;
}

/**
 * Resolve the calling user for an /api/ai route from EITHER:
 *  - an `Authorization: Bearer <supabase access token>` header (mobile), or
 *  - the Supabase cookie session (web).
 * Returns a Supabase client that operates under that user's RLS context, so the
 * AI routes can only ever touch the caller's own org data.
 */
export async function resolveUser(req: Request): Promise<ResolvedUser | null> {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);
    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { supabase, userId: data.user.id, email: data.user.email?.toLowerCase() ?? null };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        /* read-only in a route handler GET-style context */
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id, email: data.user.email?.toLowerCase() ?? null };
}

export const AI_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
