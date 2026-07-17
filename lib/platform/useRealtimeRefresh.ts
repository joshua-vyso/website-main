'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';

/**
 * Keep a server-rendered list live without a manual refresh.
 *
 * Subscribes to Supabase Realtime `postgres_changes` on one or more tables, scoped to
 * the caller's org, and re-runs the server component (router.refresh()) whenever a row
 * changes. This reconciles against server truth exactly like the existing optimistic
 * patterns — no client-side data shape to maintain.
 *
 * Requirements (both external to this file):
 *  - each table is in the `supabase_realtime` publication (supabase/realtime.sql), and
 *  - each table has an RLS SELECT policy scoped to the org — Realtime enforces RLS, so
 *    without it the browser simply receives nothing (fails closed, never cross-tenant).
 *
 * No-ops on the marketing/unconfigured path (createClient() null) and before an org is
 * known. The refresh is debounced so a batch insert (e.g. many line items at once)
 * collapses into a single re-fetch.
 */
export function useRealtimeRefresh(tables: string | readonly string[]): void {
  const router = useRouter();
  const { org } = usePlatform();
  const orgId = org?.id;
  // Stable primitive key so an inline array literal doesn't re-subscribe every render.
  const key = Array.isArray(tables) ? [...tables].sort().join(',') : (tables as string);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !orgId) return;

    const list = key.split(',').filter(Boolean);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel(`rt:${key}:${orgId}`);
    for (const table of list) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` },
        refresh,
      );
    }
    channel.subscribe();

    // Self-heal if a realtime event is ever missed — a dropped socket, a laptop waking
    // from sleep, or a spotty connection. Coming back to the tab reconciles against
    // server truth, so the list is never silently stale even when the socket isn't.
    const reconcileOnReturn = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', reconcileOnReturn);
    window.addEventListener('focus', reconcileOnReturn);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', reconcileOnReturn);
      window.removeEventListener('focus', reconcileOnReturn);
      void supabase.removeChannel(channel);
    };
  }, [key, orgId, router]);
}
