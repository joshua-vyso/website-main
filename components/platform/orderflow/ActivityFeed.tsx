'use client';

import { ACTIVITY_EVENT_LABEL } from '@/lib/platform/orderflow-activity';
import type { OfActivityEvent } from '@/lib/platform/orderflow';

// ---------------------------------------------------------------------------
// Dot colour by event family — keeps the feed readable at a glance without a
// per-event colour map. Falls back to neutral grey for anything unrecognised.
// ---------------------------------------------------------------------------

function dotColor(event: string): string {
  if (event.includes('payment')) return '#0F6E56'; // money in — green
  if (event.includes('cancelled') || event.includes('rejected') || event.includes('void')) return '#A32D2D'; // red
  if (event.includes('credit_note')) return '#854F0B'; // amber
  if (event.includes('invoice')) return '#3E7BC4'; // blue — primary flow
  if (event.includes('quote')) return '#4A6FA5'; // muted blue
  if (event.includes('order')) return '#3E7BC4';
  if (event.includes('delivery') || event.includes('pod')) return '#854F0B';
  if (event.includes('document')) return '#6B6F68';
  if (event.includes('customer') || event.includes('contact') || event.includes('address')) return '#4A6FA5';
  return '#8A8E86';
}

/**
 * Relative time under 24h ("just now", "12m ago", "5h ago"), otherwise the
 * calendar date. Bad/empty timestamps render as an em dash rather than "Invalid".
 */
function displayTime(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  const diffMs = Date.now() - t.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ActivityFeed({ events, emptyLabel }: { events: OfActivityEvent[]; emptyLabel?: string }) {
  if (!events || events.length === 0) {
    return (
      <p className="text-[13px] text-[#8A8E86]">{emptyLabel ?? 'No activity yet.'}</p>
    );
  }

  return (
    <ul className="space-y-3.5">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor(e.event) }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-[#171A17]">
                {ACTIVITY_EVENT_LABEL[e.event] ?? e.event}
              </span>
              <span className="shrink-0 text-[11px] text-[#8A8E86]">{displayTime(e.created_at)}</span>
            </div>
            {e.description ? (
              <p className="mt-0.5 truncate text-[12px] text-[#6B6F68]">{e.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
