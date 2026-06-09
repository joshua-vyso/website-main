"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { WarpTransitionOverlay } from "./WarpTransitionOverlay";

interface Props {
  pages:    React.ReactNode[];
  enabled?: boolean;
}

/**
 * Fullpage stacked scroller.
 *
 * Layout: all pages sit as absolute layers.
 *   - Past  → translateY(-105vh), opacity 0  (slid off above)
 *   - Current → scale 1, on top
 *   - Future  → scaled down (0.82–0.95) and dimmed, peeking behind
 *
 * Transition: CSS handles all movement.
 * WarpTransitionOverlay fires as a flash on top — gives the warp visual
 * without messing with z-index stacking or revealing background pages.
 */
export function FullpageScroller({ pages, enabled = true }: Props) {
  const [current, setCurrent] = useState(0);
  const [warping, setWarping] = useState(false);
  const locked  = useRef(false);
  const touchY0 = useRef(0);
  const total   = pages.length;

  const goTo = useCallback((next: number) => {
    if (locked.current || next < 0 || next >= total) return;
    locked.current = true;

    setWarping(true);                       // orange blob flash starts

    // Switch page a beat after the flash starts — feels intentional
    setTimeout(() => setCurrent(next), 160);

    // End flash — AnimatePresence exit handles its own 250 ms fade
    setTimeout(() => setWarping(false), 520);

    // Release scroll lock
    setTimeout(() => { locked.current = false; }, 880);
  }, [total]);

  // Prevent native body scroll
  useEffect(() => {
    if (enabled) document.body.classList.add("fullpage-active");
    else         document.body.classList.remove("fullpage-active");
    return () => document.body.classList.remove("fullpage-active");
  }, [enabled]);

  // Wheel
  useEffect(() => {
    if (!enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 20) return;
      goTo(e.deltaY > 0 ? current + 1 : current - 1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [enabled, current, goTo]);

  // Touch
  useEffect(() => {
    if (!enabled) return;
    const onStart = (e: TouchEvent) => { touchY0.current = e.touches[0].clientY; };
    const onEnd   = (e: TouchEvent) => {
      const delta = touchY0.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) > 40) goTo(delta > 0 ? current + 1 : current - 1);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend",   onEnd);
    };
  }, [enabled, current, goTo]);

  // Keyboard
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goTo(current + 1); }
      if (e.key === "ArrowUp"   || e.key === "PageUp")   { e.preventDefault(); goTo(current - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, current, goTo]);

  const getStyle = (i: number): React.CSSProperties => {
    const diff = i - current;

    if (diff < 0) {
      // Past — slid completely off above, no pointer events
      return {
        transform:     "translateY(-105vh)",
        zIndex:        1,
        opacity:       0,
        pointerEvents: "none",
      };
    }

    if (diff === 0) {
      // Active — full size, on top
      return {
        transform:     "translateY(0) scale(1)",
        zIndex:        total + 10,
        opacity:       1,
        pointerEvents: "auto",
        filter:        "none",
      };
    }

    // Future — stacked behind, increasingly smaller and darker
    const scale      = Math.max(0.82, 1 - diff * 0.055);
    const brightness = Math.max(0.60, 1 - diff * 0.14);
    return {
      transform:     `scale(${scale})`,
      zIndex:        total - diff + 1,
      opacity:       diff <= 3 ? 1 : 0,
      filter:        `brightness(${brightness})`,
      pointerEvents: "none",
    };
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 1 }}>
        {pages.map((page, i) => (
          <div
            key={i}
            style={{
              position:   "absolute",
              inset:      0,
              overflow:   "hidden",
              willChange: "transform",
              // Single unified transition — same easing in both directions prevents flip
              transition: "transform 0.80s cubic-bezier(0.76,0,0.24,1), opacity 0.40s ease, filter 0.50s ease",
              ...getStyle(i),
            }}
          >
            {page}
          </div>
        ))}

        {/* Page-dot indicator */}
        <nav
          aria-label="Page navigation"
          style={{
            position:      "fixed",
            right:         20,
            top:           "50%",
            transform:     "translateY(-50%)",
            display:       "flex",
            flexDirection: "column",
            gap:           10,
            zIndex:        99998,
          }}
        >
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to page ${i + 1}`}
              style={{
                width:        i === current ? 10 : 7,
                height:       i === current ? 10 : 7,
                borderRadius: "50%",
                border:       "none",
                padding:      0,
                cursor:       "pointer",
                background:   i === current ? "hsl(22,69%,44%)" : "rgba(13,13,13,0.25)",
                transition:   "all 0.3s ease",
                transform:    i === current ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </nav>
      </div>

      {/* Warp overlay — outside the scroller's stacking context so it sits above everything */}
      <WarpTransitionOverlay active={warping} />
    </>
  );
}
