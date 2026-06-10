"use client";

import { useEffect, useRef } from "react";

// Must match WebGLShaderBackground uniforms exactly
const LINE_OFFSET = 0.32;
const Y_SCALE     = 0.28;
const X_SCALE     = 0.75;
const TIME_STEP   = 0.01;
// Generous detection window in normalised units — covers visible line glow
const LINE_HALF   = 0.18;

export function BlendTextMobile() {
  const rafRef  = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    // No pointer check here — CSS @media (max-width: 767px) ensures the
    // colour swaps only have visual effect on mobile. Running the rAF on
    // desktop is harmless (the .line-over rules are inside the media query).

    const tick = () => {
      timeRef.current += TIME_STEP;
      const t   = timeRef.current;
      const W   = window.innerWidth;
      const H   = window.innerHeight;
      const min = Math.min(W, H);

      // Sample the line at 9 x-positions to find its vertical range.
      //
      // After fixing the shader resolution to use device pixels (DPR cancels):
      //   p.x  = (x_css * 2 - W) / min
      //   line: p.y = lineOffset - sin((p.x + t) * xScale) * yScale
      //   y_css = (H - p.y * min) / 2
      let lineYMin = Infinity;
      let lineYMax = -Infinity;
      for (let i = 0; i <= 8; i++) {
        const screenX = (i / 8) * W;
        const px      = (screenX * 2 - W) / min;
        const py      = LINE_OFFSET - Math.sin((px + t) * X_SCALE) * Y_SCALE;
        const screenY = (H - py * min) / 2;
        if (screenY < lineYMin) lineYMin = screenY;
        if (screenY > lineYMax) lineYMax = screenY;
      }

      // Expand by the detection window
      const thickPx = LINE_HALF * min;
      lineYMin -= thickPx;
      lineYMax += thickPx;

      const els = document.querySelectorAll<HTMLElement>(".blend-h-plain, .blend-h-orange");
      els.forEach(el => {
        const r          = el.getBoundingClientRect();
        const intersects = r.top < lineYMax && r.bottom > lineYMin;
        el.classList.toggle("line-over", intersects);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return null;
}
