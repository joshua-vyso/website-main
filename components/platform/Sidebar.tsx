'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MODULES } from '@/lib/platform/modules';
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
  const { org, features } = usePlatform();
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#E7E7E2] bg-[#F6F6F4]">
      <div className="px-5 pb-4 pt-6">
        <VysoMark width={104} color="#D9730D" />
        <div className="mt-1 text-[12px] text-[#9A9DA1]">Operations platform</div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {MODULES.map((m) => {
          // A module is reachable only when it's active AND entitled.
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
      </nav>

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
