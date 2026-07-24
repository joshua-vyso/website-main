'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * The Finch mark — a minimalist single-line bird in profile, facing right.
 * Stroked (never filled) with a cornflower-blue → warm-orange gradient running
 * top-left to bottom-right, so the head/tail read cooler and the beak/belly/leg
 * read warmer. Reused at small size next to the Finch name (button, modal
 * header) and larger with `animate="draw"` in the onboarding panel.
 *
 * `animate="draw"` plays a one-time stroke draw-in on mount (~0.9s ease-out)
 * followed by a gentle settle pop, then goes static — never loops. Honours
 * `prefers-reduced-motion` by skipping straight to the final frame. The idle
 * (`animate="none"`, the default) state is always static.
 */
export function FinchMark({
  size = 20,
  title = 'Finch',
  animate = 'none',
}: {
  size?: number;
  title?: string;
  animate?: 'draw' | 'none';
}) {
  const gradientId = `finch-mark-gradient-${useId()}`;
  const pathRef = useRef<SVGPathElement>(null);
  // Settled immediately for the static (default) case; the draw case flips
  // this on once the draw-in animation has run so the settle pop can play.
  const [settled, setSettled] = useState(animate !== 'draw');

  useEffect(() => {
    if (animate !== 'draw') return;
    const path = pathRef.current;
    if (!path) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setSettled(true);
      return;
    }

    const length = path.getTotalLength();
    path.style.transition = 'none';
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    // Force a reflow so the browser registers the starting offset before the
    // transition is enabled — otherwise it can jump straight to the end.
    void path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 0.9s ease-out';
    path.style.strokeDashoffset = '0';

    const t = window.setTimeout(() => setSettled(true), 900);
    return () => window.clearTimeout(t);
  }, [animate]);

  // Decorative when there's no title (e.g. sitting inside an already-labelled
  // button) — hide it from the accessibility tree instead of announcing nothing.
  const decorative = !title;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      className={animate === 'draw' && settled ? 'finch-mark-settle' : undefined}
    >
      {decorative ? null : <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6C9BE0" />
          <stop offset="100%" stopColor="#F0873C" />
        </linearGradient>
      </defs>
      {/* Head, beak, back and the long, pointed tail — one continuous contour. */}
      <path
        ref={pathRef}
        d="M94,36 C86,24 78,18 74,24 C68,14 56,8 46,18 C32,26 18,36 8,66 C15,75 22,79 31,71 C40,64 44,55 45,46 C46,38 52,32 60,28 C66,25 71,25 74,24"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Leaf-shaped wing curve, inside the body. */}
      <path
        d="M60,32 C50,34 42,42 38,52 C46,46 56,40 60,32"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* One short leg. */}
      <path
        d="M46,64 L44,80"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* A detached horizontal base line beneath the body. */}
      <line x1="26" y1="86" x2="62" y2="86" stroke={`url(#${gradientId})`} strokeWidth={2.2} strokeLinecap="round" />
      {/* Dot eye — filled, not stroked. */}
      <circle cx="70" cy="20" r="2.2" fill="#7E93B8" />
    </svg>
  );
}
