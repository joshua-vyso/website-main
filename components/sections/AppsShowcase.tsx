"use client";
import { useEffect, useRef } from "react";
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

/* ── Custom "+build" icon ────────────────────────────────────────────────── */
function CustomIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 310 310" fill="none">
      <defs>
        <linearGradient id="ci-bg2" x1="0" y1="0" x2="310" y2="310">
          <stop stopColor="#9B7FF6"/><stop offset="1" stopColor="#5B3DD6"/>
        </linearGradient>
      </defs>
      <rect width="310" height="310" rx="52" fill="url(#ci-bg2)"/>
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
    image:   null as string | null,
  },
  {
    name:    "StockPulse",
    tagline: "Real-time inventory, always in control.",
    desc:    "Live stock tracking, low-stock alerts and automated reorder triggers.",
    Icon:    StockPulseIcon,
    color:   "#8D75F4",
    image:   "/assets/inventory.png",
  },
  {
    name:    "WasteLog",
    tagline: "Track waste. Cut costs.",
    desc:    "Daily wastage capture, category breakdown and trend reporting.",
    Icon:    WasteLogIcon,
    color:   "#086B62",
    image:   "/assets/wastage.png",
  },
  {
    name:    "SupplierHub",
    tagline: "Supplier management, simplified.",
    desc:    "Centralised supplier contact, pricing, performance and order history.",
    Icon:    SupplierHubIcon,
    color:   "#1167D8",
    image:   "/assets/suppliers.png",
  },
  {
    name:    "ShiftBoard",
    tagline: "Smarter scheduling, better teams.",
    desc:    "Staff scheduling, attendance logging and time tracking — all in one place.",
    Icon:    ShiftBoardIcon,
    color:   "#F46A00",
    image:   "/assets/labour.png",
  },
  {
    name:    "OrderFlow",
    tagline: "From order to delivery, seamlessly.",
    desc:    "Track customer orders in real-time from placement through to delivery.",
    Icon:    OrderFlowIcon,
    color:   "#CB1552",
    image:   null as string | null,
  },
  {
    name:    "MarginView",
    tagline: "Know your margins, live.",
    desc:    "Real-time margin dashboards per product, category and customer.",
    Icon:    MarginViewIcon,
    color:   "#17A858",
    image:   "/assets/reporting.png",
  },
  {
    name:    "ReportGen",
    tagline: "Reports that tell you what matters.",
    desc:    "Automated weekly and monthly reports with the insights you need to act.",
    Icon:    ReportGenIcon,
    color:   "#E6A800",
    image:   "/assets/reporting.png",
  },
];

