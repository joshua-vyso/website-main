import gsap from "gsap";

// Logo SVG viewBox is "175 455 900 350" → aspect ratio 900/350
const ASPECT = 900 / 350;

// Must match Navbar.tsx constants so the logo crossfade is seamless
const LOGO_LEFT_PAD = 40;
const NAV_LOGO_W    = 120;

export function createMorphToNav(
  sloganEl: HTMLElement,
  logoEl:   HTMLElement,
  gooeyEl:  HTMLElement,
  onDone?:  () => void,
) {
  function play() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const morphW = Math.min(W * 0.55, 580);
    const scale  = NAV_LOGO_W / morphW;

    // Logo starts centered, blue coloured (paths use currentColor)
    gsap.set(logoEl, {
      position: "absolute",
      left: "50%", top: "50%",
      xPercent: -50, yPercent: -50,
      width: morphW,
      opacity: 0,
      filter: "blur(20px)",
      color: "#3375AE",   // SVG paths inherit this via fill="currentColor"
    });

    gsap.set(gooeyEl, { filter: "url(#gooey-morph)" });

    // ── Phase 1: slogan blurs out ────────────────────────────────────────────
    gsap.to(sloganEl, {
      filter: "blur(20px)",
      opacity: 0,
      duration: 0.65,
      ease: "power2.in",
    });

    // ── Phase 2: logo blurs in (blue) ───────────────────────────────────────
    gsap.to(logoEl, {
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.70,
      delay: 0.40,
      ease: "power2.out",
    });

    // ── Phase 3a: logo flies to top-left header position ─────────────────────
    const targetX = (LOGO_LEFT_PAD + NAV_LOGO_W / 2) - W / 2;
    const targetY = 32 - H / 2;

    gsap.to(logoEl, {
      x: targetX,
      y: targetY,
      scale,
      duration: 0.85,
      delay: 1.30,
      ease: "power3.inOut",
      onComplete: () => {
        gsap.set(gooeyEl, { filter: "none" });
        onDone?.();
      },
    });

    // ── Phase 3b: colour fades blue → black as logo settles ──────────────────
    gsap.to(logoEl, {
      color: "#0D0D0D",
      duration: 0.65,
      delay: 1.45,          // starts 0.15s into the flight
      ease: "power2.inOut",
    });
  }

  return { play };
}
