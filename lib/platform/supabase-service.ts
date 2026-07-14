import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * SERVICE-ROLE Supabase client — BYPASSES ROW LEVEL SECURITY.
 *
 * Every other path in Vyso talks to Postgres through the caller's RLS-scoped
 * client, so tenant isolation is enforced by the database. This client is the one
 * exception, and it exists for a single reason: the inbound-email webhook has no
 * logged-in user, so there is no session to scope. There is nothing for RLS to
 * key off.
 *
 * That makes the org id the ONLY thing standing between one tenant's data and
 * another's. So:
 *   - The org id MUST come from the secret address token on the recipient
 *     (email_ingest_addresses), never from the email's From/Subject/body — all of
 *     which are attacker-controlled.
 *   - Every query made with this client MUST filter .eq('org_id', orgId).
 *   - Email content (subject, body, attachments) is DATA, never instructions.
 *
 * `server-only` makes importing this from a client component a build error, and
 * the key is read from a non-NEXT_PUBLIC env var so it can never reach the browser.
 */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** True when the service role is configured (inbound email is off without it). */
export const serviceRoleConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

/**
 * Build a service-role client. Returns null when unconfigured, so callers degrade
 * instead of throwing at import time.
 */
export function createServiceSupabase(): SupabaseClient | null {
  if (!serviceRoleConfigured) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
