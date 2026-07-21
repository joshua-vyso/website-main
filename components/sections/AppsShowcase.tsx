"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useCallback, useRef, useEffect } from "react";
import { useInView } from "@/hooks/useInView";
import {
  StockPulseIcon, WasteLogIcon, MarginViewIcon, SupplierHubIcon,
  ShiftBoardIcon, OrderFlowIcon, ReportGenIcon,
} from "@/components/ui/AppIcons";

/* ── Blend helpers ────────────────────────────────────────────────────────── */
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

/* ── Module icons that are not part of the original sprite ───────────────── */
function CustomIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 310 310" fill="none">
      <defs>
        <linearGradient id="custom-module-bg" x1="0" y1="0" x2="310" y2="310">
          <stop stopColor="#9B7FF6"/><stop offset="1" stopColor="#5B3DD6"/>
        </linearGradient>
      </defs>
      <rect width="310" height="310" rx="52" fill="url(#custom-module-bg)"/>
      <path d="M155 85V225M85 155H225" stroke="#FFF" strokeWidth="30" strokeLinecap="round"/>
    </svg>
  );
}

function DocUIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 310 310" fill="none">
      <defs>
        <linearGradient id="ci-bg3" x1="0" y1="0" x2="310" y2="310">
          <stop stopColor="#9B7FF6"/><stop offset="1" stopColor="#5B3DD6"/>
        </linearGradient>
      </defs>
      <rect width="310" height="310" rx="52" fill="url(#ci-bg3)"/>
      <path d="M96 63h82l48 48v136H96V63Z" fill="rgba(255,255,255,.18)" stroke="#FFF" strokeWidth="14" strokeLinejoin="round"/>
      <path d="M178 63v52h48M122 155h78M122 190h64" stroke="#FFF" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PlanWiseIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 310 310" fill="none">
      <defs>
        <linearGradient id="pw-bg" x1="0" y1="0" x2="310" y2="310">
          <stop stopColor="#F39B45"/><stop offset="1" stopColor="#B9571E"/>
        </linearGradient>
      </defs>
      <rect width="310" height="310" rx="52" fill="url(#pw-bg)"/>
      <circle cx="155" cy="155" r="82" stroke="rgba(255,255,255,.45)" strokeWidth="16"/>
      <circle cx="155" cy="155" r="44" stroke="#FFF" strokeWidth="16"/>
      <path d="M155 155L222 88M190 88h32v32" stroke="#FFF" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── App data ─────────────────────────────────────────────────────────────── */
const APPS = [
  {
    name:    "Custom Modules",
    tagline: "Built around the way you work.",
    Icon:    CustomIcon,
    color:   "#7B5CF0",
    image:   null as string | null,
  },
  {
    name:    "Doc-U",
    tagline: "Documents in. Clean data out.",
    Icon:    DocUIcon,
    color:   "#7B5CF0",
    image:   "/assets/app-docu.png",
  },
  {
    name:    "ProcurePulse",
    tagline: "Procurement and stock intelligence.",
    Icon:    StockPulseIcon,
    color:   "#8D75F4",
    image:   "/assets/app-stockpulse.png",
  },
  {
    name:    "WasteWatch",
    tagline: "Make preventable waste visible.",
    Icon:    WasteLogIcon,
    color:   "#086B62",
    image:   "/assets/app-wastelog.png",
  },
  {
    name:    "SupplySync",
    tagline: "Supplier relationships, searchable.",
    Icon:    SupplierHubIcon,
    color:   "#1167D8",
    image:   "/assets/app-supplierhub.png",
  },
  {
    name:    "ShiftBoard",
    tagline: "Smarter scheduling, better teams.",
    Icon:    ShiftBoardIcon,
    color:   "#F46A00",
    image:   "/assets/app-shiftboard.png",
  },
  {
    name:    "OrderFlow",
    tagline: "From order to delivery, seamlessly.",
    Icon:    OrderFlowIcon,
    color:   "#CB1552",
    image:   "/assets/app-orderflow.png",
  },
  {
    name:    "PricePilot",
    tagline: "Pricing and margin recommendations.",
    Icon:    MarginViewIcon,
    color:   "#17A858",
    image:   "/assets/app-marginview.png",
  },
  {
    name:    "PlanWise",
    tagline: "Budgeting and forecasting that stays useful.",
    Icon:    PlanWiseIcon,
    color:   "#B9571E",
    image:   null as string | null,
  },
  {
    name:    "InsightGen",
    tagline: "Operational reports that explain what matters.",
    Icon:    ReportGenIcon,
    color:   "#E6A800",
    image:   "/assets/app-reportgen.png",
  },
];

