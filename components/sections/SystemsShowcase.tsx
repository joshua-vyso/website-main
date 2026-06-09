"use client";
import { useState, useRef, useCallback } from "react";
import { ArrowUpRight } from "lucide-react";

const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

// Complement of the orange gradient — appears orange on white bg, blue on dark line.
const blendOrange: React.CSSProperties = {
  background:           "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip:       "text",
  WebkitTextFillColor:  "transparent",
  color:                "transparent",
  mixBlendMode:         "difference",
  display:              "inline",
};

// How many px the card drifts toward the cursor (keep subtle — 6px max)
const MAGNET_PX = 6;

// ── Liquid-glass card constants (matches liquid-button recipe) ────────────────
const GLASS_BG        = "rgba(255,255,255,0.46)";
const GLASS_BORDER    = "1px solid rgba(255,255,255,0.60)";
const GLASS_SHADOW    = [
  "inset 0 1.5px 0 rgba(255,255,255,0.82)",   // top gleam
  "inset 0 -1px 0 rgba(0,0,0,0.05)",           // bottom micro-shade
  "0 0 0 0.5px rgba(255,255,255,0.28)",         // outer halo ring
  "0 6px 28px rgba(0,0,0,0.07)",               // resting drop-shadow
].join(", ");
const GLASS_SHADOW_HOVER = [
  "inset 0 1.5px 0 rgba(255,255,255,0.88)",
  "inset 0 -1px 0 rgba(0,0,0,0.05)",
  "0 0 0 0.5px rgba(255,255,255,0.32)",
  "0 22px 60px rgba(0,0,0,0.13)",              // lifted on hover
].join(", ");

interface Module {
  title:       string;
  description: string;
  tag:         string;
  image:       string;   // placeholder until custom images are uploaded
  video?:      string;   // slot ready — wire in when images/videos are ready
  span:        1 | 2;
}

const MODULES: Module[] = [
  {
    title:       "Inventory",
    description: "Real-time stock visibility, automated reorder alerts, zero guesswork.",
    tag:         "Operations",
    image:       "/assets/inventory.png",
    span:        2,
  },
  {
    title:       "Wastage",
    description: "Log and categorise daily waste. Spot patterns before they cost you.",
    tag:         "Analytics",
    image:       "/assets/wastage.png",
    span:        1,
  },
  {
    title:       "Labour",
    description: "Shift scheduling, time tracking and payroll insights in one place.",
    tag:         "Workforce",
    image:       "/assets/labour.png",
    span:        1,
  },
  {
    title:       "Suppliers",
    description: "Centralise supplier comms, track orders and monitor delivery performance.",
    tag:         "Supply Chain",
    image:       "/assets/suppliers.png",
    span:        1,
  },
  {
    title:       "Reporting",
    description: "Automated reports and live margin dashboards built around your numbers.",
    tag:         "Intelligence",
    image:       "/assets/reporting.png",
    span:        1,
  },
];

interface MagnetState {
  index: number | null;
  x: number;
  y: number;
}

