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
      <circle cx="9" cy="9" r="8.25" stroke="hsl(22,69%,44%)" strokeOpacity={muted ? 0.4 : 0.9} strokeWidth="1.4"/>
      <path d="M5.5 9l2.5 2.5L12.5 6.5" stroke="hsl(22,69%,44%)"
        strokeOpacity={muted ? 0.4 : 0.9} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Audit banner ─────────────────────────────────────────────────────────── */
function AuditBanner() {
  return (
    <div className="audit-banner" style={{
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
          background: "rgba(190,93,35,0.09)",
          border: "1px solid rgba(190,93,35,0.18)",
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
            R3,000 <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#888" }}>once-off</span>
          </p>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.83rem",
        color: "#666", lineHeight: 1.55, margin: 0, flexShrink: 0, maxWidth: 220 }}>
        Operational diagnostics period spanning 7 days.
      </p>

      {/* Feature list */}
      <div className="audit-features" style={{ display: "flex", gap: "0.5rem 2.2rem", flex: 1, flexWrap: "wrap", minWidth: 0 }}>
        {["Operations review","Bottleneck identification","Automation opportunities","Recommendations report","7-day diagnostic period"]
          .map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Check muted />
              <span style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.8rem",
                color: "#555" }}>{f}</span>
            </div>
          ))}
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <button
          onClick={() => { document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.65rem 1.4rem", borderRadius: 50,
            border: "1.5px solid hsl(22,69%,44%)",
            background: "transparent", color: "hsl(22,69%,44%)",
            fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.85rem",
            fontWeight: 600, cursor: "pointer",
            transition: "background 0.2s, color 0.2s", whiteSpace: "nowrap",
            outline: "none",
          }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.background = "hsl(22,69%,44%)"; el.style.color = "#fff"; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = "hsl(22,69%,44%)"; }}
        >
          Book a free discovery call
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5"/>
          </svg>
        </button>
        <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.68rem",
          color: "#aaa", margin: "0.4rem 0 0" }}>Free 15 min · no commitment</p>
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
    features: [
      { text: "Workflow automation setup", sub: "using existing tools" },
      { text: "30-day support period post-setup", sub: "" },
    ],
    pricing: [
      { label: "Once off fee", value: "R8,000",        unit: "" },
      { label: "Retainer",     value: "R4,000",        unit: "/month" },
    ],
    cta: "Get started",
  },
  {
    num:      "Tier 2",
    name:     "Create",
    tagline:  "Replace spreadsheets and WhatsApp with a system your team uses daily.",
    features: [
      { text: "Everything in Start",                          sub: "" },
      { text: "Access to one lightweight web or mobile app", sub: "" },
      { text: "Automations integrated into the app",         sub: "" },
      { text: "Team onboarding and 60-day support",          sub: "" },
      { text: "One round of post-launch revisions",          sub: "" },
    ],
    pricing: [
      { label: "Create fee",       value: "From R30,000", unit: "" },
      { label: "Monthly retainer", value: "R8,000",       unit: "/month" },
    ],
    cta: "Talk to us",
  },
  {
    num:      "Tier 3",
    name:     "Scale",
    tagline:  "An ongoing ops partner for growing teams.",
    features: [
      { text: "Everything in Create",                  sub: "" },
      { text: "Unlimited access to the Vyso toolkit",  sub: "" },
      { text: "Full ops intelligence platform",        sub: "" },
      { text: "Third-party integrations",              sub: "" },
      { text: "Monthly ops review and reporting",      sub: "" },
      { text: "Priority development & support",        sub: "" },
    ],
    pricing: [
      { label: "Setup fee",        value: "From R50,000", unit: "",       note: "includes build + integrations" },
      { label: "Monthly retainer", value: "From R10,000", unit: "/month", note: "increases with each app" },
    ],
    cta: "Talk to us",
  },
];

/* ── Coverflow geometry ───────────────────────────────────────────────────── */
const CARD_W = 380;
const CARD_H = 560;
const STEP   = 340;

function tierTransform(diff: number) {
  const abs = Math.abs(diff);
  if (abs > 1.6) return null;
  return {
    scale: 1 - abs * 0.115,
    tx:    diff * STEP,
    ry:    diff * 10,
    zi:    Math.round(10 - abs * 6),
    op:    1 - abs * 0.13,
  };
}

