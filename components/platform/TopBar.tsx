'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MODULES } from '@/lib/platform/modules';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { clearParsedOrder } from '@/lib/ai/finch/order-handoff';
import { FeedbackModal } from './FeedbackModal';
import { ModuleLockNotice } from './ModuleLockNotice';
import { ModulesOverlay } from './ModulesOverlay';
import { VysoMark } from './VysoMark';

function initials(name: string | null | undefined): string {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "Trial · N days left" copy, singular/zero-aware. Callers only render this
 *  when `trial` is non-null and not expired — the TrialGate owns the expired
 *  state (see components/platform/TrialGate.tsx). */
function trialPillLabel(daysLeft: number | null): string {
  if (daysLeft === 0) return 'Trial ends today';
  if (daysLeft === 1) return 'Trial · 1 day left';
  return `Trial · ${daysLeft} days left`;
}

/** Name of the module the current route belongs to, for the "you are here" label. */
function useCurrentModuleLabel(): string | null {
  const pathname = usePathname() ?? '';
  if (pathname === '/app/serviceden' || pathname.startsWith('/app/serviceden/')) return 'ServiceDen';
  const hit = MODULES.find(
    (m) => pathname === m.screens.desktop || pathname.startsWith(`${m.screens.desktop}/`),
  );
  return hit?.label ?? null;
}

/**
 * Platform chrome. Replaces the old left sidebar: modules now live behind the
 * hamburger (see ModulesOverlay), and the account items the sidebar used to
 * hold — feedback, notifications, organisation, settings, sign out — sit on the
 * right of this bar.
 */
export function TopBar() {
  const { org, email, trial } = usePlatform();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const moduleLabel = useCurrentModuleLabel();

  const [modulesOpen, setModulesOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // The label of the locked module whose "unlock" notice is currently open.
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account dropdown on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  async function signOut() {
    // Clear the client-side parsed-order draft (customer + line items + prices) so it
    // can't survive sign-out into the next user's session on a shared workstation.
    clearParsedOrder();
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const notificationsActive =
    pathname === '/app/notifications' || pathname.startsWith('/app/notifications/');
  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#E4E9F0] bg-white text-[#3E4A57] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]';

  return (
    <>
      <header className="z-30 flex h-[66px] shrink-0 items-center gap-4 border-b border-[#E9EEF4] bg-white/90 px-6 backdrop-blur-[10px]">
        <button
          type="button"
          onClick={() => setModulesOpen(true)}
          aria-label="Open modules"
          aria-expanded={modulesOpen}
          title="Modules"
          className={iconBtn}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/app/docu" aria-label="Vyso home" className="flex shrink-0 items-center">
          <VysoMark width={92} color="#D9730D" />
        </Link>

        <span className="hidden border-l border-[#E4E9F0] pl-4 text-[13px] text-[#8A8E86] sm:block">
          {moduleLabel ?? 'Operations platform'}
        </span>

        {trial && !trial.expired ? (
          <Link
            href="/app/settings"
            className="hidden shrink-0 items-center rounded-full bg-[#EAF2FC] px-3 py-1 text-[12px] font-medium text-[#174C87] transition-colors hover:bg-[#DCEBFB] sm:inline-flex"
          >
            {trialPillLabel(trial.daysLeft)}
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setFeedbackOpen(true)} aria-label="Send feedback" title="Feedback" className={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 11a8 8 0 0 1 16 0v0a8 8 0 0 1-8 8H7l-4 3v-3.5" />
              <path d="M8 11h.01M12 11h.01M16 11h.01" />
            </svg>
          </button>

          <Link
            href="/app/notifications"
            aria-label="Notifications"
            title="Notifications"
            aria-current={notificationsActive ? 'page' : undefined}
            className={
              notificationsActive
                ? 'flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#C9DEF7] bg-[#EAF2FC] text-[#1F5FA8]'
                : iconBtn
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </Link>

          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              className="flex items-center gap-2.5 rounded-[11px] border border-[#E4E9F0] bg-white py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC]"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold"
                style={{ backgroundColor: '#EAF2FC', color: '#1F5FA8' }}
              >
                {initials(org?.name)}
              </span>
              <span className="hidden min-w-0 md:block">
                <span className="block max-w-[150px] truncate text-[13px] font-medium text-[#171A17]">
                  {org?.name ?? 'Your organisation'}
                </span>
                <span className="block max-w-[150px] truncate text-[11px] text-[#8A8E86]">{email ?? '—'}</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8E86" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {accountOpen ? (
              <div
                role="menu"
                className="vyso-pop-in absolute right-0 top-full z-40 mt-2 w-[236px] overflow-hidden rounded-xl border border-[#E4E9F0] bg-white py-1 shadow-[0_16px_50px_-12px_rgba(20,30,50,0.28)]"
              >
                <div className="border-b border-[#EEF1F5] px-3.5 pb-2 pt-2.5">
                  <div className="truncate text-[13px] font-medium text-[#171A17]">{org?.name ?? 'Your organisation'}</div>
                  <div className="truncate text-[12px] text-[#8A8E86]">{org?.location ?? '—'} · Founding client</div>
                </div>
                <Link
                  href="/app/organisation"
                  role="menuitem"
                  onClick={() => setAccountOpen(false)}
                  className="block px-3.5 py-2 text-[13px] text-[#171A17] transition-colors hover:bg-[#EAF2FC]"
                >
                  My Organisation
                </Link>
                <Link
                  href="/app/settings"
                  role="menuitem"
                  onClick={() => setAccountOpen(false)}
                  className="block px-3.5 py-2 text-[13px] text-[#171A17] transition-colors hover:bg-[#EAF2FC]"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    void signOut();
                  }}
                  className="block w-full px-3.5 py-2 text-left text-[13px] text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ModulesOverlay open={modulesOpen} onClose={() => setModulesOpen(false)} onLocked={setLockNotice} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ModuleLockNotice open={lockNotice !== null} moduleLabel={lockNotice ?? ''} onClose={() => setLockNotice(null)} />
    </>
  );
}
