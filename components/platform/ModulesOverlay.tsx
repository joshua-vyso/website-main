'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULES } from '@/lib/platform/modules';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { usePlatform } from '@/lib/platform/session';
import { AppIcon } from './AppIcon';

/**
 * The module switcher, opened from the top bar's hamburger. It replaces the old
 * always-on sidebar, so it carries the same three row states the sidebar had:
 * an entitled module links, a `soon` module is inert, and a module the org's
 * plan excludes becomes an unlock prompt handled by the caller.
 */
export function ModulesOverlay({
  open,
  onClose,
  onLocked,
}: {
  open: boolean;
  onClose: () => void;
  onLocked: (moduleLabel: string) => void;
}) {
  const { features, email, lockedModules } = usePlatform();
  const pathname = usePathname() ?? '';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const serviceDenActive = pathname === '/app/serviceden' || pathname.startsWith('/app/serviceden/');
  const card =
    'flex items-center gap-3 rounded-[14px] border p-[15px] text-left transition-colors';

  return (
    <div
      onClick={onClose}
      className="vyso-fade-in fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-[#171E28]/32 px-4 py-[88px] backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Vyso modules"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="vyso-pop-in w-[920px] max-w-[92vw] rounded-[20px] border border-[#E9EEF4] bg-white px-[30px] py-7 shadow-[0_30px_80px_-20px_rgba(20,30,50,0.4)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="of-display text-[20px] font-semibold text-[#171A17]">Vyso modules</h2>
            <p className="mt-1 text-[13px] text-[#8A8E86]">Jump to any tool in your operations platform</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modules"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E9F0] bg-white text-[16px] text-[#6B6F68] transition-colors hover:bg-[#F3F5F8]"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            // Entitlement is currently forced on for every org in
            // getPlatformSession (testing) — re-gate there to restore plans.
            const enabled = m.status === 'active' && features[m.key];
            const locked = lockedModules.includes(m.key);
            const active =
              pathname === m.screens.desktop || pathname.startsWith(`${m.screens.desktop}/`);

            if (locked) {
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    onClose();
                    onLocked(m.label);
                  }}
                  className={`${card} w-full border-[#EEF1F5] hover:border-[#C9DEF7] hover:bg-[#EAF2FC]`}
                >
                  <AppIcon name={m.icon} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[#8A8E86]">{m.label}</span>
                    <span className="block truncate text-[12px] text-[#9BA0A8]">{m.description}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#8A8E86]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Unlock
                  </span>
                </button>
              );
            }

            if (!enabled) {
              return (
                <div key={m.key} className={`${card} cursor-default border-[#EEF1F5] bg-[#FBFBFA]`} aria-disabled>
                  <AppIcon name={m.icon} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[#8A8E86]">{m.label}</span>
                    <span className="block truncate text-[12px] text-[#9BA0A8]">{m.description}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[#8A8E86]">soon</span>
                </div>
              );
            }

            return (
              <Link
                key={m.key}
                href={m.screens.desktop}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`${card} ${
                  active
                    ? 'border-[#C9DEF7] bg-gradient-to-br from-[#EAF2FC] to-white'
                    : 'border-[#EEF1F5] hover:border-[#C9DEF7] hover:bg-[#EAF2FC]'
                }`}
              >
                <AppIcon name={m.icon} size={30} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] font-semibold ${active ? 'text-[#1F5FA8]' : 'text-[#171A17]'}`}>
                    {m.label}
                  </span>
                  <span className={`block truncate text-[12px] ${active ? 'text-[#5C7B9E]' : 'text-[#9BA0A8]'}`}>
                    {active ? `Current · ${m.description}` : m.description}
                  </span>
                </span>
              </Link>
            );
          })}

          {/* ServiceDen — private to Vyso's own account (email-gated, not in the shared registry). */}
          {email === SERVICEDEN_ACCOUNT_EMAIL ? (
            <Link
              href="/app/serviceden"
              onClick={onClose}
              aria-current={serviceDenActive ? 'page' : undefined}
              className={`${card} ${
                serviceDenActive
                  ? 'border-[#C9DEF7] bg-gradient-to-br from-[#EAF2FC] to-white'
                  : 'border-[#EEF1F5] hover:border-[#C9DEF7] hover:bg-[#EAF2FC]'
              }`}
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center text-[#6B6F68]" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <path d="M2 13h20" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[14px] font-semibold ${serviceDenActive ? 'text-[#1F5FA8]' : 'text-[#171A17]'}`}>
                  ServiceDen
                </span>
                <span className={`block truncate text-[12px] ${serviceDenActive ? 'text-[#5C7B9E]' : 'text-[#9BA0A8]'}`}>
                  Service business
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