/* ── Tier card ────────────────────────────────────────────────────────────── */
function TierCard({ tier, active }: { tier: typeof TIERS[0]; active: boolean }) {
  return (
    <div style={{
      ...GLASS,
      width: CARD_W, height: CARD_H,
      borderRadius: 22,
      boxShadow: active ? GLASS_SHADOW_ACTIVE : GLASS_SHADOW,
      display: "flex", flexDirection: "column",
      padding: "1.8rem 1.8rem 1.6rem",
      boxSizing: "border-box",
      overflow: "hidden",
      userSelect: "none",
      position: "relative",
    }}>

      {/* Tier label — orange when active */}
      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.68rem",
        fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
        color: active ? "hsl(22,69%,44%)" : "#b0aaa4",
        margin: "0 0 0.5rem",
        transition: "color 0.4s ease",
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

      {/* Accent line — orange gradient when active, grey when not */}
      <div style={{
        width: 30, height: 2.5, borderRadius: 2,
        background: active
          ? "linear-gradient(90deg, hsl(22,69%,44%), hsl(30,82%,57%))"
          : "rgba(0,0,0,0.13)",
        marginBottom: "0.7rem",
        transition: "background 0.4s ease",
      }} />

      {/* Tagline */}
      <p style={{
        fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.82rem",
        color: "#666", lineHeight: 1.5, margin: "0 0 1.1rem",
      }}>
        {tier.tagline}
      </p>

      {/* Features */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto",
        display: "flex", flexDirection: "column", gap: "0.55rem" }}>
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

      {/* Pricing — orange when active, black when not */}
      <div style={{ display: "flex", gap: "1.5rem", marginTop: "1.2rem", marginBottom: "1rem" }}>
        {tier.pricing.map((p, i) => (
          <div key={i}>
            <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.65rem",
              fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "#aaa", margin: "0 0 0.2rem" }}>{p.label}</p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "1.15rem", fontWeight: 800,
              color: active ? "hsl(22,69%,44%)" : "#0d0d0d",
              margin: 0, letterSpacing: "-0.02em", lineHeight: 1,
              transition: "color 0.4s ease" }}>
              {p.value}
              {p.unit && <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "#888" }}> {p.unit}</span>}
            </p>
            {"note" in p && (p as { note?: string }).note && (
              <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.65rem",
                color: "#bbb", margin: "0.1rem 0 0", lineHeight: 1.3 }}>{(p as { note?: string }).note}</p>
            )}
          </div>
        ))}
      </div>

      {/* CTA — flowing orange→blue gradient when active, plain glass when not */}
      <button
        onClick={() => { document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }}
        className={active ? "price-btn-active" : "price-btn-inactive"}
        style={{
          width: "100%", padding: "0.78rem 1.4rem", borderRadius: 50,
          border: active ? "none" : "1.5px solid rgba(0,0,0,0.14)",
          color: active ? "#fff" : "#0d0d0d",
          fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.88rem",
          fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
          outline: "none",
          /* active gradient is set via CSS class below */
          background: active ? undefined : "rgba(255,255,255,0.6)",
          transition: "opacity 0.2s",
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
      <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.68rem",
        color: active ? "rgba(255,255,255,0.55)" : "#aaa", margin: "0.5rem 0 0", textAlign: "center" }}>
        Starts with a free 15-min discovery call
      </p>
    </div>
  );
}

/* ── Nav button base ──────────────────────────────────────────────────────── */
const NAV_BTN_BASE: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  zIndex: 20, width: 46, height: 46, borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.60)",
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  color: "#0d0d0d", outline: "none",
  transition: "background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s",
};

