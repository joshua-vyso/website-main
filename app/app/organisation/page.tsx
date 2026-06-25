import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import type { UserRole } from '@/lib/platform/types';

const ROLE_STYLE: Record<UserRole, { bg: string; fg: string; label: string }> = {
  owner: { bg: '#E3F0ED', fg: '#1E5E54', label: 'Owner' },
  admin: { bg: '#E6F1FB', fg: '#0C447C', label: 'Admin' },
  member: { bg: '#F0F0EC', fg: '#5F6368', label: 'Member' },
};

function initials(name: string | null): string {
  if (!name) return '·';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Member {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}
interface Activity {
  id: string;
  who: string;
  action: string;
  target: string;
  at: string;
}

/**
 * My Organisation — the team hub. Every member of the org in one place, plus a
 * feed of the edits people have made (document uploads + folder changes, the
 * attributable activity we track today).
 */
export default async function OrganisationPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [{ data: memberRows }, { data: docRows }, { data: folderRows }] = await Promise.all([
    db.from('profiles').select('id, full_name, role, created_at').eq('org_id', orgId).order('created_at', { ascending: true }),
    db
      .from('documents')
      .select('id, filename, created_at, uploaded_by')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(60),
    db
      .from('document_folders')
      .select('id, name, created_at, created_by')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const members = (memberRows ?? []) as Member[];
  const nameById = new Map(members.map((m) => [m.id, m.full_name || 'Teammate']));
  const who = (uid: string | null) => (uid && nameById.get(uid)) || 'Someone';

  const activity: Activity[] = [
    ...((docRows ?? []) as { id: string; filename: string; created_at: string; uploaded_by: string | null }[]).map(
      (d) => ({ id: `doc-${d.id}`, who: who(d.uploaded_by), action: 'uploaded', target: d.filename, at: d.created_at }),
    ),
    ...((folderRows ?? []) as { id: string; name: string; created_at: string; created_by: string | null }[]).map(
      (f) => ({ id: `fold-${f.id}`, who: who(f.created_by), action: 'created folder', target: f.name, at: f.created_at }),
    ),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return (
    <div className="px-8 py-7">
      <div>
        <h1 className="text-[26px] font-bold text-[#1A1C1E]">My Organisation</h1>
        <p className="mt-1 text-[14px] text-[#5F6368]">
          {session.org?.name ?? 'Your organisation'} — team members and recent activity
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Team members */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between border-b border-[#F0F0EC] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Team members</h2>
            <span className="text-[12px] text-[#9A9DA1]">
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
          </div>
          <div className="px-5">
            {members.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9A9DA1]">No team members yet.</p>
            ) : (
              members.map((m, i) => {
                const r = ROLE_STYLE[m.role] ?? ROLE_STYLE.member;
                const isYou = m.id === session.userId;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 py-3.5 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                      style={{ backgroundColor: r.bg, color: r.fg }}
                    >
                      {initials(m.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[#1A1C1E]">
                          {m.full_name || 'Teammate'}
                        </span>
                        {isYou ? (
                          <span className="rounded-full bg-[#1A1C1E] px-1.5 py-0.5 text-[10px] font-medium text-white">
                            You
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[12px] text-[#9A9DA1]">Joined {fmtDate(m.created_at)}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{ backgroundColor: r.bg, color: r.fg }}
                    >
                      {r.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity / edits */}
        <div className="rounded-2xl border border-[#E7E7E2] bg-white">
          <div className="flex items-center justify-between border-b border-[#F0F0EC] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Recent activity</h2>
            <span className="text-[12px] text-[#9A9DA1]">Who changed what</span>
          </div>
          <div className="px-5">
            {activity.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9A9DA1]">No activity yet.</p>
            ) : (
              activity.map((a, i) => (
                <div key={a.id} className={`flex items-start gap-3 py-3 ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1E5E54]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[#1A1C1E]">
                      <span className="font-medium">{a.who}</span> {a.action}{' '}
                      <span className="text-[#5F6368]">{a.target}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-[#9A9DA1]">{timeAgo(a.at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
