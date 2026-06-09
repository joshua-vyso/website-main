"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { useInView } from "@/hooks/useInView";
import {
  StockPulseIcon, WasteLogIcon, MarginViewIcon, SupplierHubIcon,
  ShiftBoardIcon, OrderFlowIcon, ReportGenIcon,
} from "@/components/ui/AppIcons";

/* ── Blend helpers (same pattern as hero / systems) ──────────────────────── */
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

/* ── Custom "+build" icon (not in the sprite) ────────────────────────────── */
function CustomIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ci-bg" x1="0" y1="0" x2="310" y2="310">
          <stop stopColor="#9B7FF6"/><stop offset="1" stopColor="#5B3DD6"/>
        </linearGradient>
      </defs>
      <rect width="310" height="310" rx="52" fill="url(#ci-bg)"/>
      <path d="M155 85V225M85 155H225" stroke="#FFF" strokeWidth="30" strokeLinecap="round"/>
    </svg>
  );
}

/* ── App data ─────────────────────────────────────────────────────────────── */
const APPS = [
  {
    name:    "Custom",
    tagline: "We build what you need.",
    desc:    "Your operation is unique. We create tailored tools and systems built entirely around the way you work.",
    Icon:    CustomIcon,
    color:   "#7B5CF0",
  },
  {
    name:    "StockPulse",
    tagline: "Real-time inventory, always in control.",
    desc:    "Live stock tracking, low-stock alerts and automated reorder triggers.",
    Icon:    StockPulseIcon,
    color:   "#8D75F4",
  },
  {
    name:    "WasteLog",
    tagline: "Track waste. Cut costs.",
    desc:    "Daily wastage capture, category breakdown and trend reporting.",
    Icon:    WasteLogIcon,
    color:   "#086B62",
  },
  {
    name:    "SupplierHub",
    tagline: "Supplier management, simplified.",
    desc:    "Centralised supplier contact, pricing, performance and order history.",
    Icon:    SupplierHubIcon,
    color:   "#1167D8",
  },
  {
    name:    "ShiftBoard",
    tagline: "Smarter scheduling, better teams.",
    desc:    "Staff scheduling, attendance logging and time tracking — all in one place.",
    Icon:    ShiftBoardIcon,
    color:   "#F46A00",
  },
  {
    name:    "OrderFlow",
    tagline: "From order to delivery, seamlessly.",
    desc:    "Track customer orders in real-time from placement through to delivery.",
    Icon:    OrderFlowIcon,
    color:   "#CB1552",
  },
  {
    name:    "MarginView",
    tagline: "Know your margins, live.",
    desc:    "Real-time margin dashboards per product, category and customer.",
    Icon:    MarginViewIcon,
    color:   "#17A858",
  },
  {
    name:    "ReportGen",
    tagline: "Reports that tell you what matters.",
    desc:    "Automated weekly and monthly reports with the insights you need to act.",
    Icon:    ReportGenIcon,
    color:   "#E6A800",
  },
];

/* ── Liquid-glass constants (matches bento recipe) ───────────────────────── */
const GLASS_SHADOW = [
  "inset 0 1.5px 0 rgba(255,255,255,0.82)",
  "inset 0 -1px 0 rgba(0,0,0,0.05)",
  "0 0 0 0.5px rgba(255,255,255,0.28)",
  "0 6px 28px rgba(0,0,0,0.07)",
].join(", ");

/* ── Single app card ─────────────────────────────────────────────────────── */
function AppCard({ app }: { app: typeof APPS[0] }) {
  return (
    <div
      className="app-card"
      style={{
        flex:                 "0 0 auto",
        width:                270,
        background:           "rgba(255,255,255,0.46)",
        backdropFilter:       "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        border:               "1px solid rgba(255,255,255,0.60)",
        borderRadius:         20,
        padding:              "2rem 1.8rem 1.8rem",
        boxShadow:            GLASS_SHADOW,
        scrollSnapAlign:      "center",
        userSelect:           "none",
      }}
    >
      <div style={{ marginBottom: "1.35rem" }}>
        <app.Icon size={72} />
      </div>

      <h3 style={{
        fontFamily:    "var(--font-sans)",
        fontSize:      "1.2rem",
        fontWeight:    700,
        color:         "#0d0d0d",
        letterSpacing: "-0.015em",
        margin:        "0 0 0.3rem",
        lineHeight:    1.2,
      }}>
        {app.name}
      </h3>

      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))",
        fontSize:   "0.82rem",
        fontWeight: 600,
        color:      app.color,
        margin:     "0 0 0.55rem",
        lineHeight: 1.4,
      }}>
        {app.tagline}
      </p>

      {/* Coloured accent line */}
      <div style={{
        width:        30,
        height:       2.5,
        borderRadius: 2,
        background:   app.color,
        opacity:      0.65,
        marginBottom: "0.85rem",
      }} />

      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))",
        fontSize:   "0.85rem",
        lineHeight: 1.6,
        color:      "#6b6b6b",
        margin:     0,
      }}>
        {app.desc}
      </p>
    </div>
  );
}