/* ── Feature badges ──────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    color: "#7B5CF0",
    title: "Built for you",
    sub:   "Systems designed around your operation.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: "#1167D8",
    title: "Secure & reliable",
    sub:   "Enterprise-grade security you can trust.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    color: "#F46A00",
    title: "Scalable by design",
    sub:   "Grows with your business, from day one.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
        <path d="M6 9v6M18 9a6 6 0 00-6 6"/>
      </svg>
    ),
    color: "#17A858",
    title: "Integrated & connected",
    sub:   "Everything works together, so you can work smarter.",
  },
];

/* ── Single app card ─────────────────────────────────────────────────────── */
function AppCard({ app }: { app: typeof APPS[0] }) {
  return (
    <div style={{
      width:         "100%",
      height:        "100%",
      background:    "#fff",
      borderRadius:  24,
      overflow:      "hidden",
      boxShadow:     "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      display:       "flex",
      flexDirection: "column",
      userSelect:    "none",
      border:        "1px solid rgba(0,0,0,0.06)",
    }}>
      {/* Top info area */}
      <div style={{ padding: "1.6rem 1.6rem 1.2rem", flex: "0 0 auto" }}>
        <app.Icon size={52} />

        <h3 style={{
          fontFamily:    "var(--font-sans)",
          fontSize:      "1.25rem",
          fontWeight:    700,
          color:         "#0d0d0d",
          letterSpacing: "-0.015em",
          margin:        "0.85rem 0 0.2rem",
          lineHeight:    1.2,
        }}>
          {app.name}
        </h3>

        <p style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize:   "0.78rem",
          fontWeight: 600,
          color:      app.color,
          margin:     "0 0 0.55rem",
          lineHeight: 1.4,
        }}>
          {app.tagline}
        </p>

        {/* Accent line */}
        <div style={{
          width:        28,
          height:       2.5,
          borderRadius: 2,
          background:   app.color,
          opacity:      0.65,
        }} />
      </div>

      {/* Mockup image or placeholder */}
      <div style={{
        flex:       1,
        background: app.image ? "#f4f4f6" : `linear-gradient(145deg, ${app.color}12, ${app.color}06)`,
        overflow:   "hidden",
        position:   "relative",
        minHeight:  200,
      }}>
        {app.image ? (
          <img
            src={app.image}
            alt={app.name}
            style={{
              width:          "100%",
              height:         "100%",
              objectFit:      "cover",
              objectPosition: "top center",
              display:        "block",
            }}
          />
        ) : (
          <div style={{
            width:          "100%",
            height:         "100%",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            "0.8rem",
            padding:        "1.5rem",
            boxSizing:      "border-box",
          }}>
            <div style={{ width: "100%", maxWidth: 180 }}>
              <div style={{ height: 8, borderRadius: 4, background: `${app.color}28`, marginBottom: 8, width: "80%" }} />
              <div style={{ height: 6, borderRadius: 4, background: `${app.color}1c`, marginBottom: 8, width: "60%" }} />
              <div style={{ height: 48, borderRadius: 10, background: `${app.color}14`, marginBottom: 8, border: `1px solid ${app.color}22` }} />
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <div style={{ height: 36, flex: 1, borderRadius: 10, background: `${app.color}14`, border: `1px solid ${app.color}22` }} />
                <div style={{ height: 36, flex: 1, borderRadius: 10, background: `${app.color}14`, border: `1px solid ${app.color}22` }} />
              </div>
              <div style={{ height: 6, borderRadius: 4, background: `${app.color}1c`, width: "70%" }} />
              <div style={{ height: 6, borderRadius: 4, background: `${app.color}1c`, marginTop: 6, width: "50%" }} />
            </div>
            <p style={{
              fontFamily: "var(--font-body, var(--font-sans))",
              fontSize:   "0.78rem",
              color:      `${app.color}bb`,
              fontWeight: 600,
              margin:     0,
              textAlign:  "center",
              lineHeight: 1.5,
            }}>
              Your idea.<br/>Our build.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const swiperInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const { Swiper } = await import("swiper");
      const { Navigation, Pagination, EffectCoverflow, A11y } = await import("swiper/modules");
      if (destroyed || !containerRef.current) return;

      const sw = new Swiper(containerRef.current, {
        modules:        [Navigation, Pagination, EffectCoverflow, A11y],
        effect:         "coverflow",
        grabCursor:     true,
        centeredSlides: true,
        slidesPerView:  "auto",
        initialSlide:   0,
        coverflowEffect: {
          rotate:       0,
          stretch:      0,
          depth:        130,
          modifier:     2.0,
          slideShadows: false,
        },
        navigation: {
          nextEl: ".apps-next",
          prevEl: ".apps-prev",
        },
        pagination: {
          el:        ".apps-pagination",
          clickable: true,
        },
        a11y: {
          prevSlideMessage: "Previous app",
          nextSlideMessage: "Next app",
        },
      });

      swiperInstanceRef.current = sw;
    })();

    return () => {
      destroyed = true;
      const sw = swiperInstanceRef.current as { destroy?: () => void } | null;
      sw?.destroy?.();
    };
  }, []);

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

      {/* ── Carousel + nav arrows ─────────────────────────────────────── */}
      <div style={{ position: "relative" }}>

        {/* ← Prev */}
        <button className="apps-prev" aria-label="Previous app" style={navBtnStyle("left")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>

        {/* → Next */}
        <button className="apps-next" aria-label="Next app" style={navBtnStyle("right")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </button>

        {/* Swiper */}
        <div ref={containerRef} className="swiper apps-swiper">
          <div className="swiper-wrapper">
            {APPS.map(app => (
              <div key={app.name} className="swiper-slide apps-slide">
                <AppCard app={app} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination dots */}
      <div className="apps-pagination" style={{ marginTop: "1.6rem", textAlign: "center" }} />

      {/* ── Feature badges ──────────────────────────────────────────────── */}
      <div className="apps-features" style={{
        display:        "flex",
        justifyContent: "center",
        gap:            "1rem",
        padding:        "2.5rem 2rem 0",
        flexWrap:       "wrap",
      }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            display:              "flex",
            alignItems:           "flex-start",
            gap:                  "0.75rem",
            background:           "rgba(255,255,255,0.60)",
            backdropFilter:       "blur(16px) saturate(1.6)",
            WebkitBackdropFilter: "blur(16px) saturate(1.6)",
            border:               "1px solid rgba(255,255,255,0.65)",
            borderRadius:         14,
            padding:              "1rem 1.2rem",
            boxShadow:            "0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
            flex:                 "1 1 180px",
            maxWidth:             260,
            minWidth:             170,
          }}>
            <div style={{
              width:          36, height: 36, borderRadius: 10,
              background:     `${f.color}15`, border: `1px solid ${f.color}30`,
              display:        "flex", alignItems: "center", justifyContent: "center",
              flexShrink:     0, color: f.color,
            }}>
              {f.icon}
            </div>
            <div>
              <p style={{
                fontFamily:    "var(--font-sans)", fontSize: "0.88rem", fontWeight: 700,
                color:         "#0d0d0d", margin: "0 0 0.2rem", letterSpacing: "-0.01em",
              }}>{f.title}</p>
              <p style={{
                fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.76rem",
                color:      "#888", margin: 0, lineHeight: 1.5,
              }}>{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .apps-swiper {
          width: 100%;
          padding: 24px 0 12px !important;
          overflow: visible !important;
        }
        .apps-slide {
          width: 300px !important;
          height: 480px !important;
        }

        /* ── Pagination dots ── */
        .apps-pagination .swiper-pagination-bullet {
          width: 7px; height: 7px;
          background: rgba(0,0,0,0.16);
          opacity: 1; border-radius: 4px;
          transition: all 0.28s ease;
          margin: 0 4px !important;
        }
        .apps-pagination .swiper-pagination-bullet-active {
          width: 22px !important;
          background: hsl(22,69%,44%) !important;
        }

        /* ── Nav arrow hover ── */
        .apps-prev:hover:not(:disabled),
        .apps-next:hover:not(:disabled) {
          background: hsl(22,69%,44%) !important;
          color: #fff !important;
          border-color: hsl(22,69%,44%) !important;
        }
        .apps-prev.swiper-button-disabled,
        .apps-next.swiper-button-disabled {
          opacity: 0.3 !important;
          pointer-events: none;
        }
        .apps-prev::after,
        .apps-next::after { display: none; }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .apps-slide {
            width: 82vw !important;
            height: 440px !important;
          }
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

/* ── Nav button shared style ─────────────────────────────────────────────── */
function navBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position:             "absolute",
    [side]:               "clamp(0.5rem, 3vw, 2.5rem)",
    top:                  "50%",
    transform:            "translateY(-50%)",
    zIndex:               10,
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
}
