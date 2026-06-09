"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useInView } from "@/hooks/useInView";

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

/* ── Liquid glass constants ───────────────────────────────────────────────── */
const GLASS = {
  background:           "rgba(255,255,255,0.52)",
  backdropFilter:       "blur(22px) saturate(1.9)",
  WebkitBackdropFilter: "blur(22px) saturate(1.9)",
  border:               "1px solid rgba(255,255,255,0.68)",
} as const;
const GLASS_SHADOW = [
  "inset 0 1.5px 0 rgba(255,255,255,0.88)",
  "inset 0 -1px 0 rgba(0,0,0,0.04)",
  "0 0 0 0.5px rgba(255,255,255,0.30)",
  "0 8px 32px rgba(0,0,0,0.08)",
].join(", ");
const GLASS_SHADOW_ACTIVE = [
  "inset 0 1.5px 0 rgba(255,255,255,0.92)",
  "inset 0 -1px 0 rgba(0,0,0,0.04)",
  "0 0 0 0.5px rgba(255,255,255,0.36)",
  "0 28px 72px rgba(0,0,0,0.18)",
  "0 4px 16px rgba(0,0,0,0.08)",
].join(", ");

/* ── Checkmark ────────────────────────────────────────────────────────────── */
function Check({ muted = false }: { muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="9" cy="9" r="8.25" stroke={muted ? "hsl(22,69%,44%)" : "hsl(22,69%,44%)"} strokeOpacity={muted ? 0.4 : 0.9} strokeWidth="1.4"/>
      <path d="M5.5 9l2.5 2.5L12.5 6.5" stroke={muted ? "hsl(22,69%,44%)" : "hsl(22,69%,44%)"}
        strokeOpacity={muted ? 0.4 : 0.9} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Audit banner ─────────────────────────────────────────────────────────── */
function AuditBanner() {
  return (
    <div style={{
      ...GLASS,
      borderRadius:  18,
      boxShadow:     GLASS_SHADOW,
      padding:       "1.6rem 2rem",
      display:       "flex",
      alignItems:    "center",
      gap:           "2rem",
      flexWrap:      "wrap",
      marginBottom:  "2rem",
    }}>
      {/* Icon + title */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", flexShrink: 0 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "hsl(22,69%,44%)18",
          border: "1px solid hsl(22,69%,44%)35",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke="hsl(22,69%,44%)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            <path d="M8 11h6M11 8v6" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.7rem",
            fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "hsl(22,69%,44%)", margin: "0 0 0.1rem" }}>
            Required first
          </p>
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "1.4rem", fontWeight: 800,
            color: "#0d0d0d", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Audit
          </h3>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "1.1rem", fontWeight: 700,
            color: "hsl(22,69%,44%)", margin: "0.1rem 0 0" }}>
            R5,000 <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#888" }}>once-off</span>
          </p>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.83rem",
        color: "#666", lineHeight: 1.55, margin: 0, flexShrink: 0, maxWidth: 220 }}>
        Operational diagnostics period spanning 7 days.
      </p>

      {/* Feature list */}
      <div style={{ display: "flex", gap: "0.5rem 2.2rem", flex: 1, flexWrap: "wrap", minWidth: 0 }}>
        {[
          "Operations review",
          "Bottleneck identification",
          "Automation opportunities",
          "Recommendations report",
          "7-day diagnostic period",
        ].map(f => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <Check muted />
            <span style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.8rem",
              color: "#555", whiteSpace: "nowrap" }}>{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <a href="#contact" style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.65rem 1.4rem", borderRadius: 50,
          border: "1.5px solid hsl(22,69%,44%)",
          background: "transparent", color: "hsl(22,69%,44%)",
          fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.85rem",
          fontWeight: 600, textDecoration: "none", cursor: "pointer",
          transition: "background 0.2s, color 0.2s",
          whiteSpace: "nowrap",
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = "hsl(22,69%,44%)";
            el.style.color = "#fff";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = "transparent";
            el.style.color = "hsl(22,69%,44%)";
          }}
        >
          Request an audit
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5"/>
          </svg>
        </a>
        <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.68rem",
          color: "#aaa", margin: "0.4rem 0 0" }}>
          Required before implementation
        </p>
      </div>
    </div>
  );
}

