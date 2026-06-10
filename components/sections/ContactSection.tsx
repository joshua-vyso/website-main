"use client";

import { Sparkles } from "lucide-react";
import ContactForm from "@/components/ContactForm";

const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

// Mirror of hero's blend trick — complement-of-orange blues appear orange
// on the white shader background; shift to blue when the dark sine wave passes.
const blendText: React.CSSProperties = {
  color:        "white",
  mixBlendMode: "difference",
  display:      "inline",
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

// Liquid-glass recipe shared with SystemsShowcase + PricingSection
const GLASS: React.CSSProperties = {
  backdropFilter:       "blur(22px) saturate(1.9)",
  WebkitBackdropFilter: "blur(22px) saturate(1.9)",
  background:           "rgba(255,255,255,0.52)",
  border:               "1px solid rgba(255,255,255,0.68)",
  boxShadow: [
    "inset 0 1.5px 0 rgba(255,255,255,0.88)",
    "inset 0 -1px 0 rgba(0,0,0,0.04)",
    "0 0 0 0.5px rgba(255,255,255,0.30)",
    "0 8px 32px rgba(0,0,0,0.08)",
  ].join(", "),
  borderRadius: 20,
  padding:      "2rem",
};


export function ContactSection() {
  return (
    <section
      id="contact"
      style={{
        position:       "relative",
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "8rem 2rem 6rem",
        boxSizing:      "border-box",
        background:     "transparent",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>

        {/* Eyebrow */}
        <p style={{
          ...BODY,
          fontSize:      "0.7rem",
          fontWeight:    600,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color:         "white",
          mixBlendMode:  "difference",
          marginBottom:  "1.2rem",
        }}>
          Get in touch
        </p>

        {/* Headline — same blend trick as HeroSection */}
        <h2 style={{
          ...FONT,
          fontSize:      "clamp(3rem, 7vw, 5.6rem)",
          fontWeight:    700,
          lineHeight:    1.0,
          letterSpacing: "-0.03em",
          margin:        "0 0 1.4rem",
        }}>
          <span style={blendText}>Let&apos;s solve your </span>
          <span style={blendOrange}>ops</span>
          <span style={blendText}> together.</span>
        </h2>

        {/* Subtext */}
        <p style={{
          ...BODY,
          fontSize:     "clamp(1rem, 1.8vw, 1.18rem)",
          color:        "white",
          mixBlendMode: "difference",
          lineHeight:   1.65,
          maxWidth:     520,
          margin:       "0 auto 1.6rem",
        }}>
          Send an enquiry and we&apos;ll get back within 24 hours.
        </p>

        {/* Free discovery call badge */}
        <div style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            "0.45rem",
          padding:        "0.5rem 1.2rem",
          borderRadius:   50,
          background:     "rgba(255,255,255,0.52)",
          backdropFilter: "blur(12px)",
          border:         "1px solid rgba(255,255,255,0.68)",
          boxShadow:      "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <Sparkles size={13} color="hsl(22,69%,44%)" />
          <span style={{
            ...BODY,
            fontSize:   "0.8rem",
            fontWeight: 600,
            color:      "hsl(22,69%,44%)",
          }}>
            Free 15-minute discovery call — no commitment, no sales pitch
          </span>
        </div>
      </div>

      {/* ── Form card — centered ────────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 680 }}>
        <div style={{ ...GLASS, padding: "2.6rem" }}>
          <h3 style={{
            ...FONT,
            fontSize:      "1.2rem",
            fontWeight:    600,
            color:         "#0d0d0d",
            margin:        "0 0 1.8rem",
            letterSpacing: "-0.015em",
          }}>
            Send an enquiry
          </h3>
          <ContactForm />
        </div>

        {/* Quiet fallback email */}
        <p style={{
          ...BODY,
          fontSize:   "0.78rem",
          color:      "white",
          mixBlendMode: "difference",
          textAlign:  "center",
          marginTop:  "1.2rem",
          lineHeight: 1.6,
        }}>
          For any unrelated queries, reach us at{" "}
          <a
            href="mailto:joshua@vyso.co.za"
            style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            joshua@vyso.co.za
          </a>
        </p>
      </div>
    </section>
  );
}
