import gsap from "gsap";

/**
 * Cycles reimagined → redefined → Vyso logo with a clean slide-crossfade.
 *
 * Each word slides up and fades out; the next slides up and fades in.
 * No blur, no filter — stays crisp with gradient text.
 */
export function createWordCycle(
  _wordSlotEl:  HTMLElement,   // unused — kept for API compat with BounceDot
  reimaginedEl: HTMLElement,
  redefinedEl:  HTMLElement,
  logoSlotEl:   HTMLElement,
  onDone:       () => void,
) {
  // ── Initial states ─────────────────────────────────────────────────────────
  gsap.set(redefinedEl, { opacity: 0, y: 12 });
  gsap.set(logoSlotEl,  { opacity: 0, y: 12 });
  gsap.set(reimaginedEl, { opacity: 1, y: 0 });

  // ── Centre every element within the slot ──────────────────────────────────
  gsap.set(reimaginedEl, { xPercent: -50, left: "50%" });
  gsap.set(redefinedEl,  { xPercent: -50, left: "50%" });
  gsap.set(logoSlotEl,   { xPercent: -50, left: "50%" });

  function play() {
    gsap.timeline({ onComplete: onDone })

      // ── reimagined → redefined ─────────────────────────────────────────────
      // outgoing: fade + slide up
      .to(reimaginedEl, {
        opacity: 0, y: -14,
        duration: 0.40, delay: 0.9, ease: "power2.in",
      })
      // incoming: fade + slide up into place (slight overlap)
      .fromTo(redefinedEl,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" },
        "-=0.10",
      )

      // ── redefined → Vyso ───────────────────────────────────────────────────
      .to(redefinedEl, {
        opacity: 0, y: -14,
        duration: 0.40, delay: 0.9, ease: "power2.in",
      })
      .fromTo(logoSlotEl,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" },
        "-=0.10",
      );
  }

  return { play };
}
