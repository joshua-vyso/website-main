"use client";
import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

import { createBounceAnimator } from "./animations/bounce";
import { SmokyBackground }      from "./SmokyBackground";
import { DOT_SIZE }              from "./animations/constants";

/* ── Navbar logo geometry — must match Navbar.tsx ── */
const LOGO_LEFT_PAD = 40;
const NAV_LOGO_W    = 120;
const NAV_LOGO_H    = NAV_LOGO_W / (900 / 350); // ≈ 46.67 px
const NAV_H         = 64;
const LOGO_CENTER_W = 220; // px — width of logo in the centred reveal step

/* ── Orange-gradient Vyso wordmark ───────────────────────────────────────── */
function VysoWordmark({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="215 497 825 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="vyso-intro-grad"
          x1="215" y1="497" x2="1040" y2="757"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="hsl(30,82%,57%)"  />
          <stop offset="50%"  stopColor="hsl(22,69%,44%)"  />
          <stop offset="100%" stopColor="hsl(14,72%,36%)"  />
        </linearGradient>
      </defs>
      <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z"                       fill="url(#vyso-intro-grad)"/>
      <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z"                           fill="url(#vyso-intro-grad)"/>
      <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z"                             fill="url(#vyso-intro-grad)"/>
      <path
        d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
        stroke="url(#vyso-intro-grad)" strokeWidth="33" strokeMiterlimit="10" strokeLinejoin="round"
      />
      <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z"       fill="url(#vyso-intro-grad)"/>
      <path d="M853 503.5V535.5"                                                           stroke="url(#vyso-intro-grad)"/>
      <path d="M580 692.5L578.5 660.5L559 692.5H580Z"                                     fill="url(#vyso-intro-grad)"/>
      <path d="M938.5 696C991.243 696 1034 652.795 1034 599.5C1034 546.205 991.243 503 938.5 503C885.757 503 843 546.205 843 599.5C843 652.795 885.757 696 938.5 696Z"
        fill="url(#vyso-intro-grad)"
      />
    </svg>
  );
}

/* ── Black Vyso wordmark (same paths, solid #0d0d0d) ─────────────────────── */
function VysoBlackWordmark({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="215 497 825 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z"                       fill="#0d0d0d"/>
      <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z"                           fill="#0d0d0d"/>
      <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z"                             fill="#0d0d0d"/>
      <path
        d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
        stroke="#0d0d0d" strokeWidth="33" strokeMiterlimit="10" strokeLinejoin="round"
      />
      <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z"       fill="#0d0d0d"/>
      <path d="M853 503.5V535.5"                                                           stroke="#0d0d0d"/>
      <path d="M580 692.5L578.5 660.5L559 692.5H580Z"                                     fill="#0d0d0d"/>
      <path d="M938.5 696C991.243 696 1034 652.795 1034 599.5C1034 546.205 991.243 503 938.5 503C885.757 503 843 546.205 843 599.5C843 652.795 885.757 696 938.5 696Z"
        fill="#0d0d0d"
      />
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────────────── */
interface BounceDotProps { onComplete?: () => void }

export function BounceDot({ onComplete }: BounceDotProps) {
  const rootRef        = useRef<HTMLDivElement>(null);
  const dotRef         = useRef<HTMLDivElement>(null);
  const smokyRef       = useRef<HTMLDivElement>(null);
  const questionRef    = useRef<HTMLDivElement>(null);
  const whiteBgRef     = useRef<HTMLDivElement>(null);
  const logoRef        = useRef<HTMLDivElement>(null);
  const logoOrangeRef  = useRef<HTMLDivElement>(null);
  const logoBlackRef   = useRef<HTMLDivElement>(null);

  const clickedRef  = useRef(false);
  const bounceRef   = useRef<ReturnType<typeof createBounceAnimator> | null>(null);
  const onDoneRef   = useRef(onComplete);
  useEffect(() => { onDoneRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const bounce = createBounceAnimator(dotRef.current!);
    bounceRef.current = bounce;
    bounce.start();

    // Question text fades in after 1.8 s
    const timer = setTimeout(() => {
      if (questionRef.current) {
        gsap.to(questionRef.current, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" });
      }
    }, 1800);

    return () => { bounce.cleanup(); clearTimeout(timer); };
  }, []);

  const handleClick = useCallback(() => {
    if (clickedRef.current) return;
    clickedRef.current = true;

    // ── 1. Fade out question + smoke ────────────────────────────────────────
    if (questionRef.current) {
      gsap.to(questionRef.current, { opacity: 0, y: 8, duration: 0.25 });
    }
    if (smokyRef.current) {
      gsap.to(smokyRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" });
    }

    // ── 2. Zoom the dot (portal into white) ─────────────────────────────────
    bounceRef.current?.stop();
    gsap.set(dotRef.current,  { y: 0, pointerEvents: "none", zIndex: 500 });
    gsap.to(dotRef.current, {
      scale: 38, duration: 1.05, ease: "power2.in",
      onComplete: () => {
        // Dot has filled the screen — swap for solid white bg
        gsap.set(dotRef.current, { opacity: 0 });
        gsap.to(whiteBgRef.current, { opacity: 1, duration: 0.2 });

        // ── 3. Vyso logo fades in at screen centre ───────────────────────────
        const logo = logoRef.current!;
        gsap.set(logo, {
          position:  "fixed",
          left:      "50%",
          top:       "50%",
          xPercent:  -50,
          yPercent:  -50,
          width:     LOGO_CENTER_W,
          opacity:   0,
          zIndex:    650,
        });
        gsap.to(logo, {
          opacity:  1,
          duration: 0.55,
          delay:    0.15,
          ease:     "power2.out",

          // ── 4. Logo shrinks + glides to navbar + orange → black ───────────────
          onComplete: () => {
            const targetTop = (NAV_H - NAV_LOGO_H) / 2;

            // Colour crossfade: orange fades out, black fades in (parallel with move)
            gsap.to(logoOrangeRef.current, {
              opacity:  0,
              duration: 0.55,
              delay:    0.45,   // start slightly after motion begins
              ease:     "power2.inOut",
            });
            gsap.to(logoBlackRef.current, {
              opacity:  1,
              duration: 0.55,
              delay:    0.45,
              ease:     "power2.inOut",
            });

            // Wrapper: move + shrink
            gsap.to(logo, {
              left:     LOGO_LEFT_PAD,
              top:      targetTop,
              width:    NAV_LOGO_W,
              xPercent: 0,
              yPercent: 0,
              duration: 0.78,
              delay:    0.35,
              ease:     "power3.inOut",
              onComplete: () => {
                // ── 5. Reveal site, fade out overlay ──────────────────────────
                onDoneRef.current?.();
                gsap.to(rootRef.current, {
                  opacity:    0,
                  duration:   0.5,
                  ease:       "power2.inOut",
                  onComplete: () => {
                    if (rootRef.current) rootRef.current.style.display = "none";
                  },
                });
              },
            });
          },
        });
      },
    });
  }, []);

  return (
    <div
      ref={rootRef}
      style={{
        position:   "fixed",
        inset:      0,
        background: "#000",
        zIndex:     700,
        overflow:   "hidden",
      }}
      aria-label="Vyso intro"
    >
      {/* Smoky WebGL background */}
      <div ref={smokyRef} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <SmokyBackground />
      </div>

      {/* Clickable white dot (the "O" of Vyso) */}
      <div
        ref={dotRef}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
        tabIndex={0}
        role="button"
        aria-label="Enter Vyso"
        style={{
          position:     "fixed",
          left:         "50%",
          top:          "50%",
          marginLeft:   -(DOT_SIZE / 2),
          marginTop:    -(DOT_SIZE / 2),
          width:        DOT_SIZE,
          height:       DOT_SIZE,
          borderRadius: "50%",
          background:   "#FFFFFF",
          cursor:       "pointer",
          outline:      "none",
          zIndex:       1,
          willChange:   "transform",
        }}
      />

      {/* Question text below dot */}
      <div
        ref={questionRef}
        style={{
          position:      "fixed",
          left:          "50%",
          top:           `calc(50% + ${DOT_SIZE / 2 + 22}px)`,
          transform:     "translateX(-50%) translateY(8px)",
          opacity:       0,
          zIndex:        2,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           "0.4rem",
          pointerEvents: "none",
        }}
      >
        <div className="question-arrow">
          <svg width="22" height="32" viewBox="0 0 22 32" fill="none" aria-hidden="true">
            <line x1="11" y1="32" x2="11" y2="8" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4"/>
            <path d="M4 16 L11 4 L18 16" fill="none" stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p style={{
          fontFamily:    "var(--font-body, var(--font-sans))",
          fontSize:      "0.78rem",
          fontWeight:    400,
          letterSpacing: "0.12em",
          color:         "rgba(255,255,255,0.52)",
          margin:        0,
          whiteSpace:    "nowrap",
          textTransform: "uppercase",
        }}>
          What is your business trying to tell you?
        </p>
      </div>

      {/* White flash that fills the screen as the dot zooms */}
      <div
        ref={whiteBgRef}
        style={{
          position:      "fixed",
          inset:         0,
          background:    "#FFFFFF",
          zIndex:        600,
          opacity:       0,
          pointerEvents: "none",
        }}
      />

      {/* Vyso logo — fades in centred, then flies to nav (GSAP-positioned).
          Two layers stacked: orange underneath, black on top (opacity:0).
          During fly-to-nav the crossfade tweens swap their opacities. */}
      <div
        ref={logoRef}
        style={{ opacity: 0, pointerEvents: "none", position: "relative" }}
      >
        {/* Orange gradient layer — visible at State A */}
        <div ref={logoOrangeRef}>
          <VysoWordmark style={{ width: "100%", height: "auto", display: "block" }} />
        </div>

        {/* Black layer — absolutely covers orange, fades in during move to State B */}
        <div
          ref={logoBlackRef}
          style={{ position: "absolute", inset: 0, opacity: 0 }}
        >
          <VysoBlackWordmark style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
      </div>
    </div>
  );
}
