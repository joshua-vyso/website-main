import Link from 'next/link';
import { NOTIF_SEVERITY_STYLE, type PpNotification } from '@/lib/platform/pricepilot';

/** Renders the pricing notification feed (used full-page and as a dashboard strip). */
export function NotificationList({ items, compact = false }: { items: PpNotification[]; compact?: boolean }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E7E2] bg-white px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-[#1A1C1E]">You&rsquo;re all caught up 🎉</p>
        <p className="mt-1 text-[13px] text-[#5F6368]">No pricing alerts right now — contracts are valid and margins are on target.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
      {items.map((n, i) => {
        const s = NOTIF_SEVERITY_STYLE[n.severity];
        return (
          <Link
            key={n.id}
            href={n.href}
            className={`flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAFAF8] ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-[#1A1C1E]">{n.title}</span>
              {!compact ? <span className="mt-0.5 block text-[13px] text-[#5F6368]">{n.body}</span> : null}
            </span>
            <span className="shrink-0 self-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
              {s.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
