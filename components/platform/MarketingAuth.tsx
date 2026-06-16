'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/platform/supabase-browser';

/** Tracks whether a Supabase session exists (marketing pages have no provider). */
function useMarketingSession(): boolean | null {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setAuthed(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return authed;
}

const ARROW = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Restrained nav "Log in" link — text + chevron, no fill. */
export function NavLoginLink({ style }: { style?: React.CSSProperties }) {
  return (
    <Link
      href="/login"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body, var(--font-sans))',
        fontSize: '0.88rem',
        fontWeight: 500,
        color: '#0d0d0d',
        textDecoration: 'none',
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      Log in
      {ARROW}
    </Link>
  );
}

/** Hero CTA — "Go to dashboard →" when authed, otherwise a quiet "Log in" link. */
export function HeroAuthCta() {
  const authed = useMarketingSession();
  if (authed === null) return <div style={{ height: 22 }} />;

  if (authed) {
    return (
      <Link
        href="/app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'var(--font-body, var(--font-sans))',
          fontWeight: 600,
          fontSize: '0.98rem',
          color: 'hsl(22,69%,40%)',
          textDecoration: 'none',
        }}
      >
        Go to dashboard
        {ARROW}
      </Link>
    );
  }
  return (
    <Link
      href="/login"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body, var(--font-sans))',
        fontWeight: 500,
        fontSize: '0.92rem',
        color: '#5F6368',
        textDecoration: 'none',
      }}
    >
      Already a client? <span style={{ color: '#0d0d0d', fontWeight: 600 }}>Log in</span>
    </Link>
  );
}