/* ── Main component ───────────────────────────────────────────────────────── */
export function PricingSection() {
  const { ref: sectionRef, inView } = useInView<HTMLElement>({ threshold: 0.05 });
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(1);
  const n = TIERS.length;

  const prev = useCallback(() => setActive(a => Math.max(0, a - 1)), []);
  const next = useCallback(() => setActive(a => Math.min(n - 1, a + 1)), [n]);

  /* ── Cursor-driven card tracking ────────────────────────────────────────── */
  const lastZone = useRef(1);
  useEffect(() => {
    const section = sectionRef.current as HTMLElement | null;
    if (!section) return;
    const onMove = (e: MouseEvent) => {
      const rect  = section.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      const DEAD  = 0.05;
      let zone    = lastZone.current;
      if      (ratio < 1/3 - DEAD)        zone = 0;
      else if (ratio > 2/3 + DEAD)        zone = 2;
      else if (ratio > 1/3 + DEAD && ratio < 2/3 - DEAD) zone = 1;
      if (zone !== lastZone.current) { lastZone.current = zone; setActive(zone); }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* ── Trackpad swipe ─────────────────────────────────────────────────────── */
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
      if (Math.abs(wheelAccum.current) > 60) {
        const dir = wheelAccum.current > 0 ? 1 : -1;
        wheelAccum.current    = 0;
        wheelCooldown.current = true;
        setActive(a => Math.min(n - 1, Math.max(0, a + dir)));
        setTimeout(() => { wheelCooldown.current = false; }, 380);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [n]);

  /* ── Touch drag ─────────────────────────────────────────────────────────── */
  const dragStart = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientX; };
  const onPointerUp   = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    if (dx < -40) next(); else if (dx > 40) prev();
    dragStart.current = null;
  };

  /* ── Keyboard ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [prev, next]);

  return (
    <section
      ref={sectionRef as React.Ref<HTMLElement>}
      id="pricing"
      style={{
        width: "100%", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "transparent", boxSizing: "border-box", padding: "5rem 1.5rem 4rem",
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : "translateY(20px)",
        transition: "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      <div style={{ maxWidth: 1100, width: "100%" }}>

        {/* ── Heading ── */}
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
            <span className="blend-h-plain" style={blendWhite}>Simple pricing.</span>
            <br />
            <span className="blend-h-plain" style={blendWhite}>No </span>
            <span className="blend-h-orange" style={blendOrange}>surprises.</span>
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

        {/* ── Audit banner ── */}
        <AuditBanner />

        {/* ── Coverflow + arrows ── */}
        <div style={{ position: "relative" }}>
          <button onClick={prev} disabled={active === 0} aria-label="Previous tier"
            className="price-nav-btn" style={{ ...NAV_BTN_BASE, left: "clamp(0rem, 1vw, 0.5rem)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5"/></svg>
          </button>
          <button onClick={next} disabled={active === n - 1} aria-label="Next tier"
            className="price-nav-btn" style={{ ...NAV_BTN_BASE, right: "clamp(0rem, 1vw, 0.5rem)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
          </button>

          <div ref={stageRef} style={{
            position: "relative", width: "100%", height: CARD_H + 48,
            perspective: 1400, overflow: "hidden",
          }}
            onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          >
            {TIERS.map((tier, i) => {
              const diff = i - active;
              const t    = tierTransform(diff);
              if (!t) return null;
              return (
                <div key={tier.name} onClick={() => setActive(i)} style={{
                  position: "absolute", top: "50%", left: "50%",
                  width: CARD_W, height: CARD_H,
                  cursor: diff !== 0 ? "pointer" : "default",
                  zIndex: t.zi, opacity: t.op,
                  transform: `translate(-50%,-50%) translateX(${t.tx}px) scale(${t.scale}) rotateY(${t.ry}deg)`,
                  transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease",
                }}>
                  <TierCard tier={tier} active={diff === 0} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Dot indicators ── */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.45rem", marginTop: "1.6rem" }}>
          {TIERS.map((_, i) => (
            <button key={i} onClick={() => setActive(i)} aria-label={`Go to ${TIERS[i].name}`}
              style={{
                width: i === active ? 22 : 7, height: 7, borderRadius: 4,
                background: i === active ? "hsl(22,69%,44%)" : "rgba(0,0,0,0.16)",
                border: "none", cursor: "pointer", padding: 0, outline: "none",
                transition: "all 0.28s ease",
              }} />
          ))}
        </div>
      </div>

      <style>{`
        /* ── Active CTA button: animated orange→blue→orange gradient ── */
        @keyframes price-btn-flow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .price-btn-active {
          background: linear-gradient(
            135deg,
            hsl(22,69%,44%),
            hsl(30,82%,57%),
            hsl(199,66%,64%),
            hsl(202,69%,56%),
            hsl(219,72%,50%),
            hsl(30,82%,57%),
            hsl(22,69%,44%)
          ) !important;
          background-size: 300% 300% !important;
          animation: price-btn-flow 4s ease infinite !important;
        }

        /* ── Nav arrow hover ── */
        .price-nav-btn {
          position: absolute; top: 50%; transform: translateY(-50%);
          z-index: 20; width: 46px; height: 46px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.60);
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #0d0d0d; outline: none;
          transition: background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
        }
        .price-nav-btn:hover:not(:disabled) {
          background: hsl(22,69%,44%); color: #fff; border-color: hsl(22,69%,44%);
        }
        .price-nav-btn:disabled { opacity: 0.25; cursor: default; }
      `}</style>
    </section>
  );
}