/* ── Nav arrow button ────────────────────────────────────────────────────── */
function NavArrow({
  dir, onClick, disabled,
}: { dir: -1 | 1; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Previous app" : "Next app"}
      className="apps-nav-arrow"
      style={{
        position:             "absolute",
        [dir === -1 ? "left" : "right"]: "1.25rem",
        top:                  "50%",
        transform:            "translateY(-50%)",
        zIndex:               10,
        width:                46,
        height:               46,
        borderRadius:         "50%",
        border:               "1px solid rgba(255,255,255,0.60)",
        background:           "rgba(255,255,255,0.72)",
        backdropFilter:       "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow:            GLASS_SHADOW,
        cursor:               disabled ? "default" : "pointer",
        opacity:              disabled ? 0.28 : 1,
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "center",
        color:                "#0d0d0d",
        outline:              "none",
        transition:           "background 0.2s, color 0.2s, opacity 0.2s",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "hsl(22,69%,44%)";
        el.style.color      = "#fff";
        el.style.borderColor = "hsl(22,69%,44%)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background  = "rgba(255,255,255,0.72)";
        el.style.color       = "#0d0d0d";
        el.style.borderColor = "rgba(255,255,255,0.60)";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {dir === -1
          ? <path d="M10 3L5 8l5 5"/>
          : <path d="M6 3l5 5-5 5"/>}
      </svg>
    </button>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function AppsShowcase() {
  const { ref: sectionRef, inView } = useInView<HTMLElement>({ threshold: 0.1 });
  const trackRef    = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  /* Find which card is closest to track center on scroll */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => {
      const trackMid = track.getBoundingClientRect().left + track.getBoundingClientRect().width / 2;
      let bestIdx = 0, bestDist = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const rect = (child as HTMLElement).getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - trackMid);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      });
      setActiveIdx(bestIdx);
    };
    track.addEventListener("scroll", update, { passive: true });
    return () => track.removeEventListener("scroll", update);
  }, []);

  /* Scroll to a specific card index, centering it */
  const scrollTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[idx] as HTMLElement;
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActiveIdx(idx);
  }, []);

  const prev = useCallback(() => scrollTo(Math.max(0, activeIdx - 1)), [activeIdx, scrollTo]);
  const next = useCallback(() => scrollTo(Math.min(APPS.length - 1, activeIdx + 1)), [activeIdx, scrollTo]);

  return (
    <section
      ref={sectionRef}
      id="apps"
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        justifyContent: "center",
        background:     "transparent",
        boxSizing:      "border-box",
        padding:        "5rem 0",
        position:       "relative",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      {/* ── Left / Right nav arrows (outside the card track) ──────────────── */}
      <NavArrow dir={-1} onClick={prev} disabled={activeIdx === 0} />
      <NavArrow dir={1}  onClick={next} disabled={activeIdx === APPS.length - 1} />

      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "0 80px" }}
        className="apps-inner">

        {/* ── Heading ───────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p style={{
            fontFamily:    "var(--font-body, var(--font-sans))",
            fontSize:      "0.72rem",
            fontWeight:    600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color:         "#bbb",
            margin:        "0 0 0.75rem",
          }}>
            Our toolkit
          </p>
          <h2 style={{
            fontFamily:    "var(--font-sans)",
            fontSize:      "clamp(2.2rem, 5vw, 4rem)",
            fontWeight:    700,
            letterSpacing: "-0.03em",
            margin:        "0 0 1rem",
            lineHeight:    1.05,
          }}>
            <span style={blendWhite}>Moulded around your </span>
            <span style={blendOrange}>business.</span>
          </h2>
          <p style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize:   "clamp(0.9rem, 1.6vw, 1.05rem)",
            color:      "#666",
            maxWidth:   500,
            margin:     "0 auto",
            lineHeight: 1.65,
          }}>
            Whatever your operation needs — we build the tools and systems to make it run smarter.
          </p>
        </div>

        {/* ── Card track ────────────────────────────────────────────────── */}
        <div
          ref={trackRef}
          className="apps-track"
          style={{
            display:            "flex",
            gap:                "1.1rem",
            overflowX:          "auto",
            scrollSnapType:     "x mandatory",
            scrollbarWidth:     "none",
            msOverflowStyle:    "none" as React.CSSProperties["msOverflowStyle"],
            paddingBottom:      "0.5rem",
            WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          }}
        >
          {APPS.map(app => <AppCard key={app.name} app={app} />)}
        </div>

        {/* ── Dot indicators ────────────────────────────────────────────── */}
        <div style={{
          display:        "flex",
          justifyContent: "center",
          alignItems:     "center",
          gap:            "0.45rem",
          marginTop:      "1.6rem",
        }}>
          {APPS.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Go to ${APPS[i].name}`}
              style={{
                width:        i === activeIdx ? 22 : 7,
                height:       7,
                borderRadius: 4,
                background:   i === activeIdx ? "hsl(22,69%,44%)" : "rgba(0,0,0,0.16)",
                border:       "none",
                cursor:       "pointer",
                padding:      0,
                outline:      "none",
                transition:   "all 0.28s ease",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .apps-track::-webkit-scrollbar { display: none; }
        /* Mobile: peek carousel — cards almost full-width, side cards peek */
        @media (max-width: 767px) {
          .apps-inner { padding: 0 !important; }
          .app-card {
            width: calc(82vw) !important;
            border-radius: 18px !important;
          }
          .apps-track {
            padding-inline: calc(9vw) !important;
            scroll-padding-inline: calc(9vw) !important;
            gap: 0.8rem !important;
          }
          .apps-nav-arrow { display: none !important; }
        }
      `}</style>
    </section>
  );
}