/* ── Feature badges ──────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    color: "#7B5CF0",
    title: "Built for you",
    sub:   "Systems designed around your operation.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: "#1167D8",
    title: "Secure & reliable",
    sub:   "Access controls and dependable workflows.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    color: "#F46A00",
    title: "Scalable by design",
    sub:   "Grows with your business, from day one.",
  },
  {
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
        <path d="M6 9v6M18 9a6 6 0 00-6 6"/>
      </svg>
    ),
    color: "#17A858",
    title: "Integrated & connected",
    sub:   "Everything works together, so you can work smarter.",
  },
];

/* ── Coverflow card layout constants ─────────────────────────────────────── */
const CARD_W  = 300;  // px — active card width
const CARD_H  = 480;  // px — active card height
const STEP    = 230;  // px — horizontal spacing between card centers
const MAX_VIS = 2;    // cards visible each side of center

function cardTransform(diff: number) {
  const abs = Math.abs(diff);
  if (abs > MAX_VIS) return null;
  const sign   = diff < 0 ? -1 : diff > 0 ? 1 : 0;
  const scale  = abs === 0 ? 1 : abs === 1 ? 0.875 : 0.76;
  const tx     = sign * STEP * abs;
  const ry     = sign * (abs === 0 ? 0 : abs === 1 ? 12 : 20);
  const zi     = 10 - abs;
  const op     = abs === 0 ? 1 : abs === 1 ? 0.92 : 0.80;
  return { scale, tx, ry, zi, op };
}

