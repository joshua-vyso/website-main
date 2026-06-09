"use client";
import { useEffect, useRef } from "react";

/**
 * Custom cursor — desktop only (hover: hover + pointer: fine).
 * Small dark circle that scales and turns blue on interactive elements.
 * Render once in layout, it self-activates only where appropriate.
 */
export function CustomCursor() {
  const cursorRef  = useRef<HTMLDivElement>(null);
  const target     = useRef({ x: -200, y: -200 });
  const curr       = useRef({ x: -200, y: -200 });
  const rafRef     = useRef<number>(0);
  const hovering   = useRef(false);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    document.body.classList.add("cursor-none");
    cursor.style.opacity = "1";

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };

    const onOver = (e: MouseEvent) => {
      hovering.current = !!(e.target as HTMLElement).closest(
        "a, button, [role='button'], input, label",
      );
    };

    const animate = () => {
      curr.current.x += (target.current.x - curr.current.x) * 0.14;
      curr.current.y += (target.current.y - curr.current.y) * 0.14;

      cursor.style.transform =
        `translate(calc(${curr.current.x}px - 50%), calc(${curr.current.y}px - 50%))`;

      if (hovering.current) {
        cursor.style.width   = "28px";
        cursor.style.height  = "28px";
        cursor.style.background = "hsl(22,69%,44%)";
        cursor.style.opacity = "0.7";
      } else {
        cursor.style.width   = "12px";
        cursor.style.height  = "12px";
        cursor.style.background = "#0d0d0d";
        cursor.style.opacity = "0.85";
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);

    return () => {
      document.body.classList.remove("cursor-none");
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      style={{
        position:        "fixed",
        top:             0,
        left:            0,
        width:           12,
        height:          12,
        borderRadius:    "50%",
        background:      "#0d0d0d",
        pointerEvents:   "none",
        zIndex:          99999,
        opacity:         0,           // hidden until JS activates
        willChange:      "transform",
        transition:      "width 0.18s ease, height 0.18s ease, background 0.18s ease, opacity 0.18s ease",
      }}
    />
  );
}
