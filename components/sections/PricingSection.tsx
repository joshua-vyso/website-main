"use client";
import { useInView } from "@/hooks/useInView";
import { GradientText } from "@/components/ui/gradient-text";

const BLEND: React.CSSProperties = { color: "white", mixBlendMode: "difference" };

const TIERS = [
  {
    name: "Audit", featured: false, price: "— —",
    desc: "We map your operations and deliver a full diagnostic report.",
    cta: "Get started",
    features: ["Full operations audit", "Gap & bottleneck report", "Automation opportunity map", "30-min debrief call"],
  },
  {
    name: "Build", featured: true, price: "— —",
    desc: "Full stack: audit, automation, and a custom tool built for your team.",
    cta: "Talk to us",
    features: ["Everything in Automate", "Custom app or dashboard", "Ongoing support & iterations", "Dedicated Vyso contact"],
  },
  {
    name: "Automate", featured: false, price: "— —",
    desc: "We build your automations and integrations from the ground up.",
    cta: "Get started",
    features: ["Everything in Audit", "Workflow & integration build", "WhatsApp / supplier automation", "Staff training session"],
  },
];

const CHECK = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
    <circle cx="8" cy="8" r="7.5" stroke="hsl(22,69%,44%)" strokeOpacity="0.3"/>
    <path d="M5 8l2.5 2.5L11 5.5" stroke="hsl(22,69%,44%)" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function PricingCard({ tier }: { tier: typeof TIERS[0] }) {
  return (
    <div style={{ position: "relative", borderRadius: tier.featured ? 18 : 14,
      padding: tier.featured ? 2 : 0, flex: 1, minWidth: 0 }}>

      {tier.featured && (
        <div aria-hidden="true" className="featured-ring" style={{ borderRadius: 18 }} />
      )}

      <div style={{
        position: "relative",
        background: "rgba(255,255,255,0.90)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: tier.featured ? "none" : "1px solid rgba(255,255,255,0.55)",
        borderRadius: tier.featured ? 16 : 14,
        padding: tier.featured ? "2.4rem 2rem" : "2rem 1.8rem",
        height: "100%", display: "flex", flexDirection: "column", gap: "1.4rem",
        transform: tier.featured ? "scale(1.02)" : "scale(1)",
        boxShadow: tier.featured ? "0 14px 40px rgba(190,93,35,0.12)" : "none",
      }}>

        <div>
          <h3 style={{ fontFamily: "var(--font-sans)", fontSize: tier.featured ? "1.75rem" : "1.5rem",
            fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 0.5rem" }}>
            {tier.featured
              ? <GradientText as="span">{tier.name}</GradientText>
              : <span style={{ color: "#0d0d0d" }}>{tier.name}</span>}
          </h3>
          <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.87rem",
            color: "#6b6b6b", lineHeight: 1.5, margin: 0 }}>{tier.desc}</p>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "2.2rem", fontWeight: 700,
            color: tier.featured ? "hsl(22,69%,44%)" : "#0d0d0d", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {tier.price}
          </div>
          <div style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.72rem",
            color: "#bbb", marginTop: "0.25rem" }}>Confirmed during consultation</div>
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {tier.features.map((f, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem" }}>
              {CHECK}
              <span style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.84rem",
                color: "#444", lineHeight: 1.4 }}>{f}</span>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: "auto" }}>
          <button style={{
            display: "block", width: "100%", padding: "0.8rem 1.4rem",
            borderRadius: "100px",
            border: tier.featured ? "none" : "1.5px solid #e0e0e0",
            background: tier.featured
              ? "linear-gradient(135deg, hsl(30,82%,57%), hsl(22,69%,44%), hsl(14,72%,36%))"
              : "transparent",
            color: tier.featured ? "#fff" : "#0d0d0d",
            fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.88rem",
            fontWeight: 600, cursor: "pointer",
            transition: "opacity 0.2s, transform 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >{tier.cta}</button>
        </div>
      </div>
    </div>
  );
}

export function PricingSection() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={ref}
      id="pricing"
      style={{
        width:          "100%",
        minHeight:      "100vh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "transparent",
        padding:        "5rem 1.25rem",
        boxSizing:      "border-box",
        opacity:        inView ? 1 : 0,
        transform:      inView ? "none" : "translateY(20px)",
        transition:     "opacity 0.65s ease, transform 0.65s ease",
      }}
    >
      <div style={{ maxWidth: 1040, width: "100%", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <p style={{ fontFamily: "var(--font-body, var(--font-sans))", fontSize: "0.72rem", fontWeight: 600,
            letterSpacing: "0.22em", textTransform: "uppercase", color: "#bbb", marginBottom: "0.7rem" }}>
            Pricing</p>
          <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: 700, letterSpacing: "-0.02em", margin: 0, ...BLEND }}>
            Simple pricing. No surprises.</h2>
        </div>
        <div style={{ display: "flex", gap: "1.2rem", alignItems: "stretch" }} className="pricing-grid">
          {TIERS.map(tier => <PricingCard key={tier.name} tier={tier} />)}
        </div>
      </div>
    </section>
  );
}
