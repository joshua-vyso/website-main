"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Load PixelTrail (and its `motion` runtime) only when it's actually rendered — on the
// marketing pages. A static import would bake motion into the shared client bundle that
// /app downloads, even though this component renders null there.
const PixelTrail = dynamic(() => import("./PixelTrail").then((m) => m.PixelTrail), { ssr: false });

export function GlobalPixelTrail() {
  const pathname = usePathname();
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    // Only render on devices with a precise pointer (mouse/trackpad).
    // Touch-only devices (phones, tablets) get nothing — saves paint budget.
    setIsFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  // Marketing site only — the platform (/app) and its login stay calm.
  if (pathname?.startsWith("/app") || pathname?.startsWith("/login")) return null;
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
