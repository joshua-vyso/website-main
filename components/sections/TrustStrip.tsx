"use client";
import { useInView } from "@/hooks/useInView";

const BLEND: React.CSSProperties = { color: "white", mixBlendMode: "difference" };

function AfricaSVG() {
  return (
    <svg viewBox="0 0 200 270" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 240, height: "auto" }}
      aria-label="Map of Africa showing Vyso's operational reach">
      <defs>
        <radialGradient id="africa-fill-o" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="hsl(30,82%,88%)"/>
          <stop offset="100%" stopColor="hsl(22,69%,80%)"/>
        </radialGradient>
        <filter id="africa-glow-o" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path filter="url(#africa-glow-o)" fill="url(#africa-fill-o)"
        stroke="hsl(22,69%,60%)" strokeWidth="1.2"
        d="M78,8 C110,4 152,7 172,20 C182,28 184,46 182,68 C183,88 188,102 185,116
           C177,136 163,152 150,174 C140,196 134,220 130,244 C120,262 103,272 84,270
           C65,270 50,256 42,238 C30,215 23,188 21,163 C18,140 22,126 27,118
           C32,110 38,116 36,128 C33,140 24,136 16,122 C8,106 12,88 18,74
           C22,58 32,40 46,26 C58,14 66,10 78,8 Z"
      />
      <g>
        <circle cx="82" cy="252" r="10" fill="hsl(22,69%,44%)" fillOpacity="0.15" className="pulse-ring-1"/>
        <circle cx="82" cy="252" r="5.5" fill="hsl(22,69%,44%)" fillOpacity="0.3" className="pulse-ring-2"/>
        <circle cx="82" cy="252" r="3.5" fill="hsl(22,69%,44%)"/>
        <circle cx="82" cy="252" r="1.8" fill="#fff"/>
      </g>
      <g>
        <circle cx="36" cy="136" r="10" fill="hsl(22,69%,44%)" fillOpacity="0.15" className="pulse-ring-1" style={{ animationDelay: "0.7s" }}/>
        <circle cx="36" cy="136" r="5.5" fill="hsl(22,69%,44%)" fillOpacity="0.3"  className="pulse-ring-2" style={{ animationDelay: "0.7s" }}/>
        <circle cx="36" cy="136" r="3.5" fill="hsl(22,69%,44%)"/>
        <circle cx="36" cy="136" r="1.8" fill="#fff"/>
      </g>
      <g>
        <circle cx="148" cy="176" r="10" fill="hsl(22,69%,44%)" fillOpacity="0.15" className="pulse-ring-1" style={{ animationDelay: "1.3s" }}/>
        <circle cx="148" cy="176" r="5.5" fill="hsl(22,69%,44%)" fillOpacity="0.3"  className="pulse-ring-2" style={{ animationDelay: "1.3s" }}/>
        <circle cx="148" cy="176" r="3.5" fill="hsl(22,69%,44%)"/>
        <circle cx="148" cy="176" r="1.8" fill="#fff"/>
      </g>
    </svg>
  );
}

const TESTIMONIALS = [
  {
    quote:   "Vyso gave us visibility we never had before. We caught R40,000 in monthly wastage in the first week.",
    author:  "[Client Name]",
    company: "Turn n Slice",
    ghost:   false,
  },
  { quote: "", author: "", company: "Testimonial coming soon", ghost: true },
];

export function TrustStrip() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={ref}
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        justifyContent: "center",
        background:     "transparent",
        padding:        "5rem 1.25rem",
        boxSizing:      "border-box",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Top row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3rem",
          alignItems: "center", marginBottom: "4rem" }} className="trust-grid">
          <div>
            <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.72rem",
              fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase",
              color: "#bbb", marginBottom: "1.2rem" }}>Our reach</p>
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.9rem, 4.2vw, 3.4rem)",
              fontWeight: 700, letterSpacing: "-0.025em",
              lineHeight: 1.05, margin: "0 0 1.2rem",
              ...BLEND,
            }}>
              Built for businesses<br/>across South Africa.
            </h2>
            <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.97rem",
              lineHeight: 1.6, color: "#6b6b6b", maxWidth: 420, margin: 0 }}>
              From Joburg food courts to Cape Town kitchens, Vyso is designed for the
              way African food businesses actually work.
            </p>
          </div>
          <AfricaSVG />
        </div>

        {/* Testimonials */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1.2rem" }}
          className="testimonial-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{
              padding: "1.8rem", borderRadius: 12,
              border: t.ghost ? "1.5px dashed rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.6)",
              background: t.ghost ? "transparent" : "rgba(255,255,255,0.88)",
              backdropFilter: t.ghost ? "none" : "blur(14px)",
              WebkitBackdropFilter: t.ghost ? "none" : "blur(14px)",
              opacity: t.ghost ? 0.5 : 1,
              display: "flex", flexDirection: "column", gap: "1rem",
            }}>
              {t.ghost ? (
                <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.9rem",
                  color: "#ccc", fontStyle: "italic", margin: 0, textAlign: "center",
                  paddingBlock: "0.8rem" }}>{t.company}</p>
              ) : (
                <>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: "2.5rem",
                    lineHeight: 0.8, color: "hsl(22,69%,44%)", opacity: 0.35 }}>"</div>
                  <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "1rem",
                    lineHeight: 1.6, color: "#1a1a1a", fontStyle: "italic", margin: 0 }}>{t.quote}</p>
                  <div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.88rem",
                      fontWeight: 700, color: "#0d0d0d" }}>{t.author}</div>
                    <div style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.78rem",
                      color: "#aaa" }}>{t.company}</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