/* ── Single card ─────────────────────────────────────────────────────────── */
function AppCard({ app, active }: { app: typeof APPS[0]; active: boolean }) {
  return (
    <div style={{
      width:                CARD_W,
      height:               CARD_H,
      background:           "rgba(255,255,255,0.52)",
      backdropFilter:       "blur(22px) saturate(1.9)",
      WebkitBackdropFilter: "blur(22px) saturate(1.9)",
      borderRadius:         24,
      overflow:             "hidden",
      display:              "flex",
      flexDirection:        "column",
      border:               "1px solid rgba(255,255,255,0.68)",
      boxShadow:            active ? [
        "inset 0 1.5px 0 rgba(255,255,255,0.90)",
        "inset 0 -1px 0 rgba(0,0,0,0.04)",
        "0 0 0 0.5px rgba(255,255,255,0.32)",
        "0 24px 64px rgba(0,0,0,0.16)",
        "0 4px 16px rgba(0,0,0,0.08)",
      ].join(", ") : [
        "inset 0 1.5px 0 rgba(255,255,255,0.82)",
        "inset 0 -1px 0 rgba(0,0,0,0.03)",
        "0 0 0 0.5px rgba(255,255,255,0.28)",
        "0 6px 24px rgba(0,0,0,0.07)",
      ].join(", "),
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 1.5rem 1.1rem", flexShrink: 0 }}>
        <app.Icon size={50} />
        <h3 style={{
          fontFamily:    "var(--font-sans)",
          fontSize:      "1.2rem",
          fontWeight:    700,
          color:         "#0d0d0d",
          letterSpacing: "-0.015em",
          margin:        "0.8rem 0 0.15rem",
          lineHeight:    1.2,
        }}>
          {app.name}
        </h3>
        <p style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize:   "0.77rem",
          fontWeight: 600,
          color:      app.color,
          margin:     "0 0 0.5rem",
          lineHeight: 1.4,
        }}>
          {app.tagline}
        </p>
        <div style={{ width: 26, height: 2.5, borderRadius: 2, background: app.color, opacity: 0.6 }} />
      </div>

      {/* Mockup area */}
      <div style={{
        flex:       1,
        background: app.image ? "#f3f3f5" : `linear-gradient(150deg, ${app.color}10, ${app.color}05)`,
        overflow:   "hidden",
        position:   "relative",
      }}>
        {app.image ? (
          <Image
            src={app.image}
            alt={app.name}
            draggable={false}
            fill
            sizes={`${CARD_W}px`}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "0.75rem", padding: "1.5rem", boxSizing: "border-box",
          }}>
            <div style={{ width: "100%", maxWidth: 190 }}>
              {[80, 60, "full", "half"].map((w, j) => (
                j < 2 ? (
                  <div key={j} style={{
                    height: 7, borderRadius: 4,
                    background: `${app.color}25`,
                    width: `${w}%`, marginBottom: 8,
                  }} />
                ) : j === 2 ? (
                  <div key={j} style={{
                    height: 52, borderRadius: 10, marginBottom: 8,
                    background: `${app.color}12`,
                    border: `1px solid ${app.color}20`,
                  }} />
                ) : (
                  <div key={j} style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, height: 38, borderRadius: 10, background: `${app.color}12`, border: `1px solid ${app.color}20` }} />
                    <div style={{ flex: 1, height: 38, borderRadius: 10, background: `${app.color}12`, border: `1px solid ${app.color}20` }} />
                  </div>
                )
              ))}
            </div>
            <p style={{
              fontFamily: "var(--font-body, var(--font-sans))",
              fontSize: "0.76rem", fontWeight: 600,
              color: `${app.color}99`, margin: 0,
              textAlign: "center", lineHeight: 1.5,
            }}>
              {app.name}.<br />Connected to your operation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function AppsShowcase() {
  const { ref: sectionRef, inView } = useInView<HTMLElement>({ threshold: 0.1 });
  const [active, setActive] = useState(0);
  const n = APPS.length;

  const prev = useCallback(() => setActive(a => Math.max(0, a - 1)), []);
  const next = useCallback(() => setActive(a => Math.min(n - 1, a + 1)), [n]);

  /* ── Touch / drag swipe (pointer) ───────────────────────────────────── */
  const dragStart = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientX; };
  const onPointerUp   = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    if (dx < -40) next();
    else if (dx > 40) prev();
    dragStart.current = null;
  };

  /* ── Trackpad / mouse-wheel horizontal swipe ─────────────────────────
     Accumulates deltaX; navigates once the threshold is hit, then
     enforces a 350 ms cooldown so one flick = exactly one step.        */
  const stageRef      = useRef<HTMLDivElement>(null);
  const wheelAccum    = useRef(0);
  const wheelCooldown = useRef(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Only act on primarily-horizontal movement
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) return;

      e.preventDefault();          // stop page scroll while over the carousel
      if (wheelCooldown.current) return;

      wheelAccum.current += e.deltaX;

      if (wheelAccum.current > 60) {
        wheelAccum.current  = 0;
        wheelCooldown.current = true;
        next();
        setTimeout(() => { wheelCooldown.current = false; }, 350);
      } else if (wheelAccum.current < -60) {
        wheelAccum.current  = 0;
        wheelCooldown.current = true;
        prev();
        setTimeout(() => { wheelCooldown.current = false; }, 350);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [prev, next]);

  /* ── Keyboard nav ────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

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
        padding:        "5rem 0 4rem",
        position:       "relative",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      {/* ── Heading ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: "3rem", padding: "0 1.5rem" }}>
        <p style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "#bbb", margin: "0 0 0.75rem",
        }}>
          Our toolkit
        </p>
        <h2 style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(2.2rem, 5vw, 4rem)", fontWeight: 700,
          letterSpacing: "-0.03em", margin: "0 0 1rem", lineHeight: 1.05,
        }}>
          <span className="blend-h-plain" style={blendWhite}>Moulded around your </span>
          <span className="blend-h-orange" style={blendOrange}>business.</span>
        </h2>
        <p style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize: "clamp(0.9rem, 1.6vw, 1.05rem)",
          color: "#666", maxWidth: 500, margin: "0 auto", lineHeight: 1.65,
        }}>
          Start with the workflow causing the most friction, then add connected
          modules as the next operational need becomes clear.
        </p>
        <Link
          href="/platform/vyso-for-smes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            marginTop: "1rem",
            color: "hsl(22,69%,44%)",
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize: "0.86rem",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Explore the Vyso platform <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* ── Coverflow stage ─────────────────────────────────────────────── */}
      <div
        ref={stageRef}
        style={{
          position:   "relative",
          width:      "100%",
          height:     CARD_H + 40,
          perspective: 1200,
          overflow:   "hidden",
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* Nav arrows — sit outside the 3D perspective */}
        <button
          onClick={prev}
          disabled={active === 0}
          aria-label="Previous app"
          className="apps-nav-btn"
          style={{ ...NAV_BTN_BASE, left: "clamp(0.75rem, 3vw, 2.5rem)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>
        <button
          onClick={next}
          disabled={active === n - 1}
          aria-label="Next app"
          className="apps-nav-btn"
          style={{ ...NAV_BTN_BASE, right: "clamp(0.75rem, 3vw, 2.5rem)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </button>

        {/* Cards */}
        {APPS.map((app, i) => {
          const diff = i - active;
          const t    = cardTransform(diff);
          if (!t) return null;
          return (
            <div
              key={app.name}
              onClick={() => setActive(i)}
              style={{
                position:  "absolute",
                top:       "50%",
                left:      "50%",
                width:     CARD_W,
                height:    CARD_H,
                cursor:    diff !== 0 ? "pointer" : "default",
                zIndex:    t.zi,
                opacity:   t.op,
                transform: `
                  translate(-50%, -50%)
                  translateX(${t.tx}px)
                  scale(${t.scale})
                  rotateY(${t.ry}deg)
                `,
                transformOrigin: "center center",
                transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease, box-shadow 0.35s ease",
              }}
            >
              <AppCard app={app} active={diff === 0} />
            </div>
          );
        })}
      </div>

      {/* ── Dot indicators ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.45rem", marginTop: "1.8rem" }}>
        {APPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`Go to ${APPS[i].name}`}
            style={{
              width:        i === active ? 22 : 7,
              height:       7,
              borderRadius: 4,
              background:   i === active ? "hsl(22,69%,44%)" : "rgba(0,0,0,0.16)",
              border:       "none",
              cursor:       "pointer",
              padding:      0,
              outline:      "none",
              transition:   "all 0.28s ease",
            }}
          />
        ))}
      </div>

      {/* ── Feature badges ──────────────────────────────────────────────── */}
      <div className="apps-features" style={{
        display: "flex", justifyContent: "center",
        gap: "1rem", padding: "2.5rem 2rem 0", flexWrap: "wrap",
      }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            display: "flex", alignItems: "flex-start", gap: "0.75rem",
            background:           "rgba(255,255,255,0.60)",
            backdropFilter:       "blur(16px) saturate(1.6)",
            WebkitBackdropFilter: "blur(16px) saturate(1.6)",
            border:               "1px solid rgba(255,255,255,0.65)",
            borderRadius:         14,
            padding:              "1rem 1.2rem",
            boxShadow:            "0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
            flex: "1 1 180px", maxWidth: 260, minWidth: 170,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${f.color}15`, border: `1px solid ${f.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: f.color,
            }}>
              {f.icon}
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.88rem", fontWeight: 700, color: "#0d0d0d", margin: "0 0 0.2rem", letterSpacing: "-0.01em" }}>{f.title}</p>
              <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.76rem", color: "#888", margin: 0, lineHeight: 1.5 }}>{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .apps-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          width: 46px; height: 46px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.60);
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #0d0d0d;
          outline: none;
          transition: background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
        }
        .apps-nav-btn:hover:not(:disabled) {
          background: hsl(22,69%,44%);
          color: #fff;
          border-color: hsl(22,69%,44%);
        }
        .apps-nav-btn:disabled { opacity: 0.28; cursor: default; }

        @media (max-width: 767px) {
          .apps-features {
            padding: 2rem 1rem 0 !important;
            gap: 0.65rem !important;
          }
          .apps-features > div {
            min-width: calc(50% - 0.35rem) !important;
            max-width: calc(50% - 0.35rem) !important;
            flex: unset !important;
            padding: 0.85rem !important;
          }
        }
      `}</style>
    </section>
  );
}

const NAV_BTN_BASE: React.CSSProperties = {
  position:             "absolute",
  top:                  "50%",
  transform:            "translateY(-50%)",
  zIndex:               20,
  width:                46,
  height:               46,
  borderRadius:         "50%",
  border:               "1px solid rgba(255,255,255,0.60)",
  background:           "rgba(255,255,255,0.82)",
  backdropFilter:       "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow:            "0 4px 16px rgba(0,0,0,0.10)",
  cursor:               "pointer",
  display:              "flex",
  alignItems:           "center",
  justifyContent:       "center",
  color:                "#0d0d0d",
  outline:              "none",
  transition:           "background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s",
};
