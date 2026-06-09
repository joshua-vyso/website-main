import { useEffect, useRef, useState } from "react";

/**
 * Counts from 0 to `target` over `duration` ms when the attached element
 * scrolls into view. Uses easeOutCubic easing.
 *
 * Usage:
 *   const { ref, count } = useCountUp<HTMLSpanElement>(420, 1800);
 *   return <span ref={ref}>{count}</span>;
 */
export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  target: number,
  duration = 2000,
) {
  const ref = useRef<T | null>(null);
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, count };
}