/* ── Tier data ────────────────────────────────────────────────────────────── */
const TIERS = [
  {
    num:      "Tier 1",
    name:     "Start",
    tagline:  "Quick operational wins using your existing tools.",
    featured: false,
    features: [
      { text: "Workflow automation setup", sub: "using existing tools" },
      { text: "30-day support period post-setup", sub: "" },
    ],
    pricing: [
      { label: "Once off fee", value: "R8,000",           highlight: false },
      { label: "Retainer",     value: "R4,000",  unit: "/month", highlight: false },
    ],
    cta: "Get started",
  },
  {
    num:      "Tier 2",
    name:     "Build",
    tagline:  "Replace spreadsheets and WhatsApp with a system your team uses daily.",
    featured: true,
    features: [
      { text: "Everything in Start",                          sub: "" },
      { text: "Access to one lightweight web or mobile app", sub: "" },
      { text: "Automations integrated into the app",         sub: "" },
      { text: "Team onboarding and 60-day support",          sub: "" },
      { text: "One round of post-launch revisions",          sub: "" },
    ],
    pricing: [
      { label: "Build fee",         value: "From R30,000",  unit: "",       highlight: true },
      { label: "Monthly retainer",  value: "R8,000",        unit: "/month", highlight: true },
    ],
    cta: "Talk to us",
  },
  {
    num:      "Tier 3",
    name:     "Scale",
    tagline:  "An ongoing ops partner for growing teams.",
    featured: false,
    features: [
      { text: "Everything in Build",                    sub: "" },
      { text: "Unlimited access to the Vyso toolkit",  sub: "" },
      { text: "Full ops intelligence platform",         sub: "" },
      { text: "Third-party integrations",               sub: "" },
      { text: "Monthly ops review and reporting",       sub: "" },
      { text: "Priority development & support",         sub: "" },
    ],
    pricing: [
      { label: "Setup fee",        value: "From R50,000",  unit: "",       highlight: false, note: "includes build + integrations" },
      { label: "Monthly retainer", value: "From R10,000",  unit: "/month", highlight: false, note: "increases with each app" },
    ],
    cta: "Talk to us",
  },
];

/* ── Coverflow geometry ───────────────────────────────────────────────────── */
const CARD_W   = 380;
const CARD_H   = 560;
const STEP     = 340;

function tierTransform(diff: number) {
  const abs  = Math.abs(diff);
  if (abs > 1.6) return null;
  const scale = 1 - abs * 0.115;
  const tx    = diff * STEP;
  const ry    = diff * 10;
  const zi    = Math.round(10 - abs * 6);
  const op    = 1 - abs * 0.13;
  return { scale, tx, ry, zi, op };
}

/* ── Tier card ────────────────────────────────────────────────────────────── */
function TierCard({ tier, active }: { tier: typeof TIERS[0]; active: boolean }) {
  return (
    <div style={{
      ...GLASS,
      width:         CARD_W,
      height:        CARD_H,
      borderRadius:  22,
      boxShadow:     active ? GLASS_SHADOW_ACTIVE : GLASS_SHADOW,
      display:       "flex",
      flexDirection: "column",
      padding:       "1.8rem 1.8rem 1.6rem",
      boxSizing:     "border-box",
      overflow:      "hidden",
      userSelect:    "none",
      position:      "relative",
    }}>
      {/* Most Popular badge */}
      {tier.featured && (
        <div style={{
          position: "absolute", top: "1.2rem", right: "1.2rem",
          background: "hsl(22,69%,44%)",
          color: "#fff",
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize: "0.65rem", fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "0.3rem 0.7rem", borderRadius: 50,
          display: "flex", alignItems: "center", gap: "0.3rem",
        }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="#fff">
            <path d="M6 0l1.5 3.5L11 4.2l-2.5 2.4.6 3.4L6 8.4l-3.1 1.6.6-3.4L1 4.2l3.5-.7z"/>
          </svg>
          Most Popular
        </div>
      )}

      {/* Tier label */}
      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.68rem",
        fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
        color: tier.featured ? "hsl(22,69%,44%)" : "#b0aaa4",
        margin: "0 0 0.5rem",
      }}>
        {tier.num}
      </p>

      {/* Tier name */}
      <h3 style={{
        fontFamily: "var(--font-sans)", fontSize: "2.2rem", fontWeight: 800,
        color: "#0d0d0d", letterSpacing: "-0.03em", margin: "0 0 0.35rem", lineHeight: 1,
      }}>
        {tier.name}
      </h3>

      {/* Accent line */}
      <div style={{
        width: 30, height: 2.5, borderRadius: 2,
        background: tier.featured
          ? "linear-gradient(90deg, hsl(22,69%,44%), hsl(30,82%,57%))"
          : "rgba(0,0,0,0.15)",
        marginBottom: "0.7rem",
      }} />

      {/* Tagline */}
      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.82rem",
        color: "#666", lineHeight: 1.5, margin: "0 0 1.1rem",
      }}>
        {tier.tagline}
      </p>

      {/* Features */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex",
        flexDirection: "column", gap: "0.55rem" }}>
        {tier.features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <Check />
            <span>
              <span style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.82rem",
                color: "#333", lineHeight: 1.4 }}>{f.text}</span>
              {f.sub && (
                <span style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.74rem",
                  color: "#aaa", display: "block", marginTop: 1 }}>{f.sub}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Pricing row */}
      <div style={{ display: "flex", gap: "1.5rem", marginTop: "1.2rem", marginBottom: "1rem" }}>
        {tier.pricing.map((p, i) => (
          <div key={i}>
            <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.65rem",
              fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "#aaa", margin: "0 0 0.2rem" }}>
              {p.label}
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "1.15rem", fontWeight: 800,
              color: p.highlight ? "hsl(22,69%,44%)" : "#0d0d0d",
              margin: 0, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {p.value}
              {p.unit && <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "#888" }}> {p.unit}</span>}
            </p>
            {"note" in p && p.note && (
              <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.65rem",
                color: "#bbb", margin: "0.1rem 0 0", lineHeight: 1.3 }}>{p.note}</p>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => { window.location.href = "#contact"; }}
        style={{
          width:      "100%",
          padding:    "0.78rem 1.4rem",
          borderRadius: 50,
          border:     tier.featured ? "none" : "1.5px solid rgba(0,0,0,0.14)",
          background: tier.featured
            ? "linear-gradient(135deg, hsl(30,82%,57%), hsl(22,69%,44%), hsl(14,72%,36%))"
            : "rgba(255,255,255,0.6)",
          color:      tier.featured ? "#fff" : "#0d0d0d",
          fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.88rem",
          fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: "0.4rem",
          transition: "opacity 0.2s, transform 0.15s",
          outline: "none",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
      >
        {tier.cta}
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Feature badges ───────────────────────────────────────────────────────── */
const TRUST = [
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    color: "#F46A00", title: "Transparent pricing", sub: "No lock-in contracts." },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    color: "#7B5CF0", title: "Ongoing support", sub: "Real people. Fast responses." },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    color: "#1167D8", title: "Secure & reliable", sub: "Your data, always protected." },
  { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    color: "#17A858", title: "Built to scale", sub: "From day one to where you're going." },
];

