import { useEffect, type RefObject } from "react";

/**
 * Mirrors the WebGLShaderBackground's sine-wave line position and sets the
 * opacity of the referenced element (a blue gradient overlay) based on how
 * close the line is to it.
 *
 * The caller renders TWO overlapping spans — the original orange GradientText
 * underneath, and a blue twin on top (this ref). As the line approaches, the
 * blue twin fades in (0 → 1). As it recedes, it fades back out (1 → 0).
 * No hue-rotate, so no green intermediate — just a clean orange ↔ blue swap.
 *
 * Shader constants (must match WebGLShaderBackground.tsx):
 *   time  += 0.01 per frame
 *   xScale = 1.0
 *   yScale = 0.5
 *   lineY  = screenH/2 × (1 − sin((xNorm + time) × xScale) × yScale)
 */

const XSCALE    = 1.0;
const YSCALE    = 0.5;
const TIME_STEP = 0.01;

// Vertical distance (px) from element centre where the fade begins.
const FADE_ZONE = 140;

// Number of x-sample points across the element's width.
const SAMPLES = 7;

export function useShaderHueShift(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let time        = 0;
    let raf: number;
    let lastOpacity = -1;

    const tick = () => {
      time += TIME_STEP;

      const el = ref.current;
      if (el && el.isConnected) {
        const rect      = el.getBoundingClientRect();
        const W         = window.innerWidth;
        const H         = window.innerHeight;
        const elCenterY = rect.top + rect.height / 2;

        // Find the minimum distance between the line and the element's centre
        let minDist = Infinity;
        for (let s = 0; s < SAMPLES; s++) {
          const cx    = rect.left + (rect.width / (SAMPLES - 1)) * s;
          const xNorm = (cx / W) * 2 - 1;
          const lineY = (H / 2) * (1 - Math.sin((xNorm + time) * XSCALE) * YSCALE);
          const dist  = Math.abs(lineY - elCenterY);
          if (dist < minDist) minDist = dist;
        }

        // 0 = far away, 1 = line centred on element
        const t       = Math.max(0, 1 - minDist / FADE_ZONE);
        // Smoothstep so the fade eases in and out naturally
        const opacity = t * t * (3 - 2 * t);

        // Only write to DOM when the value meaningfully changes (>0.5% delta)
        if (Math.abs(opacity - lastOpacity) > 0.005) {
          el.style.opacity = opacity.toFixed(3);
          lastOpacity = opacity;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}
