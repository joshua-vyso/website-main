"use client";

import { PixelTrail } from "./PixelTrail";

/**
 * Renders the orange pixel cursor trail across the entire viewport.
 * Uses position:fixed so it covers every page without needing to be
 * added to individual sections.
 */
export function GlobalPixelTrail() {
  return (
    <PixelTrail
      pixelSize={30}
      fadeDuration={900}
      pixelClassName="pixel-orange"
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        9999,
        pointerEvents: "none",
      }}
    />
  );
}
