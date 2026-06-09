import gsap from "gsap";

// Must match Navbar.tsx
const LOGO_LEFT_PAD = 40;
const NAV_LOGO_W    = 120;
const NAV_LOGO_H    = NAV_LOGO_W / (900 / 350); // ~46.67px
const NAV_H         = 64;

/**
 * Directly morphs the in-slot Vyso SVG to the top-left header position —
 * no intermediate "large logo at center" step.
 *
 * Strategy:
 *  1. Get the slot element's current viewport rect.
 *  2. Re-parent it visually via position:fixed (escapes any layout context).
 *  3. Blur-fade the text line.
 *  4. Fly the fixed slot logo to the header while colour fades blue → black.
 */
export function createSlotMorphToNav(
  sloganTextEl: HTMLElement,   // "Your operations partner," line only
  logoSlotEl:   HTMLElement,   // logoInSlotRef wrapper div (color:#3375AE, currentColor SVG)
  onDone?:      () => void,
) {
  function play() {
    const rect       = logoSlotEl.getBoundingClientRect();
    const targetTop  = (NAV_H - NAV_LOGO_H) / 2; // vertically centred in header

    // ── Lift slot logo to fixed position (visually identical to now) ─────────
    // Reset GSAP transforms (xPercent from wordCycle centering) so that
    // left/top map 1:1 to viewport coordinates.
    gsap.set(logoSlotEl, {
      position: "fixed",
      left:     rect.left,
      top:      rect.top,
      width:    rect.width,
      height:   rect.height,
      xPercent: 0,
      yPercent: 0,
      x:        0,
      y:        0,
      zIndex:   750,
      margin:   0,
      padding:  0,
    });

    // ── Blur out the text line ───────────────────────────────────────────────
    gsap.to(sloganTextEl, {
      filter:   "blur(16px)",
      opacity:  0,
      duration: 0.5,
      ease:     "power2.in",
    });

    // ── Fly to header ────────────────────────────────────────────────────────
    gsap.to(logoSlotEl, {
      left:     LOGO_LEFT_PAD,
      top:      targetTop,
      width:    NAV_LOGO_W,
      height:   NAV_LOGO_H,
      duration: 0.85,
      delay:    0.25,
      ease:     "power3.inOut",
      onComplete: () => onDone?.(),
    });
  }

  return { play };
}
