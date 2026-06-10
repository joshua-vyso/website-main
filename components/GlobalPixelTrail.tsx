"use client";

import { useState, useEffect } from "react";
import { PixelTrail } from "./PixelTrail";

export function GlobalPixelTrail() {
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    // Only render on devices with a precise pointer (mouse/trackpad).
    // Touch-only devices (phones, tablets) get nothing — saves paint budget.
    setIsFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  if (!isFinePointer) return null;

  return (
    <PixelTrail
      pixelSize={30}
      fadeDuration={900}
      pixelClassName="pixel-orange"
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
    />
  );
}
