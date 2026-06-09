"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Watches a container element via ResizeObserver and returns its
 * { width, height } — debounced by 40 ms to avoid thrashing.
 */
export function useDimensions(ref: React.RefObject<HTMLElement | null>) {
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDims({ width: el.offsetWidth, height: el.offsetHeight });
      }, 40) as unknown as ReturnType<typeof setTimeout>;
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure(); // initial read

    return () => {
      ro.disconnect();
      clearTimeout(timer.current);
    };
  }, [ref]);

  return dims;
}