export function SystemsShowcase() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [magnet, setMagnet] = useState<MagnetState>({ index: null, x: 0, y: 0 });

  // One ref per card so we can read getBoundingClientRect
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleMouseMove = useCallback((e: React.MouseEvent, i: number) => {
    const el = cardRefs.current[i];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Normalise cursor to -0.5 … +0.5 within the card, then scale
    const x = ((e.clientX - rect.left)  / rect.width  - 0.5) * MAGNET_PX * 2;
    const y = ((e.clientY - rect.top)   / rect.height - 0.5) * MAGNET_PX * 2;
    setMagnet({ index: i, x, y });
  }, []);

  const handleMouseLeave = useCallback((i: number) => {
    setHoveredIndex(null);
    setMagnet({ index: i, x: 0, y: 0 });
    // Brief settle — clear index after transition finishes
    setTimeout(() => setMagnet(prev => prev.index === i ? { index: null, x: 0, y: 0 } : prev), 320);
  }, []);

  return (
    <section
      style={{
        position:       "relative",
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "6rem 2rem",
        boxSizing:      "border-box",
        background:     "transparent",
        // No overflow:hidden — that creates a stacking context which would
        // isolate mix-blend-mode children from the global shader canvas.
      }}
    >

      <div style={{
        position:  "relative",
        // No zIndex here — avoids stacking context isolation of blend-mode.
        width:     "100%",
        maxWidth:  1100,
        textAlign: "center",
      }}>

        {/* ── Header — always visible ──────────────────────────────────────── */}
        <p style={{
          ...BODY,
          fontSize:      "0.72rem",
          fontWeight:    600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         "#bbb",
          marginBottom:  "1rem",
        }}>
          What we build
        </p>

        <h2 style={{
          ...FONT,
          fontSize:      "clamp(2.8rem, 6vw, 5.2rem)",
          fontWeight:    700,
          lineHeight:    1.02,
          letterSpacing: "-0.03em",
          margin:        "0 0 3rem",
        }}>
          <span style={{ color: "white", mixBlendMode: "difference" as const }}>Systems built for </span>
          <span style={blendOrange}>your specific needs.</span>
        </h2>

        {/* ── Bento grid ───────────────────────────────────────────────────── */}
        <div
          className="systems-bento"
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 "0.85rem",
            textAlign:           "left",
          }}>
          {MODULES.map((mod, i) => {
            const isActive  = hoveredIndex === i;
            const mx        = magnet.index === i ? magnet.x : 0;
            const my        = magnet.index === i ? magnet.y : 0;

            return (
              <div
                key={mod.title}
                style={{ gridColumn: `span ${mod.span}` }}
              >
                {/* ── Card wrapper — owns refs + mouse events ───────────── */}
                <div
                  ref={el => { cardRefs.current[i] = el; }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseMove={e  => handleMouseMove(e, i)}
                  onMouseLeave={() => handleMouseLeave(i)}
                  style={{
                    position:     "relative",
                    borderRadius: 18,
                    overflow:     "hidden",
                    minHeight:    mod.span === 2 ? 300 : 260,
                    height:       "100%",
                    cursor:       "pointer",

                    /* ── Liquid-glass surface ── */
                    backdropFilter:       "blur(20px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.8)",
                    background:    GLASS_BG,
                    border:        GLASS_BORDER,
                    boxShadow:     isActive ? GLASS_SHADOW_HOVER : GLASS_SHADOW,

                    /* ── Magnetic drift + lift ── */
                    transform: isActive
                      ? `translate3d(${mx}px, ${my}px, 0) scale(1.013)`
                      : `translate3d(${mx}px, ${my}px, 0) scale(1)`,
                    transition: isActive
                      ? "box-shadow 0.32s ease, transform 0.12s ease"  // snappy while hovering
                      : "box-shadow 0.32s ease, transform 0.38s cubic-bezier(0.34,1.46,0.64,1)", // springy settle
                  }}
                >

                  {/* ── Image reveal — fades in on hover ─────────────────── */}
                  <div style={{
                    position:   "absolute",
                    inset:      0,
                    opacity:    isActive ? 1 : 0,
                    transform:  isActive ? "scale(1)" : "scale(1.04)",
                    transition: "opacity 0.42s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)",
                  }}>
                    {mod.video ? (
                      <video
                        src={mod.video}
                        autoPlay loop muted playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <img
                        src={mod.image}
                        alt={mod.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    )}
                  </div>

                  {/* ── Gradient scrim — keeps text legible over image ──── */}
                  <div style={{
                    position:      "absolute",
                    inset:         0,
                    background:    isActive
                      ? "linear-gradient(145deg, rgba(8,6,4,0.70) 0%, rgba(8,6,4,0.15) 100%)"
                      : "none",
                    transition:    "background 0.38s ease",
                    pointerEvents: "none",
                  }} />

                  {/* ── Text ─────────────────────────────────────────────── */}
                  <div style={{
                    position:       "relative",
                    zIndex:         2,
                    padding:        "1.6rem",
                    height:         "100%",
                    boxSizing:      "border-box",
                    display:        "flex",
                    flexDirection:  "column",
                    justifyContent: "space-between",
                    minHeight:      mod.span === 2 ? 300 : 260,
                  }}>

                    {/* Title + tag row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3 style={{
                        ...FONT,
                        fontSize:      mod.span === 2
                          ? "clamp(1.3rem, 2vw, 1.65rem)"
                          : "clamp(1.1rem, 1.6vw, 1.35rem)",
                        fontWeight:    600,
                        color:         isActive ? "#fff" : "#0d0d0d",
                        letterSpacing: "-0.015em",
                        margin:        0,
                        display:       "inline-flex",
                        alignItems:    "center",
                        gap:           "0.3rem",
                        transition:    "color 0.3s ease",
                      }}>
                        {mod.title}
                        <ArrowUpRight
                          size={16}
                          style={{
                            color:      "hsl(30,82%,62%)",
                            opacity:    isActive ? 1 : 0,
                            transform:  isActive ? "translate(0,0)" : "translate(-5px,5px)",
                            transition: "opacity 0.25s ease, transform 0.28s ease",
                            flexShrink: 0,
                          }}
                        />
                      </h3>

                      <span style={{
                        ...BODY,
                        fontSize:      "0.62rem",
                        fontWeight:    600,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color:         isActive ? "hsl(30,82%,68%)" : "#b8b5b1",
                        transition:    "color 0.3s ease",
                        whiteSpace:    "nowrap",
                        paddingTop:    "0.3rem",
                        flexShrink:    0,
                        marginLeft:    "1rem",
                      }}>
                        {mod.tag}
                      </span>
                    </div>

                    {/* Description — orange→blue gradient at rest, white on hover */}
                    <p style={{
                      ...BODY,
                      fontSize:             mod.span === 2 ? "1.02rem" : "0.95rem",
                      fontWeight:           500,
                      margin:               0,
                      lineHeight:           1.6,
                      maxWidth:             mod.span === 2 ? 380 : "100%",
                      // Gradient text when card is at rest; plain white when image is showing
                      ...(isActive
                        ? {
                            color:               "rgba(255,255,255,0.82)",
                            background:          "none",
                            WebkitTextFillColor: "rgba(255,255,255,0.82)",
                            transition:          "opacity 0.3s ease",
                          }
                        : {
                            background:           "linear-gradient(135deg, hsl(22,69%,44%) 0%, hsl(30,82%,57%) 35%, hsl(202,69%,56%) 70%, hsl(219,72%,50%) 100%)",
                            WebkitBackgroundClip: "text",
                            backgroundClip:       "text",
                            WebkitTextFillColor:  "transparent",
                            color:                "transparent",
                            transition:           "opacity 0.3s ease",
                          }
                      ),
                    }}>
                      {mod.description}
                    </p>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
