import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchModuleNotifications, type ModuleNotification } from '@/lib/platform/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function timeLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (days <= 0) return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  if (days < 7) return `${days} d ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function NotifRow({ n }: { n: ModuleNotification }) {
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
        style={{ backgroundColor: n.bg }}
      >
        <span className="h-[15px] w-[15px] rounded-[3px]" style={{ backgroundColor: n.fg }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${n.fg}14`, color: n.fg }}
          >
            {n.moduleLabel}
          </span>
          <span className="text-[11px] uppercase tracking-[0.05em] text-[#A0A49C]">{n.kindLabel}</span>
        </div>
        <div className="truncate text-[14px] font-semibold text-[#171A17]">{n.title}</div>
        {n.body ? <div className="mt-0.5 text-[13px] text-[#6B6F68]">{n.body}</div> : null}
      </div>
      <div className="of-num shrink-0 pt-0.5 text-[12px] text-[#A0A49C]">{timeLabel(n.created_at, new Date())}</div>
    </div>
  );
}

function Group({ label, notifs }: { label: string; notifs: ModuleNotification[] }) {
  if (notifs.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-1 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        {notifs.map((n, i) => (
          <div key={n.id} className={i > 0 ? 'border-t border-[#F4F5F7]' : ''}>
            <NotifRow n={n} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cross-module notification centre — every module's notifications in one feed. */
export default async function NotificationsPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const notifs = await fetchModuleNotifications(db, orgId);

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;
  const todayList: ModuleNotification[] = [];
  const yesterdayList: ModuleNotification[] = [];
  const earlierList: ModuleNotification[] = [];
  for (const n of notifs) {
    const d = startOfDay(new Date(n.created_at));
    if (d >= today) todayList.push(n);
    else if (d >= yesterday) yesterdayList.push(n);
    else earlierList.push(n);
  }

  return (
    <div className="px-8 py-7">
      <div>
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Notifications</h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">Everything happening across your modules, newest first</p>
      </div>

      <div className="mt-6">
        {notifs.length === 0 ? (
          <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-12 text-center text-[14px] text-[#8A8E86] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
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
    </div>
  );
}
