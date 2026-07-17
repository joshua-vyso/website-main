import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './env';

/**
 * Durable, fleet-wide rate limiting backed by Postgres (see supabase/rate-limits.sql).
 * Uses the anon key + a SECURITY DEFINER RPC, so it works on public routes and needs no
 * service-role key.
 *
 * FAILS OPEN: this is defense-in-depth against sustained floods, not the primary control
 * (the endpoints validate and bound their input regardless). If the DB or the RPC is
 * unavailable — including before rate-limits.sql is applied — we allow the request rather
 * than take the site down.
 */

let cached: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!cached) cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return cached;
}

/**
 * Count one hit against `bucket` and return whether it is ALLOWED.
 * @param bucket  stable key, e.g. `contact:${ip}` or `ai-msg:${userId}`
 * @param limit   max hits permitted per window
 * @param windowSeconds  window length in seconds
 * @returns true = allowed, false = over the limit (reject with 429)
 */
export async function rateLimitAllowed(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const supabase = client();
  if (!supabase) return true;
  try {
    const { data, error } = await supabase.rpc('rate_limit_hit', {
      p_bucket: bucket.slice(0, 200),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false; // RPC returns false only when over the limit
  } catch {
    return true; // fail open
  }
}
