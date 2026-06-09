"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  className?: string;
  textClassName?: string;
  /** Controlled index — change this to trigger a gooey morph to texts[currentIndex] */
  currentIndex?: number;
}

export function GooeyText({
  texts,
  morphTime = 1.2,
  className,
  textClassName,
  currentIndex = 0,
}: GooeyTextProps) {
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);

  // Internal morph state — no re-renders, updated directly in RAF loop
  const stateRef = React.useRef({
    morph: 0,
    animating: false,
    displayedIndex: 0,
    prevTime: 0,
  });

  // Set initial text (text2 = texts[0] fully visible, text1 empty/hidden)
  React.useEffect(() => {
    if (!text1Ref.current || !text2Ref.current) return;
    text2Ref.current.textContent = texts[0];
    text1Ref.current.textContent = texts[0];
    text2Ref.current.style.opacity = "100%";
    text2Ref.current.style.filter = "";
    text1Ref.current.style.opacity = "0%";
    text1Ref.current.style.filter = "";
    stateRef.current.displayedIndex = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When currentIndex changes externally, kick off a morph
  React.useEffect(() => {
    const s = stateRef.current;
    if (currentIndex === s.displayedIndex) return;
    if (!text1Ref.current || !text2Ref.current) return;

    // text1 = outgoing (what's currently shown), text2 = incoming (new text)
    text1Ref.current.textContent = texts[s.displayedIndex];
    text2Ref.current.textContent = texts[currentIndex];
    text1Ref.current.style.filter = "";
    text2Ref.current.style.filter = "";
    text1Ref.current.style.opacity = "100%";
    text2Ref.current.style.opacity = "0%";

    s.displayedIndex = currentIndex;
    s.morph = 0;
    s.animating = true;
    s.prevTime = performance.now();
  }, [currentIndex, texts]);

  // RAF loop — only does work when s.animating is true
  React.useEffect(() => {
    let rafId: number;

    function animate(now: number) {
      rafId = requestAnimationFrame(animate);
      const s = stateRef.current;

      if (!s.animating) {
        s.prevTime = now;
        return;
      }

      const dt = (now - s.prevTime) / 1000;
      s.prevTime = now;
      s.morph += dt;

      const fraction = Math.min(s.morph / morphTime, 1);

      if (!text1Ref.current || !text2Ref.current) return;

      if (fraction >= 1) {
        // Morph complete — show text2 cleanly
        s.animating = false;
        text1Ref.current.style.opacity = "0%";
        text1Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text2Ref.current.style.filter = "";
        return;
      }

      // text2 fading in (new word)
      text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      // text1 fading out (old word)
      const invFraction = 1 - fraction;
      text1Ref.current.style.filter = `blur(${Math.min(8 / invFraction - 8, 100)}px)`;
      text1Ref.current.style.opacity = `${Math.pow(invFraction, 0.4) * 100}%`;
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [morphTime]);

  // Longest text acts as an invisible spacer so the container has natural width
  const longestText = texts.reduce((a, b) => (a.length >= b.length ? a : b), "");

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Filter definition — inline SVG, zero-size, just provides the gooey threshold */}
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gooey-morph-filter">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      {/* Filter wrapper — morphing happens here */}
      <div
        className="relative flex items-center"
        style={{ filter: "url(#gooey-morph-filter)" }}
      >
        {/* Invisible spacer: sizes the box to the longest word, no layout jank */}
        <span
          className={cn("invisible select-none", textClassName)}
          aria-hidden="true"
        >
          {longestText}
        </span>

        {/* text1 — outgoing word (fades out) */}
        <span
          ref={text1Ref}
          className={cn(
            "absolute inset-0 flex items-center select-none",
            textClassName
          )}
          style={{ opacity: "0%" }}
        />

        {/* text2 — incoming word (fades in, also the initial visible text) */}
        <span
          ref={text2Ref}
          className={cn(
            "absolute inset-0 flex items-center select-none",
            textClassName
          )}
          style={{ opacity: "100%" }}
        />
      </div>
    </div>
  );
}
