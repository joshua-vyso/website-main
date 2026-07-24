'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { supabaseConfigured } from '@/lib/platform/env';
import { VysoMark } from '@/components/platform/VysoMark';

/* Shared field chrome. Explicit rounded-[10px] rather than the rounded-* scale —
   globals set --radius: 0, which would square these. */
const FIELD =
  'w-full rounded-[10px] border border-[#ece7e0] bg-[#faf9f7] px-[14px] py-[13px] text-[15px] text-[#141310] outline-none transition duration-150 placeholder:text-[#b5ada3] focus:border-[#BE5D23] focus:bg-white focus:shadow-[0_0_0_3px_rgba(190,93,35,0.12)]';

const LABEL = 'mb-[7px] block text-[12.5px] font-medium text-[#57524c]';

type Pane = 'login' | 'signup' | 'verify';

// Email OTP length — env-overridable, defaults to 8 to match the current Supabase setting.
const CODE_LENGTH = Number(process.env.NEXT_PUBLIC_OTP_LENGTH) || 8;

export default function LoginPage() {
  const router = useRouter();
  const [pane, setPane] = useState<Pane>('login');

  // Login pane
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  // Signup pane
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verify pane
  const [verifyEmail, setVerifyEmail] = useState('');
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [cooldown, setCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function goTo(next: Pane) {
    setPane(next);
    setError(null);
    setInfo(null);
  }

  // ── Login (existing behavior, unchanged) ────────────────────────────────
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

  // ── Signup ──────────────────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    setLoading(true);
    const cleanEmail = signupEmail.trim();
    const { error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: signupPassword,
      options: { data: { full_name: fullName.trim() } },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Anti-enumeration: Supabase returns success whether or not the email is new.
    setVerifyEmail(cleanEmail);
    setCode(Array(CODE_LENGTH).fill(''));
    setPane('verify');
    setInfo(`If this email is new you'll receive a ${CODE_LENGTH}-digit code. If you already have an account, log in instead.`);
    setCooldown(60);
  }

  // ── Verify (OTP) ────────────────────────────────────────────────────────
  function setCodeAt(i: number, value: string) {
    setCode((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function fillCode(digits: string) {
    const next = Array(CODE_LENGTH).fill('');
    for (let j = 0; j < CODE_LENGTH; j += 1) next[j] = digits[j] ?? '';
    setCode(next);
    const focusIdx = Math.min(digits.length, CODE_LENGTH - 1);
    codeInputsRef.current[focusIdx]?.focus();
  }

  function handleCodeChange(i: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 1) {
      // Multi-char (e.g. a paste landing in one box) → spread across boxes.
      fillCode(digits.slice(0, CODE_LENGTH));
      return;
    }
    setCodeAt(i, digits);
    if (digits && i < CODE_LENGTH - 1) codeInputsRef.current[i + 1]?.focus();
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (code[i]) {
        setCodeAt(i, '');
      } else if (i > 0) {
        codeInputsRef.current[i - 1]?.focus();
        setCodeAt(i - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      codeInputsRef.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      codeInputsRef.current[i + 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!text) return;
    e.preventDefault();
    fillCode(text);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = code.join('');
    if (token.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token,
      type: 'signup',
    });
    setLoading(false);

    if (verifyError) {
      setError('That code is incorrect or has expired. Check the latest email or resend a new code.');
      return;
    }
    router.push('/onboarding');
    router.refresh();
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);

    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and ANON_KEY to .env.local.');
      return;
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: verifyEmail,
    });
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setCooldown(60);
    setInfo('A new code is on its way.');
  }

  const heading =
    pane === 'signup' ? 'Create your account' : pane === 'verify' ? 'Check your email' : 'Sign in';
  const subheading =
    pane === 'signup'
      ? 'Start your 14-day free trial'
      : pane === 'verify'
        ? `Enter the ${CODE_LENGTH}-digit code we sent to ${verifyEmail || 'your email'}`
        : 'Welcome back to your operations platform';

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
            {heading}
          </p>
          <p className="m-0 mb-[26px] text-[13.5px] text-[#8a837b]">{subheading}</p>

          {/* ── LOGIN PANE (behavior unchanged) ─────────────────────────────── */}
          {pane === 'login' ? (
            <>
              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="email" className={LABEL}>
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

              <p className="mt-5 text-center text-[12.5px] text-[#6b645c]">
                New to Vyso?{' '}
                <button
                  type="button"
                  onClick={() => goTo('signup')}
                  className="cursor-pointer font-semibold text-[#BE5D23] transition hover:text-[#9c4a1a]"
                >
                  Create an account
                </button>
              </p>
            </>
          ) : null}

          {/* ── SIGNUP PANE ─────────────────────────────────────────────────── */}
          {pane === 'signup' ? (
            <>
              <form onSubmit={handleSignup} noValidate>
                <label htmlFor="fullName" className={LABEL}>
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="Alex Mokoena"
                  className={`${FIELD} mb-[18px]`}
                />

                <label htmlFor="signupEmail" className={LABEL}>
                  Work email
                </label>
                <input
                  id="signupEmail"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className={`${FIELD} mb-[18px]`}
                />

                <label htmlFor="signupPassword" className={LABEL}>
                  Password
                </label>
                <input
                  id="signupPassword"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className={`${FIELD} mb-[18px]`}
                />

                <label htmlFor="confirmPassword" className={LABEL}>
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Re-enter your password"
                  className={`${FIELD} mb-[22px]`}
                />

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
                  disabled={loading || !supabaseConfigured || !fullName || !signupEmail || !signupPassword || !confirmPassword}
                  className="w-full cursor-pointer rounded-[10px] bg-[#141310] py-[14px] text-[15px] font-semibold text-white transition hover:bg-[#2a2521] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Creating account…' : 'Start your 14-day free trial'}
                </button>
              </form>

              <p className="mt-4 text-center text-[11.5px] leading-[1.5] text-[#a7a099]">
                By continuing you agree to Vyso&apos;s terms. No card required to start your trial.
              </p>

              <p className="mt-4 text-center text-[12.5px] text-[#6b645c]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => goTo('login')}
                  className="cursor-pointer font-semibold text-[#BE5D23] transition hover:text-[#9c4a1a]"
                >
                  Log in
                </button>
              </p>
            </>
          ) : null}

          {/* ── VERIFY PANE ─────────────────────────────────────────────────── */}
          {pane === 'verify' ? (
            <>
              <form onSubmit={handleVerify} noValidate>
                <div className="mb-[18px] flex flex-wrap justify-between gap-[6px]" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        codeInputsRef.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                      className="h-[54px] min-w-0 flex-1 rounded-[10px] border border-[#ece7e0] bg-[#faf9f7] text-center text-[20px] font-semibold text-[#141310] outline-none transition duration-150 focus:border-[#BE5D23] focus:bg-white focus:shadow-[0_0_0_3px_rgba(190,93,35,0.12)]"
                    />
                  ))}
                </div>

                {info ? (
                  <div
                    aria-live="polite"
                    className="mb-4 rounded-[10px] bg-[#F3F0EA] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[#6b645c]"
                  >
                    {info}
                  </div>
                ) : null}

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
                  disabled={loading || !supabaseConfigured || code.join('').length !== CODE_LENGTH}
                  className="w-full cursor-pointer rounded-[10px] bg-[#141310] py-[14px] text-[15px] font-semibold text-white transition hover:bg-[#2a2521] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>
              </form>

              <div className="mt-5 text-center text-[12.5px] text-[#6b645c]">
                Didn&apos;t get it?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || !supabaseConfigured}
                  className="cursor-pointer font-semibold text-[#BE5D23] transition hover:text-[#9c4a1a] disabled:cursor-not-allowed disabled:text-[#c6bcb0]"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>

              <p className="mt-3 text-center text-[12.5px] text-[#9a938c]">
                Wrong email?{' '}
                <button
                  type="button"
                  onClick={() => goTo('signup')}
                  className="cursor-pointer font-medium text-[#6b645c] underline transition hover:text-[#141310]"
                >
                  Start over
                </button>
              </p>
            </>
          ) : null}

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
