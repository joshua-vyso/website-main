'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './env';

/**
 * Browser Supabase client (cookie-based session via @supabase/ssr).
 * Returns null when env is not configured so the marketing site never crashes.
 */
export function createClient() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { supabaseConfigured };
