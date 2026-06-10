"use client";
import { useEffect, useRef, useCallback } from "react";
import { useInView } from "@/hooks/useInView";

/* ── Blend helpers ───────────────────────────────────────────────────────── */
const blendWhite: React.CSSProperties = {
  color: "white", mixBlendMode: "difference", display: "inline",
};
const blendOrange: React.CSSProperties = {
  background:           "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip:       "text",
  WebkitTextFillColor:  "transparent",
  color:                "transparent",
  mixBlendMode:         "difference",
  display:              "inline",
};

/* ── Globe with Vyso brand colours ──────────────────────────────────────── */
const MARKERS = [
  { location: [-26.2, 28.04] as [number, number], size: 0.08 },  // Johannesburg
  { location: [-33.93, 18.42] as [number, number], size: 0.06 },  // Cape Town
  { location: [-29.86, 31.02] as [number, number], size: 0.05 },  // Durban
  { location: [51.51, -0.13] as [number, number], size: 0.04 },   // London
  { location: [1.35, 103.82] as [number, number], size: 0.04 },   // Singapore
  { location: [40.71, -74.01] as [number, number], size: 0.04 },  // New York
];

function VysoGlobe() {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const pointerRef       = useRef<{ x: number; y: number } | null>(null);
  const dragOffset       = useRef({ phi: 0, theta: 0 });
  const phiOffset        = useRef(0);
  const thetaOffset      = useRef(0);
  const isPaused         = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPaused.current = true;
  }, []);

  const onPointerUp = useCallback(() => {
    if (pointerRef.current) {
      phiOffset.current   += dragOffset.current.phi;
      thetaOffset.current += dragOffset.current.theta;
      dragOffset.current   = { phi: 0, theta: 0 };
    }
    pointerRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPaused.current = false;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!pointerRef.current) return;
      dragOffset.current = {
        phi:   (e.clientX - pointerRef.current.x) / 260,
        theta: (e.clientY - pointerRef.current.y) / 900,
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup",   onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onPointerUp);
    };
  }, [onPointerUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let globe: { update: (opts: object) => void; destroy: () => void } | null = null;
    let rafId: number;
    let phi = 1.4;  // start roughly centred on Africa

    const init = async () => {
      const w = canvas.offsetWidth;
      if (w === 0 || globe) return;

      const createGlobe = (await import("cobe")).default;

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width:            w * 2,
        height:           w * 2,
        phi:              1.4,
        theta:            -0.3,
        dark:             0,           // light mode
        diffuse:          1.4,
        mapSamples:       20000,
        mapBrightness:    7,
        // Warm grey landmass, matching the site's off-white background
        baseColor:        [0.86, 0.83, 0.80],
        // Orange markers — hsl(22,69%,44%) = rgb(0.745, 0.365, 0.137)
        markerColor:      [0.745, 0.365, 0.137],
        // Warm orange glow matching brand
        glowColor:        [0.96, 0.90, 0.84],
        markers:          MARKERS,
        opacity:          0.90,
      });

      const tick = () => {
        if (!isPaused.current) phi += 0.0025;
        globe!.update({
          phi:   phi + phiOffset.current   + dragOffset.current.phi,
          theta: -0.3 + thetaOffset.current + dragOffset.current.theta,
        });
        rafId = requestAnimationFrame(tick);
      };
      tick();
      setTimeout(() => { if (canvas) canvas.style.opacity = "1"; });
    };

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver(entries => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init(); }
      });
      ro.observe(canvas);
    }

    return () => {
      cancelAnimationFrame(rafId);
      globe?.destroy();
    };
  }, []);

  return (
    <div style={{ position: "relative", aspectRatio: "1/1", width: "100%", maxWidth: 440, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        style={{
          width: "100%", height: "100%",
          cursor: "grab", opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
          display: "block",
        }}
      />
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function TrustStrip() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={ref}
      id="reach"
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        justifyContent: "center",
        background:     "transparent",
        padding:        "5rem 1.25rem",
        boxSizing:      "border-box",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* ── Top row: text + globe ────────────────────────────────────── */}
        <div
          className="trust-grid"
          style={{
            display:       "grid",
            gridTemplateColumns: "1fr auto",
            gap:           "3rem",
            alignItems:    "center",
            marginBottom:  "3.5rem",
          }}
        >
          {/* Left — copy */}
          <div>
            <p style={{
              fontFamily:    "var(--font-body, var(--font-sans))",
              fontSize:      "0.72rem",
              fontWeight:    600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color:         "#bbb",
              marginBottom:  "1.2rem",
            }}>
              Our reach
            </p>

            <h2 style={{
              fontFamily:    "var(--font-sans)",
              fontSize:      "clamp(1.9rem, 4.2vw, 3.4rem)",
              fontWeight:    700,
              letterSpacing: "-0.025em",
              lineHeight:    1.08,
              margin:        "0 0 1.2rem",
            }}>
              {/* "Built for businesses that" — black/white blend */}
              <span className="blend-h-plain" style={blendWhite}>Built for businesses that</span>
              <br />
              <span className="blend-h-orange" style={blendOrange}>run on operations.</span>
            </h2>

            <p style={{
              fontFamily: "var(--font-body, var(--font-sans))",
              fontSize:   "0.97rem",
              lineHeight: 1.65,
              color:      "#6b6b6b",
              maxWidth:   440,
              margin:     0,
            }}>
              From procurement and staffing to reporting and automation,
              Vyso helps teams gain visibility, eliminate manual work,
              and scale with confidence.
            </p>
          </div>

          {/* Right — globe */}
          <VysoGlobe />
        </div>

        {/* ── Single testimonial ───────────────────────────────────────── */}
        <div style={{
          padding:              "2rem 2.4rem",
          borderRadius:         18,
          background:           "rgba(255,255,255,0.52)",
          backdropFilter:       "blur(22px) saturate(1.9)",
          WebkitBackdropFilter: "blur(22px) saturate(1.9)",
          border:               "1px solid rgba(255,255,255,0.68)",
          boxShadow: [
            "inset 0 1.5px 0 rgba(255,255,255,0.88)",
            "inset 0 -1px 0 rgba(0,0,0,0.04)",
            "0 0 0 0.5px rgba(255,255,255,0.30)",
            "0 8px 32px rgba(0,0,0,0.08)",
          ].join(", "),
          display:      "flex",
          flexDirection: "column",
          gap:           "1rem",
          maxWidth:      680,
        }}>
          {/* Quote mark */}
          <div style={{
            fontFamily: "Georgia, serif",
            fontSize:   "3rem",
            lineHeight: 0.75,
            color:      "hsl(22,69%,44%)",
            opacity:    0.4,
          }}>
            "
          </div>

          {/* Quote text */}
          <p style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize:   "1.05rem",
            lineHeight: 1.65,
            color:      "#1a1a1a",
            fontStyle:  "italic",
            margin:     0,
          }}>
            Vyso gave us visibility we never had before. We caught R40,000 in monthly
            wastage in the first week.
          </p>

          {/* Attribution */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Avatar initials */}
            <div style={{
              width:          38,
              height:         38,
              borderRadius:   "50%",
              background:     "linear-gradient(135deg, hsl(22,69%,44%), hsl(30,82%,57%))",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}>
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize:   "0.85rem",
                fontWeight: 700,
                color:      "#fff",
              }}>R</span>
            </div>
            <div>
              <div style={{
                fontFamily:    "var(--font-sans)",
                fontSize:      "0.9rem",
                fontWeight:    700,
                color:         "#0d0d0d",
                letterSpacing: "-0.01em",
              }}>
                Roberto
              </div>
              <div style={{
                fontFamily: "var(--font-body, var(--font-sans))",
                fontSize:   "0.78rem",
                color:      "#aaa",
                lineHeight: 1.4,
              }}>
                Turn &apos;n Slice · FMCG Sector · Johannesburg, South Africa
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
