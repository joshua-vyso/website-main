"use client";
import React, { useCallback, useEffect, useId, useMemo, useRef } from "react";
// Import through the declared `motion` package (motion/react re-exports framer-motion).
// framer-motion is only a TRANSITIVE dep here, so a bare 'framer-motion' import breaks
// under a strict installer or a `motion` major bump.
import { motion, useAnimationControls } from "motion/react";
import { useDimensions } from "@/components/hooks/use-debounced-dimensions";

interface PixelTrailProps {
  pixelSize?: number;       // px, default 24
  fadeDuration?: number;    // ms, default 650
  delay?: number;           // ms, default 0
  pixelClassName?: string;  // tailwind / CSS class for pixel colour
  style?: React.CSSProperties;
}

export function PixelTrail({
  pixelSize = 24,
  fadeDuration = 650,
  delay = 0,
  pixelClassName,
  style,
}: PixelTrailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions   = useDimensions(containerRef);
  const trailId      = useId().replaceAll(":", "");

  const columns = useMemo(
    () => (dimensions.width  > 0 ? Math.ceil(dimensions.width  / pixelSize) : 0),
    [dimensions.width, pixelSize],
  );
  const rows = useMemo(
    () => (dimensions.height > 0 ? Math.ceil(dimensions.height / pixelSize) : 0),
    [dimensions.height, pixelSize],
  );

  // Use a window-level listener so the event isn't swallowed by overlapping elements
  const handleMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Ignore if cursor is outside this container
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) return;

      // Keep the decorative trail out of copy and controls. The global trail is
      // meant to animate open space, never sit over a heading or make text harder
      // to read.
      const underPointer = document.elementFromPoint(e.clientX, e.clientY);
      if (underPointer?.closest(
        "h1, h2, h3, h4, p, a, button, label, input, textarea, select, [role='button']",
      )) return;

      const x = Math.floor((e.clientX - rect.left) / pixelSize);
      const y = Math.floor((e.clientY - rect.top)  / pixelSize);
      const el = document.getElementById(`${trailId}-px-${x}-${y}`);
      if (el) {
        const fn = (el as HTMLElement & { __animatePixel?: () => void }).__animatePixel;
        if (fn) fn();
      }
    },
    [pixelSize, trailId],
  );

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [handleMove]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position:      "absolute",
        inset:         0,
        overflow:      "hidden",
        pointerEvents: "none",  // container is passive — window listener handles events
        ...style,
      }}
    >
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} style={{ display: "flex" }}>
          {Array.from({ length: columns }).map((_, col) => (
            <PixelDot
              key={col}
              id={`${trailId}-px-${col}-${row}`}
              size={pixelSize}
              fadeDuration={fadeDuration}
              delay={delay}
              className={pixelClassName}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Individual pixel ─────────────────────────────────────────────────────── */
interface PixelDotProps {
  id: string;
  size: number;
  fadeDuration: number;
  delay: number;
  className?: string;
}

const PixelDot = React.memo(function PixelDot({
  id,
  size,
  fadeDuration,
  delay,
  className,
}: PixelDotProps) {
  const controls = useAnimationControls();

  const animatePixel = useCallback(() => {
    controls.start({
      opacity: [1, 0],
      transition: { duration: fadeDuration / 1000, delay: delay / 1000, ease: "easeOut" },
    });
  }, [controls, fadeDuration, delay]);

  // Attach callable to DOM node so the window listener can reach it
  const attachRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        (node as HTMLDivElement & { __animatePixel?: () => void }).__animatePixel = animatePixel;
      }
    },
    [animatePixel],
  );

  return (
    <motion.div
      id={id}
      ref={attachRef}
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
      initial={{ opacity: 0 }}
      animate={controls}
    />
  );
});
