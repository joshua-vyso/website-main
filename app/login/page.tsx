'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { supabaseConfigured } from '@/lib/platform/env';
import { VysoMark } from '@/components/platform/VysoMark';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      className="flex min-h-screen items-center justify-center bg-[#F6F6F4] px-4 text-[#1A1C1E] antialiased"
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <VysoMark width={132} color="#D9730D" />
          <p className="mt-3 text-[14px] text-[#5F6368]">Sign in to your operations platform</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E7E7E2] bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-[13px] font-medium text-[#5F6368]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="mb-4 w-full rounded-xl border border-[#E7E7E2] bg-[#F6F6F4] px-4 py-3 text-[15px] outline-none transition focus:border-[#1E5E54] focus:bg-white"
          />

          <label className="mb-1.5 block text-[13px] font-medium text-[#5F6368]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#E7E7E2] bg-[#F6F6F4] px-4 py-3 text-[15px] outline-none transition focus:border-[#1E5E54] focus:bg-white"
          />

          {error ? (
            <div className="mt-4 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{ backgroundColor: '#1E5E54' }}
            className="mt-5 w-full rounded-xl py-3 text-[15px] font-semibold text-white transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>

          {!supabaseConfigured ? (
            <p className="mt-3 text-center text-[12px] text-[#9A9DA1]">
              Backend not configured yet — fill in <code>.env.local</code>.
            </p>
          ) : null}
        </form>

        <p className="mt-6 text-center text-[13px] text-[#9A9DA1]">
          <Link href="/" className="hover:text-[#5F6368]">
            ← Back to vyso.co.za
          </Link>
        </p>
      </div>
    </div>
  );
}