/* ── Main component ───────────────────────────────────────────────────────── */
export function PricingSection() {
  const { ref: sectionRef, inView } = useInView<HTMLElement>({ threshold: 0.05 });
  const stageRef    = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(1);           // default: Build
  const n = TIERS.length;

  const prev = useCallback(() => setActive(a => Math.max(0, a - 1)), []);
  const next = useCallback(() => setActive(a => Math.min(n - 1, a + 1)), [n]);

  /* ── Cursor-driven card tracking ─────────────────────────────────────────
     Divides the section into 3 zones. Moving the cursor left/right shifts
     which tier card is centred. Hysteresis (±5% deadband at zone edges)
     prevents flickering when hovering near a boundary.                     */
  const lastCursorZone = useRef<number>(1);
  useEffect(() => {
    const section = sectionRef.current as HTMLElement | null;
    if (!section) return;
    const onMove = (e: MouseEvent) => {
      const rect  = section.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) return;
      const ratio = (e.clientX - rect.left) / rect.width; // 0→1
      const DEAD  = 0.05;
      const zones = [1/3, 2/3];
      let zone    = lastCursorZone.current;
      if (ratio < zones[0] - DEAD)        zone = 0;
      else if (ratio > zones[1] + DEAD)   zone = 2;
      else if (ratio > zones[0] + DEAD && ratio < zones[1] - DEAD) zone = 1;
      if (zone !== lastCursorZone.current) {
        lastCursorZone.current = zone;
        setActive(zone);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* ── Trackpad horizontal swipe ───────────────────────────────────────────*/
  const wheelAccum    = useRef(0);
  const wheelCooldown = useRef(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) return;
      e.preventDefault();
      if (wheelCooldown.current) return;
      wheelAccum.current += e.deltaX;
      if (wheelAccum.current > 60) {
        wheelAccum.current    = 0;
        wheelCooldown.current = true;
        next();
        setTimeout(() => { wheelCooldown.current = false; }, 380);
      } else if (wheelAccum.current < -60) {
        wheelAccum.current    = 0;
        wheelCooldown.current = true;
        prev();
        setTimeout(() => { wheelCooldown.current = false; }, 380);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [prev, next]);

  /* ── Touch drag (mobile) ─────────────────────────────────────────────── */
  const dragStart = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientX; };
  const onPointerUp   = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    if (dx < -40) next();
    else if (dx > 40) prev();
    dragStart.current = null;
  };

  /* ── Keyboard ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [prev, next]);

  return (
    <section
      ref={sectionRef as React.Ref<HTMLElement>}
      id="pricing"
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "transparent",
        boxSizing:      "border-box",
        padding:        "5rem 1.5rem 4rem",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      <div style={{ maxWidth: 1100, width: "100%" }}>

        {/* ── Heading ───────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "#bbb", margin: "0 0 0.75rem",
          }}>
            Pricing
          </p>
          <h2 style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(2.2rem, 5vw, 4rem)", fontWeight: 700,
            letterSpacing: "-0.03em", margin: "0 0 0.9rem", lineHeight: 1.05,
          }}>
            <span style={blendWhite}>Simple pricing.</span>
            <br />
            <span style={blendWhite}>No </span>
            <span style={blendOrange}>surprises.</span>
          </h2>
          <p style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize: "clamp(0.9rem, 1.5vw, 1rem)", color: "#666",
            maxWidth: 440, margin: "0 auto", lineHeight: 1.65,
          }}>
            Every engagement starts with clarity.<br/>
            Choose the path that fits your operation.
          </p>
        </div>

        {/* ── Audit banner ──────────────────────────────────────────────── */}
        <AuditBanner />

        {/* ── Coverflow + arrows ─────────────────────────────────────────── */}
        <div style={{ position: "relative" }}>
          {/* Prev arrow */}
          <button
            onClick={prev}
            disabled={active === 0}
            aria-label="Previous tier"
            className="price-nav-btn"
            style={{ ...NAV_BTN_BASE, left: "clamp(0rem, 1vw, 0.5rem)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
          </button>

          {/* Next arrow */}
          <button
            onClick={next}
            disabled={active === n - 1}
            aria-label="Next tier"
            className="price-nav-btn"
            style={{ ...NAV_BTN_BASE, right: "clamp(0rem, 1vw, 0.5rem)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
          </button>

          {/* Stage */}
          <div
            ref={stageRef}
            style={{
              position:    "relative",
              width:       "100%",
              height:      CARD_H + 48,
              perspective: 1400,
              overflow:    "hidden",
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            {TIERS.map((tier, i) => {
              const diff = i - active;
              const t    = tierTransform(diff);
              if (!t) return null;
              return (
                <div
                  key={tier.name}
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
                    transform: `translate(-50%, -50%) translateX(${t.tx}px) scale(${t.scale}) rotateY(${t.ry}deg)`,
                    transformOrigin: "center center",
                    transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease",
                  }}
                >
                  <TierCard tier={tier} active={diff === 0} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Dot indicators ────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.45rem", marginTop: "1.6rem" }}>
          {TIERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Go to ${TIERS[i].name}`}
              style={{
                width: i === active ? 22 : 7, height: 7,
                borderRadius: 4,
                background: i === active ? "hsl(22,69%,44%)" : "rgba(0,0,0,0.16)",
                border: "none", cursor: "pointer", padding: 0, outline: "none",
                transition: "all 0.28s ease",
              }}
            />
          ))}
        </div>

        {/* ── Feature badges ────────────────────────────────────────────── */}
        <div className="price-features" style={{
          display: "flex", justifyContent: "center", gap: "1rem",
          padding: "2.5rem 0 0", flexWrap: "wrap",
        }}>
          {TRUST.map(f => (
            <div key={f.title} style={{
              display: "flex", alignItems: "flex-start", gap: "0.7rem",
              ...GLASS,
              borderRadius: 14, padding: "0.9rem 1.1rem",
              boxShadow: GLASS_SHADOW,
              flex: "1 1 180px", maxWidth: 250, minWidth: 165,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: `${f.color}15`, border: `1px solid ${f.color}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: f.color,
              }}>
                {f.icon}
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", fontWeight: 700,
                  color: "#0d0d0d", margin: "0 0 0.15rem", letterSpacing: "-0.01em" }}>{f.title}</p>
                <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.74rem",
                  color: "#888", margin: 0, lineHeight: 1.5 }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .price-nav-btn {
          position: absolute;
          top: 50%; transform: translateY(-50%);
          z-index: 20;
          width: 46px; height: 46px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.60);
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #0d0d0d; outline: none;
          transition: background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
        }
        .price-nav-btn:hover:not(:disabled) {
          background: hsl(22,69%,44%); color: #fff; border-color: hsl(22,69%,44%);
        }
        .price-nav-btn:disabled { opacity: 0.25; cursor: default; }

        @media (max-width: 767px) {
          .price-features { padding: 1.8rem 0 0 !important; gap: 0.6rem !important; }
          .price-features > div {
            min-width: calc(50% - 0.3rem) !important;
            max-width: calc(50% - 0.3rem) !important;
            flex: unset !important; padding: 0.8rem !important;
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
  width:                46, height: 46, borderRadius: "50%",
  border:               "1px solid rgba(255,255,255,0.60)",
  background:           "rgba(255,255,255,0.82)",
  backdropFilter:       "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow:            "0 4px 16px rgba(0,0,0,0.10)",
  cursor:               "pointer",
  display:              "flex", alignItems: "center", justifyContent: "center",
  color:                "#0d0d0d", outline: "none",
  transition:           "background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s",
};
