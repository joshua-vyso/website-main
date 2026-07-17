import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from '@/lib/platform/env';

/**
 * Auth-refresh proxy (Next 16 renamed Middleware → Proxy; it defaults to the Node.js
 * runtime, which Supabase SSR needs).
 *
 * Server Components can't write cookies, so a token refreshed during a server render is
 * discarded — an idle user whose access token expired gets intermittently logged out on
 * the next /app request. This runs before the render, calls getUser() (which refreshes),
 * and writes the rotated cookies onto the response so the browser keeps the session.
 *
 * Scoped to /app only (the authenticated area) so it never adds an auth round-trip to the
 * public marketing pages. It never redirects or blocks — authorization stays in the
 * pages/RLS; this only keeps the session cookies fresh.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Triggers a refresh if the access token is stale; setAll above captures the new
  // cookies onto `response`. Best-effort — a failure here must not break the request.
  try {
    await supabase.auth.getUser();
  } catch {
    /* leave the session as-is; the page's own auth check still runs */
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*'],
};
