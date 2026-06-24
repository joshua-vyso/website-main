import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchNotifications } from '@/lib/platform/procurepulse-queries';
import { NOTIFICATION_KINDS } from '@/lib/platform/procurepulse';
import { PageHead } from '@/components/platform/procurepulse/ui';
import type { PpNotification } from '@/lib/platform/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Relative-ish label for the right-hand timestamp. */
function timeLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (days <= 0) {
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
  if (days < 7) return `${days} d ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function NotifRow({ n }: { n: PpNotification }) {
  const k = NOTIFICATION_KINDS[n.kind];
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: k.bg }}
      >
        <span
          className="h-[15px] w-[15px] rounded-[3px]"
          style={{ backgroundColor: k.fg }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-[#1A1C1E]">{n.title}</div>
        {n.body ? <div className="mt-0.5 text-[12px] text-[#9A9DA1]">{n.body}</div> : null}
      </div>
      <div className="shrink-0 pt-0.5 text-[12px] text-[#9A9DA1]">
        {timeLabel(n.created_at, new Date())}
      </div>
    </div>
  );
}

function Group({ label, notifs }: { label: string; notifs: PpNotification[] }) {
  if (notifs.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="rounded-2xl border border-[#E7E7E2] bg-white px-4 py-1">
        {notifs.map((n, i) => (
          <div key={n.id} className={i > 0 ? 'border-t border-[#EFEFEC]' : ''}>
            <NotifRow n={n} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ProcurePulseNotifications() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const notifs = await fetchNotifications(db, orgId);

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;

  const todayList: PpNotification[] = [];
  const yesterdayList: PpNotification[] = [];
  const earlierList: PpNotification[] = [];
  for (const n of notifs) {
    const d = startOfDay(new Date(n.created_at));
    if (d >= today) todayList.push(n);
    else if (d >= yesterday) yesterdayList.push(n);
    else earlierList.push(n);
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Notifications"
        right={
          <div className="flex rounded-lg bg-[#ECECE8] p-[3px]">
            <span className="rounded-md bg-white px-4 py-1.5 text-[13px] font-medium text-[#1A1C1E]">
              All
            </span>
            <span className="px-4 py-1.5 text-[13px] font-medium text-[#5F6368]">Alerts</span>
            <span className="px-4 py-1.5 text-[13px] font-medium text-[#5F6368]">Documents</span>
          </div>
        }
      />

      {notifs.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E7E2] bg-white px-4 py-10 text-center text-[13px] text-[#9A9DA1]">
          No notifications yet.
        </div>
      ) : (
        <div className="max-w-[760px] space-y-6">
          <Group label="Today" notifs={todayList} />
          <Group label="Yesterday" notifs={yesterdayList} />
          <Group label="Earlier" notifs={earlierList} />
        </div>
      )}
    </div>
  );
}
