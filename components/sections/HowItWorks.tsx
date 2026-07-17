"use client";
import { useState } from "react";

const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

// "Three steps." — white + difference → appears black on white bg, white on dark line
const blendWhite: React.CSSProperties = {
  color:        "white",
  mixBlendMode: "difference",
  display:      "inline",
};

// "Real results." — complement-blue gradient + difference → appears orange on white, blue on dark line
const blendOrange: React.CSSProperties = {
  background:           "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip:       "text",
  WebkitTextFillColor:  "transparent",
  color:                "transparent",
  mixBlendMode:         "difference",
  display:              "inline",
};

/* ── Step data ─────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    num:   "01",
    title: "Diagnose",
    desc:  "We map your operations, find the gaps and identify what can be automated to drive real improvement.",
    bullets: [
      "End-to-end operations audit",
      "Identify bottlenecks and inefficiencies",
      "Data and process analysis",
      "Clear opportunities and recommendations",
      "Prioritised roadmap for impact",
    ],
    image:    "/assets/how-diagnose.png",
    imgPos:   "top center",
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8"/><path d="M18 18l6 6"/>
      </svg>
    ),
  },
  {
    num:   "02",
    title: "Automate",
    desc:  "We build intelligent workflows and integrations that remove repetitive work and reduce human error.",
    bullets: [
      "Workflow design and automation",
      "Smart alerts and notifications",
      "Tool and system integrations",
      "AI logic and decision rules",
      "Continuous optimisation",
    ],
    image:    "/assets/how-automate.png",
    imgPos:   "top center",
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="14" r="4"/>
        <path d="M14 2v4M14 22v4M2 14h4M22 14h4M5.6 5.6l2.8 2.8M19.6 19.6l2.8 2.8M5.6 22.4l2.8-2.8M19.6 8.4l2.8-2.8"/>
      </svg>
    ),
  },
  {
    num:   "03",
    title: "Build",
    desc:  "You get a system your team actually uses — dashboards, reports, mobile apps and automations designed around your operations.",
    bullets: [
      "Custom tools built for the way you work",
      "Live dashboards and real-time visibility",
      "Mobile apps your team will actually use",
      "Automations and reports that save time",
      "Built to scale as your business grows",
    ],
    image:    "/assets/how-build.png",
    imgPos:   "top center",
    icon: (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="24" height="18" rx="2"/>
        <path d="M9 25v-4M19 25v-4M6 25h16"/>
      </svg>
    ),
  },
];

/* ── Orange checkmark icon ─────────────────────────────────────────────────── */
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="10" cy="10" r="9" stroke="hsl(22,69%,44%)" strokeWidth="1.5"/>
      <path d="M6.5 10.5l2.5 2.5 4.5-4.5" stroke="hsl(22,69%,44%)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section
      id="how-it-works"
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "transparent",
        padding:        "5rem 1.5rem 3rem",
        boxSizing:      "border-box",
      }}
    >
      <div style={{ maxWidth: 1200, width: "100%" }}>

        {/* ── Heading ─────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p style={{
            ...BODY,
            fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "#bbb", marginBottom: "0.75rem", margin: "0 0 0.75rem",
          }}>
            How it works
          </p>
          <h2 style={{ ...FONT, fontSize: "clamp(2rem, 5vw, 3.8rem)", fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>
            <span className="blend-h-plain" style={blendWhite}>Three steps. </span>
            <span className="blend-h-orange" style={blendOrange}>Real results.</span>
          </h2>
        </div>

        {/* ── Main layout — sidebar + content ─────────────────────────────── */}
        <div className="how-layout" style={{ display: "flex", gap: "1rem", alignItems: "stretch" }}>

          {/* Sidebar */}
          <div
            className="how-sidebar"
            style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: 90, flexShrink: 0 }}
          >
            {STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                style={{
                  flex:               1,
                  background:           "rgba(255,255,255,0.46)",
                  backdropFilter:       "blur(20px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(20px) saturate(1.8)",
                  border:             i === active
                    ? "1px solid rgba(255,255,255,0.60)"
                    : "1px solid rgba(255,255,255,0.42)",
                  borderLeft:         i === active
                    ? "3px solid hsl(22,69%,44%)"
                    : "3px solid transparent",
                  borderRadius:       14,
                  padding:            "1rem 0 0.8rem",
                  display:            "flex",
                  flexDirection:      "column",
                  alignItems:         "center",
                  gap:                "0.4rem",
                  cursor:             "pointer",
                  outline:            "none",
                  minHeight:          130,
                  boxShadow:          i === active ? [
                    "inset 0 1.5px 0 rgba(255,255,255,0.82)",
                    "inset 0 -1px 0 rgba(0,0,0,0.05)",
                    "0 0 0 0.5px rgba(255,255,255,0.28)",
                    "0 6px 28px rgba(0,0,0,0.07)",
                  ].join(", ") : [
                    "inset 0 1.5px 0 rgba(255,255,255,0.60)",
                    "0 0 0 0.5px rgba(255,255,255,0.20)",
                  ].join(", "),
                  transition:         "all 0.25s ease",
                }}
              >
                <span style={{ color: i === active ? "hsl(22,69%,44%)" : "#bbb", lineHeight: 0, transition: "color 0.25s" }}>
                  {s.icon}
                </span>
                <span style={{
                  ...FONT,
                  fontSize:   i === active ? "1.9rem" : "1.15rem",
                  fontWeight: 900,
                  color:      i === active ? "hsl(22,69%,44%)" : "#ccc",
                  lineHeight: 1,
                  transition: "all 0.25s ease",
                }}>
                  {s.num}
                </span>
                <span style={{
                  ...BODY,
                  fontSize:        "0.52rem",
                  fontWeight:      700,
                  letterSpacing:   "0.2em",
                  textTransform:   "uppercase",
                  color:           i === active ? "hsl(22,69%,44%)" : "#c0bdb8",
                  writingMode:     "vertical-rl",
                  textOrientation: "mixed",
                  transform:       "rotate(180deg)",
                  userSelect:      "none",
                  transition:      "color 0.25s",
                }}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>

          {/* Content panel — full liquid glass (matches bento card recipe) */}
          <div style={{
            flex:                 1,
            background:           "rgba(255,255,255,0.46)",
            backdropFilter:       "blur(20px) saturate(1.8)",
            WebkitBackdropFilter: "blur(20px) saturate(1.8)",
            border:               "1px solid rgba(255,255,255,0.60)",
            borderRadius:         18,
            padding:              "2.5rem 2.5rem 2.5rem 2.8rem",
            display:              "flex",
            gap:                  "2.5rem",
            alignItems:           "flex-start",
            boxShadow: [
              "inset 0 1.5px 0 rgba(255,255,255,0.82)",
              "inset 0 -1px 0 rgba(0,0,0,0.05)",
              "0 0 0 0.5px rgba(255,255,255,0.28)",
              "0 6px 28px rgba(0,0,0,0.07)",
            ].join(", "),
            minHeight:            480,
          }}
            className="how-content"
          >
            {/* Text */}
            <div style={{ width: "38%", flexShrink: 0 }} className="how-text">
              <p style={{
                ...BODY,
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em",
                textTransform: "uppercase", color: "hsl(22,69%,44%)",
                margin: "0 0 0.45rem",
              }}>
                Step {step.num}
              </p>

              <h3 style={{
                ...FONT,
                fontSize:      "clamp(2.2rem, 3.5vw, 3rem)",
                fontWeight:    800,
                color:         "#0d0d0d",
                letterSpacing: "-0.025em",
                margin:        "0 0 0.7rem",
                lineHeight:    1.05,
              }}>
                {step.title}
              </h3>

              {/* Orange accent line */}
              <div style={{
                width: 34, height: 3, borderRadius: 2,
                background: "linear-gradient(90deg, hsl(22,69%,44%), hsl(30,82%,57%))",
                marginBottom: "1.35rem",
              }} />

              <p style={{
                ...BODY,
                fontSize: "0.95rem", lineHeight: 1.65,
                color: "#555", margin: "0 0 1.6rem",
              }}>
                {step.desc}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {step.bullets.map((b, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <Check />
                    <span style={{ ...BODY, fontSize: "0.88rem", color: "#444", lineHeight: 1.5 }}>
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup image */}
            <div style={{
              flex:         1,
              borderRadius: 10,
              overflow:     "hidden",
              background:   "#f8f8f8",
              boxShadow:    "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
              alignSelf:    "stretch",
              minHeight:    360,
            }}
              className="how-image"
            >
              <img
                src={step.image}
                alt={`${step.title} mockup`}
                loading="lazy"
                decoding="async"
                style={{
                  width:          "100%",
                  height:         "100%",
                  objectFit:      "cover",
                  objectPosition: step.imgPos,
                  display:        "block",
                  transition:     "opacity 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.2rem" }}>

          <button
            onClick={() => setActive(Math.max(0, active - 1))}
            disabled={active === 0}
            style={{
              ...BODY,
              display:        "flex",
              alignItems:     "center",
              gap:            "0.5rem",
              fontSize:       "0.9rem",
              fontWeight:     500,
              color:          "#666",
              background:     "rgba(255,255,255,0.82)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border:         "1px solid rgba(255,255,255,0.7)",
              borderRadius:   50,
              padding:        "0.6rem 1.4rem",
              cursor:         active === 0 ? "not-allowed" : "pointer",
              opacity:        active === 0 ? 0.35 : 1,
              transition:     "opacity 0.2s",
              outline:        "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Previous
          </button>

          <button
            onClick={() => setActive(Math.min(STEPS.length - 1, active + 1))}
            disabled={active === STEPS.length - 1}
            style={{
              ...BODY,
              display:        "flex",
              alignItems:     "center",
              gap:            "0.5rem",
              fontSize:       "0.9rem",
              fontWeight:     600,
              color:          "hsl(22,69%,44%)",
              background:     "rgba(255,255,255,0.82)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border:         "1px solid rgba(255,255,255,0.7)",
              borderRadius:   50,
              padding:        "0.6rem 1.4rem",
              cursor:         active === STEPS.length - 1 ? "not-allowed" : "pointer",
              opacity:        active === STEPS.length - 1 ? 0.35 : 1,
              transition:     "opacity 0.2s",
              outline:        "none",
            }}
          >
            Next step
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

        </div>
      </div>
    </section>
  );
}
