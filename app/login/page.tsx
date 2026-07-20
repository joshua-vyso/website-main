'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { supabaseConfigured } from '@/lib/platform/env';
import { VysoMark } from '@/components/platform/VysoMark';

/* Shared field chrome. Explicit rounded-[10px] rather than the rounded-* scale —
   globals set --radius: 0, which would square these. */
const FIELD =
  'w-full rounded-[10px] border border-[#ece7e0] bg-[#faf9f7] px-[14px] py-[13px] text-[15px] text-[#141310] outline-none transition duration-150 placeholder:text-[#b5ada3] focus:border-[#BE5D23] focus:bg-white focus:shadow-[0_0_0_3px_rgba(190,93,35,0.12)]';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div
      style={{ fontFamily: 'var(--font-inter)' }}
      className="flex min-h-screen flex-col bg-[#f4f1ec] text-[#141310] antialiased lg:flex-row"
    >
      {/* ── Left: editorial ─────────────────────────────────────────────────── */}
      <div className="hidden min-w-0 flex-1 flex-col justify-between px-[6vw] py-14 lg:flex">
        <VysoMark width={104} color="#141310" />

        <div className="max-w-[440px]">
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(40px, 5.4vw, 60px)',
              lineHeight: 0.98,
              letterSpacing: '-0.015em',
              textWrap: 'balance',
            }}
            className="m-0 mb-[18px] font-bold text-[#141310]"
          >
            Stop running your business on gut feel.
          </p>
          <p className="m-0 max-w-[360px] text-[15px] leading-[1.6] text-[#6b645c]">
            Sign in to track stock, log wastage, manage suppliers and watch your margins — live.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[12.5px] text-[#a39a90]">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#37A169]" />
          All systems operational
        </div>
      </div>

      {/* ── Right: form panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center border-[#eae4dc] bg-white px-[clamp(24px,6vw,64px)] py-14 lg:w-[min(46%,520px)] lg:flex-none lg:border-l lg:shadow-[-24px_0_60px_-40px_rgba(60,40,20,0.25)]">
        <div className="mx-auto w-full max-w-[340px]">
          {/* Mark only shows here on small screens — the editorial column owns it on desktop. */}
          <div className="mb-8 lg:hidden">
            <VysoMark width={96} color="#141310" />
          </div>

          <p
            style={{ fontFamily: 'var(--font-sans)' }}
            className="m-0 mb-1 text-[26px] font-semibold text-[#141310]"
          >
            Sign in
          </p>
          <p className="m-0 mb-[26px] text-[13.5px] text-[#8a837b]">
            Welcome back to your operations platform
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="email" className="mb-[7px] block text-[12.5px] font-medium text-[#57524c]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@company.com"
              className={`${FIELD} mb-[18px]`}
            />

            <div className="mb-[7px] flex items-baseline justify-between">
              <label htmlFor="password" className="text-[12.5px] font-medium text-[#57524c]">
                Password
              </label>
              <Link href="/contact" className="text-[12px] text-[#BE5D23] transition hover:text-[#9c4a1a]">
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••••"
              className={`${FIELD} mb-4`}
            />

            <label className="mb-[22px] flex cursor-pointer items-center gap-2 text-[12.5px] text-[#6b645c]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-[#BE5D23]"
              />
              Remember me on this device
            </label>

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 rounded-[10px] bg-[#FBEAE5] px-3 py-2.5 text-[13px] text-[#9E3412]"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full cursor-pointer rounded-[10px] bg-[#141310] py-[14px] text-[15px] font-semibold text-white transition hover:bg-[#2a2521] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>

          <div className="my-[22px] flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eae5de]" />
            <span className="text-[11px] text-[#a7a099]">OR</span>
            <div className="h-px flex-1 bg-[#eae5de]" />
          </div>

          <button
            type="button"
            onClick={() =>
              setError('Google sign-in isn’t enabled yet — please sign in with your email and password.')
            }
            className="w-full cursor-pointer rounded-[10px] border border-[#e3ded7] bg-white py-3 text-[15px] font-medium text-[#3a352f] transition hover:bg-[#faf9f7]"
          >
            Continue with Google
          </button>

          {!supabaseConfigured ? (
            <p className="mt-3 text-center text-[12px] text-[#a7a099]">
              Backend not configured yet — fill in <code>.env.local</code>.
            </p>
          ) : null}

          <p className="mt-6 text-center text-[12.5px] text-[#9a938c]">
            <Link href="/" className="text-[#BE5D23] transition hover:text-[#9c4a1a]">
              ← Back to vyso.co.za
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
