'use client';

import { deriveActivity } from '@/lib/platform/docu/activity';
import type { ActivityKind } from '@/lib/platform/docu/types';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/** Dot colour per activity kind. */
const KIND_COLOR: Record<ActivityKind, string> = {
  uploaded: '#8A8E86',
  extracted: '#0C447C',
  supplier_matched: '#3E7BC4',
  flags_detected: '#854F0B',
  reviewed: '#0F6E56',
  approved: '#0F6E56',
  rejected: '#A32D2D',
  archived: '#6B6F68',
};

function formatAt(at: string | null): string {
  if (!at) return '—';
  return new Date(at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Vertical activity timeline for the Doc-U detail panel. Each event renders a
 * coloured dot on a hairline rail, with a label and humanized timestamp.
 */
export function ActivityTimeline({ doc }: { doc: DocumentWithSupplier }) {
  const events = deriveActivity(doc);

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <h3 className="of-display text-[16px] font-semibold text-[#171A17]">Activity</h3>

      {events.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#8A8E86]">No activity yet.</p>
      ) : (
        <ol className="mt-3">
          {events.map((event, i) => {
            const last = i === events.length - 1;
            return (
              <li key={`${event.kind}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Rail: connecting line behind the dot */}
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute left-[3.5px] top-3 bottom-0 w-px bg-[#EAEDF2]"
                  />
                ) : null}
                {/* Dot */}
                <span
                  className="relative z-[1] mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: KIND_COLOR[event.kind] }}
                />
                {/* Content */}
                <div className="min-w-0 -mt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-[#171A17]">{event.label}</span>
                    {event.source === 'mock' ? (
                      <span className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#A0A49C]">
                        demo
                      </span>
                    ) : null}
                  </div>
                  <span className="of-num mt-0.5 block text-[12px] text-[#A0A49C]">{formatAt(event.at)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
