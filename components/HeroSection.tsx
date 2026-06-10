"use client";

import Link           from "next/link";
import { LiquidButton } from "./ui/liquid-button";
import { GradientText } from "./ui/gradient-text";

const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

// Plain-text nodes: white + difference → black on white bg, white on dark line.
const blendText: React.CSSProperties = {
  color:        "white",
  mixBlendMode: "difference",
  display:      "inline",
};

// Orange-on-white via difference blend.
// The shader bg is pure white (#fff). difference(textColor, white) = |textColor - white|.
// To make that equal the orange gradient stops we use their complements:
//   hsl(22,69%,44%) complement = hsl(202,69%,56%)
//   hsl(30,82%,57%) complement = hsl(219,72%,50%)
//   hsl(14,72%,36%) complement = hsl(199,66%,64%)
// On white → appears orange. On dark shader line → appears blue. Automatic. No JS.
const blendOrange: React.CSSProperties = {
  background:           "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip:       "text",
  WebkitTextFillColor:  "transparent",
  color:                "transparent",
  mixBlendMode:         "difference",
  display:              "inline",
};

export function HeroSection() {
  return (
    <section
      style={{
        position:       "relative",
        width:          "100%",
        height:         "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "transparent",
        textAlign:      "center",
      }}
    >
      <div
        style={{
          position:      "relative",
          maxWidth:      820,
          padding:       "0 2rem",
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           "1.4rem",
          marginTop:     "-3rem",
        }}
      >
        <GradientText as="span" style={{
          ...BODY,
          fontSize:      "0.95rem",
          fontWeight:    600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          AI-powered operations for SMEs
        </GradientText>

        <h1 className="hero-headline" style={{
          ...FONT,
          fontSize:      "clamp(2.8rem, 7.5vw, 6.4rem)",
          fontWeight:    700,
          lineHeight:    1.0,
          letterSpacing: "-0.015em",
          color:         "#0D0D0D",
          margin:        0,
        }}>
          <span className="blend-h-plain" style={blendText}>Your business is running on </span>
          <span className="blend-h-orange" style={blendOrange}>WhatsApp</span>
          <span className="blend-h-plain" style={blendText}> and </span>
          <span className="blend-h-orange" style={blendOrange}>spreadsheets.</span>
          <span className="blend-h-plain" style={blendText}> That ends here.</span>
        </h1>

        <p className="blend-para" style={{
          ...BODY,
          fontSize:     "clamp(1.05rem, 1.9vw, 1.3rem)",
          fontWeight:   400,
          lineHeight:   1.6,
          color:        "white",
          mixBlendMode: "difference",
          maxWidth:     720,
          margin:       0,
        }}>
          Vyso diagnoses your operational chaos, automates the work, and builds your
          team a tool they&apos;ll actually use.
        </p>

        <LiquidButton asChild variant="default" size="xl">
          <Link href="#how-it-works" style={{ textDecoration: "none", ...BODY, fontWeight: 600 }}>
            <GradientText as="span">See how it works</GradientText>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"
              style={{ color: "hsl(22,69%,44%)" }}>
              <path d="M7 2v10M2 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </LiquidButton>
      </div>
    </section>
  );
}
