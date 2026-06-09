"use client";
import { useEffect, useRef } from "react";
import { GradientText } from "@/components/ui/gradient-text";

const ITEMS = [
  { problem: "Stock levels guessed, not tracked.",    fix: "Real-time stock visibility, automated." },
  { problem: "Wastage never logged.",                 fix: "Wastage tracked and reported daily." },
  { problem: "Suppliers managed over WhatsApp.",      fix: "Supplier comms centralised and logged." },
  { problem: "Reports built manually, every week.",   fix: "Reports generated automatically." },
  { problem: "No one knows the real margin.",         fix: "Margin dashboards, always live." },
];

export function ProblemStrip() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs   = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Staggered reveal — fires once section is the active fullpage panel
    const secObs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          itemRefs.current.forEach((el, i) => {
            if (!el) return;
            setTimeout(() => el.classList.add("is-visible"), i * 180 + 300);
          });
          secObs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (sectionRef.current) secObs.observe(sectionRef.current);
    return () => secObs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        width:          "100%",
        height:         "100vh",
        display:        "flex",
        flexDirection:  "column",
        justifyContent: "center",
        background:     "#fafafa",
        overflow:       "hidden",
        padding:        "5rem 2rem",
        boxSizing:      "border-box",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", width: "100%" }}>

        <p style={{
          fontFamily:    "var(--font-body, var(--font-sans))",
          fontSize:      "0.72rem",
          fontWeight:    600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         "#bbb",
          marginBottom:  "2.8rem",
        }}>
          Sound familiar?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.4rem" }}>
          {ITEMS.map(({ problem, fix }, i) => (
            <div
              key={i}
              ref={el => { itemRefs.current[i] = el; }}
              className="problem-item"
            >
              <div className="problem-text" style={{
                fontFamily:    "var(--font-sans)",
                fontSize:      "clamp(1.35rem, 2.8vw, 2.2rem)",
                fontWeight:    600,
                color:         "#0d0d0d",
                letterSpacing: "-0.01em",
                lineHeight:    1.2,
                display:       "inline-block",
              }}>
                {problem}
              </div>
              <div className="problem-fix" style={{ marginTop: "0.25rem" }}>
                <GradientText as="span" style={{
                  fontFamily: "var(--font-body, var(--font-sans))",
                  fontSize:   "clamp(0.85rem, 1.4vw, 1rem)",
                  fontWeight: 500,
                }}>
                  → {fix}
                </GradientText>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
