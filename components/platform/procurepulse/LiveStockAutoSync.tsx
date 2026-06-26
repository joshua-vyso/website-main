'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps Live stock current: on mount and every 5 minutes it pushes any Doc-U
 * statements that haven't fed ProcurePulse yet, then refreshes the page if
 * anything new came in. Renders nothing.
 */
export function LiveStockAutoSync({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const res = await fetch('/api/procurepulse/sync-all', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        const json = (await res.json().catch(() => ({}))) as { fed?: number };
        if (!cancelled && res.ok && (json.fed ?? 0) > 0) router.refresh();
      } catch {
        /* ignore — retried on the next tick */
      }
    }
    void sync();
    const id = setInterval(() => void sync(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
