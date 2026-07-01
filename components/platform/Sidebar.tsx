'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MODULES } from '@/lib/platform/modules';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { AppIcon } from './AppIcon';
import { VysoMark } from './VysoMark';

function initials(name: string | null | undefined): string {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Sidebar() {
  const { org, features, email } = usePlatform();
  const pathname = usePathname();
  const router = useRouter();
  const serviceDenActive = pathname === '/app/serviceden' || pathname.startsWith('/app/serviceden/');

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-[#E7E7E2] bg-[#F6F6F4]">
      <div className="px-5 pb-4 pt-6">
        <VysoMark width={104} color="#D9730D" />
        <div className="mt-1 text-[12px] text-[#9A9DA1]">Operations platform</div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {MODULES.map((m) => {
          // Reachable only when active AND entitled. Entitlement is currently
          // forced on for every org in getPlatformSession (testing) — re-gate
          // there per-org to restore plan-based access.
          const enabled = m.status === 'active' && features[m.key];
          const active =
            pathname === m.screens.desktop || pathname.startsWith(`${m.screens.desktop}/`);
          const content = (
            <>
              <AppIcon name={m.icon} size={26} />
              <span className="flex-1">{m.label}</span>
              {!enabled ? <span className="text-[11px] text-[#9A9DA1]">soon</span> : null}
            </>
          );
          const base =
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors';
          if (!enabled) {
            return (
              <div key={m.key} className={`${base} cursor-default text-[#9A9DA1]`} aria-disabled>
                {content}
              </div>
            );
          }
          return (
            <Link
              key={m.key}
              href={m.screens.desktop}
              className={`${base} ${active ? 'bg-[#E6F0FB] text-[#1A1C1E]' : 'text-[#1A1C1E] hover:bg-black/[0.03]'}`}
            >
              {content}
            </Link>
          );
        })}

        {/* ServiceDen — private to Vyso's own account (email-gated, not in the shared registry). */}
        {email === SERVICEDEN_ACCOUNT_EMAIL ? (
          <Link
            href="/app/serviceden"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${serviceDenActive ? 'bg-[#E6F0FB] text-[#1A1C1E]' : 'text-[#1A1C1E] hover:bg-black/[0.03]'}`}
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <path d="M2 13h20" />
              </svg>
            </span>
            <span className="flex-1">ServiceDen</span>
          </Link>
        ) : null}
      </nav>

      <div className="space-y-1 px-3 pb-1">
        <Link
          href="/app/organisation"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
            pathname === '/app/organisation' || pathname.startsWith('/app/organisation/')
              ? 'bg-[#E6F0FB] text-[#1A1C1E]'
              : 'text-[#1A1C1E] hover:bg-black/[0.03]'
          }`}
        >
          <span className="flex h-[26px] w-[26px] items-center justify-center" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <span className="flex-1">My Organisation</span>
        </Link>
        <Link
          href="/app/notifications"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
            pathname === '/app/notifications' || pathname.startsWith('/app/notifications/')
              ? 'bg-[#E6F0FB] text-[#1A1C1E]'
              : 'text-[#1A1C1E] hover:bg-black/[0.03]'
          }`}
        >
          <span className="flex h-[26px] w-[26px] items-center justify-center" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <span className="flex-1">Notifications</span>
        </Link>
      </div>

      <div className="border-t border-[#E7E7E2] p-3">
        <div className="mb-2 flex items-center gap-3 px-1">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-semibold"
            style={{ backgroundColor: '#E3F0ED', color: '#1E5E54' }}
          >
            {initials(org?.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[#1A1C1E]">
              {org?.name ?? 'Your organisation'}
            </div>
            <div className="truncate text-[12px] text-[#9A9DA1]">
              {org?.location ?? '—'} · Founding client
            </div>
          </div>
        </div>
        <Link
          href="/app/settings"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            pathname === '/app/settings' || pathname.startsWith('/app/settings/')
              ? 'bg-[#E6F0FB] text-[#1A1C1E]'
              : 'text-[#1A1C1E] hover:bg-black/[0.03]'
          }`}
        >
          <span className="flex h-4 w-4 items-center justify-center" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          <span className="flex-1">Settings</span>
        </Link>
        <button
          onClick={signOut}
          className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
