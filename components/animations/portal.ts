import gsap from "gsap";
import { VYS_W, DOT_SLIDE } from "./constants";

export function createPortal(
  dotEl:         HTMLDivElement,
  vysEl:         HTMLDivElement,
  darkBgEl:      HTMLDivElement,
  sloganEl:      HTMLElement,
  smokyEl:       HTMLElement | null,  // optional smoke wrapper (null = no smoke)
  gate:          { once: (fn: () => void) => void; clear: () => void },
  onExpand:      () => void,
  onSloganReady: () => void,
) {
  let expanded    = false;
  let portalFired = false;

  gsap.set(vysEl,    { x: -(VYS_W + 80), opacity: 0 });
  gsap.set(sloganEl, { opacity: 0, y: 40 });

  function playPortal() {
    if (portalFired) return;
    portalFired = true;
    gate.clear();

    // Smoke fades out as the white portal expands (if present)
    if (smokyEl) gsap.to(smokyEl, { opacity: 0, duration: 0.5, ease: "power2.in" });

    gsap.to(vysEl, { opacity: 0, duration: 0.4 });
    gsap.set(dotEl, { zIndex: 500, pointerEvents: "none" });
    gsap.to(dotEl, {
      scale: 35, duration: 1.1, ease: "power2.in",
      onComplete: () => {
        gsap.to(darkBgEl, {
          opacity: 1,
          duration: 0.75,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(dotEl, { opacity: 0 });
          },
        });

        gsap.to(sloganEl, {
          opacity: 1, y: 0, duration: 0.9, delay: 0.55, ease: "power3.out",
          onComplete: () => {
            gsap.set(sloganEl, { clearProps: "willChange,transform" });
            onSloganReady();
          },
        });
      },
    });
  }

  function handleClick() {
    if (expanded) return;
    expanded = true;
    onExpand();

    // Smoke is already visible from the start — nothing to do on click

    gsap.set(dotEl, { y: 0 });
    gsap.to(dotEl,  { x: DOT_SLIDE, duration: 0.7, ease: "power3.out" });
    gsap.to(vysEl,  {
      x: 0, opacity: 1, duration: 0.7, ease: "power3.out",
      onComplete: () => gate.once(playPortal),
    });
  }

  return { handleClick };
}
