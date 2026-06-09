import gsap from "gsap";

// Idle bob and ball bounce animation for the O dot.
// Call start() on mount. Call stop() when the dot is clicked (expands into portal).

export function createBounceAnimator(dotEl: HTMLDivElement) {
  let idleTween:   gsap.core.Tween | null = null;
  let bounceTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function startIdleBob() {
    idleTween?.kill();
    idleTween = gsap.to(dotEl, {
      y: -8, duration: 1.0, ease: "sine.inOut", yoyo: true, repeat: -1,
    });
  }

  function playBounce() {
    if (stopped) return;
    idleTween?.kill();
    gsap.set(dotEl, { y: 0 });
    const amps = [150, 105, 73, 51, 36, 24, 16, 10];
    const tl = gsap.timeline({
      onComplete: () => {
        startIdleBob();
        bounceTimer = setTimeout(playBounce, 6000);
      },
    });
    amps.forEach(amp => {
      const h = 0.09 + (amp / 150) * 0.16;
      tl.to(dotEl, { y: -amp, duration: h, ease: "power2.out" })
        .to(dotEl, { y: 0,    duration: h, ease: "power2.in"  });
    });
  }

  function start() {
    startIdleBob();
    bounceTimer = setTimeout(playBounce, 6000);
  }

  // Called when the dot is clicked — kills all tween state before portal fires.
  function stop() {
    stopped = true;
    idleTween?.kill();
    if (bounceTimer) { clearTimeout(bounceTimer); bounceTimer = null; }
    gsap.killTweensOf(dotEl);
  }

  function cleanup() { stop(); }

  return { start, stop, cleanup };
}
