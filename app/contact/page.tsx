import { Mail, MessageCircle } from "lucide-react";
import ContactForm from "@/components/ContactForm";
import { WebGLShaderBackground } from "@/components/WebGLShaderBackground";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/sections/SiteFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Vyso | Discuss Your Operations",
  description:
    "Tell Vyso where your operations are breaking down. Send an enquiry and get a practical response about the clearest next step.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Vyso | Discuss Your Operations",
    description:
      "Tell Vyso where your operations are breaking down. Send an enquiry and get a practical response about the clearest next step.",
    url: "/contact",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Vyso | Discuss Your Operations",
    description:
      "Tell Vyso where your operations are breaking down. Send an enquiry and get a practical response about the clearest next step.",
    images: ["/og.png"],
  },
};

const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

const blendText: React.CSSProperties = {
  color: "white",
  mixBlendMode: "difference",
  display: "inline",
};

const blendOrange: React.CSSProperties = {
  background:
    "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  mixBlendMode: "difference",
  display: "inline",
};

// Liquid-glass card — same recipe as SystemsShowcase
const GLASS: React.CSSProperties = {
  backdropFilter:       "blur(20px) saturate(1.8)",
  WebkitBackdropFilter: "blur(20px) saturate(1.8)",
  background:           "rgba(255,255,255,0.72)",
  border:               "1px solid rgba(255,255,255,0.85)",
  boxShadow: [
    "inset 0 1.5px 0 rgba(255,255,255,0.90)",
    "inset 0 -1px 0 rgba(0,0,0,0.04)",
    "0 0 0 0.5px rgba(255,255,255,0.30)",
    "0 8px 40px rgba(0,0,0,0.07)",
  ].join(", "),
  borderRadius: 20,
  padding:      "2rem",
};

const ICON_WRAP: React.CSSProperties = {
  width:           36,
  height:          36,
  borderRadius:    10,
  background:      "hsl(22 69% 44% / 0.1)",
  display:         "flex",
  alignItems:      "center",
  justifyContent:  "center",
  marginBottom:    "1rem",
  flexShrink:      0,
};

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": "https://vyso.co.za/contact#webpage",
  url: "https://vyso.co.za/contact",
  name: "Contact Vyso",
  description:
    "Contact Vyso about a broken or inefficient operational workflow in a South African SME.",
  isPartOf: { "@id": "https://vyso.co.za/#website" },
  about: { "@id": "https://vyso.co.za/#organization" },
  inLanguage: "en-ZA",
};

export default function ContactPage() {
  return (
    <div style={{ position: "relative", isolation: "isolate" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(contactSchema).replace(/</g, "\\u003c"),
        }}
      />
      <WebGLShaderBackground global />
      <Navbar visible />

      <main style={{ minHeight: "100vh" }}>
        {/* Hero text */}
        <section
          style={{
            paddingTop:    "8rem",
            paddingBottom: "3.5rem",
            paddingLeft:   "clamp(1.25rem, 5vw, 4rem)",
            paddingRight:  "clamp(1.25rem, 5vw, 4rem)",
            maxWidth:      1160,
            margin:        "0 auto",
          }}
        >
          <p style={{
            ...BODY,
            fontSize:      "0.7rem",
            fontWeight:    600,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color:         "hsl(22,69%,44%)",
            marginBottom:  "1.1rem",
          }}>
            Get in touch
          </p>

          <h1 className="contact-headline" style={{
            ...FONT,
            fontSize:      "clamp(3rem, 7vw, 5.6rem)",
            fontWeight:    700,
            lineHeight:    1.0,
            letterSpacing: "-0.03em",
            margin:        "0 0 1.2rem",
            maxWidth:      660,
          }}>
            <span className="blend-h-plain" style={blendText}>Let&apos;s solve your </span>
            <span className="blend-h-orange" style={blendOrange}>ops</span>
            <span className="blend-h-plain" style={blendText}> together.</span>
          </h1>

          <p style={{
            ...BODY,
            fontSize:   "clamp(1rem, 1.8vw, 1.18rem)",
            fontWeight: 400,
            lineHeight: 1.65,
            color:      "#555",
            maxWidth:   480,
            margin:     0,
          }}>
            Tell us what is breaking down — orders, stock, suppliers, staffing,
            documents or reporting. Send the messy version; we&apos;ll reply within
            24 hours with the clearest useful next step.
          </p>
        </section>

        {/* Form + sidebar */}
        <section
          style={{
            paddingBottom: "7rem",
            paddingLeft:   "clamp(1.25rem, 5vw, 4rem)",
            paddingRight:  "clamp(1.25rem, 5vw, 4rem)",
            maxWidth:      1160,
            margin:        "0 auto",
          }}
        >
          <div
            className="contact-grid"
            style={{
              display:             "grid",
              gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr)",
              gap:                 "1.8rem",
              alignItems:          "start",
            }}
          >
            {/* ── Form card ─────────────────────────────────────────────────── */}
            <div style={{ ...GLASS, padding: "2.6rem" }}>
              <h2 style={{
                ...FONT,
                fontSize:      "1.3rem",
                fontWeight:    600,
                color:         "#0d0d0d",
                margin:        "0 0 1.8rem",
                letterSpacing: "-0.015em",
              }}>
                Send an enquiry
              </h2>
              <ContactForm />
            </div>

            {/* ── Sidebar ───────────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>

              {/* Email */}
              <div style={GLASS}>
                <div style={ICON_WRAP}>
                  <Mail size={16} color="hsl(22,69%,44%)" />
                </div>
                <h3 style={{ ...FONT, fontSize: "0.98rem", fontWeight: 600, color: "#0d0d0d",
                  margin: "0 0 0.45rem" }}>Email us directly</h3>
                <p style={{ ...BODY, fontSize: "0.84rem", color: "#666", lineHeight: 1.6,
                  margin: "0 0 0.75rem" }}>
                  For anything that doesn&apos;t fit the form.
                </p>
                <a
                  href="mailto:joshua@vyso.co.za"
                  style={{ ...BODY, fontSize: "0.85rem", fontWeight: 600,
                    color: "hsl(22,69%,44%)", textDecoration: "none" }}
                >
                  joshua@vyso.co.za
                </a>
              </div>

              {/* What to expect */}
              <div style={GLASS}>
                <div style={ICON_WRAP}>
                  <MessageCircle size={16} color="hsl(22,69%,44%)" />
                </div>
                <h3 style={{ ...FONT, fontSize: "0.98rem", fontWeight: 600, color: "#0d0d0d",
                  margin: "0 0 0.75rem" }}>What to expect</h3>
                <ul style={{ listStyle: "none", margin: 0, padding: 0,
                  display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {[
                    "Reply within 24 hours",
                    "No hard sell — just an honest conversation",
                    "A practical view on whether Vyso fits",
                    "A clear next step, with no commitment",
                  ].map(item => (
                    <li key={item} style={{ ...BODY, fontSize: "0.83rem", color: "#666",
                      lineHeight: 1.5, display: "flex", gap: "0.5rem" }}>
                      <span style={{ color: "hsl(22,69%,44%)", flexShrink: 0, fontWeight: 600 }}>—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trust strip */}
              <div style={{
                ...GLASS,
                padding: "1.4rem 1.6rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem 1.4rem",
              }}>
                {[
                  { icon: "🔒", label: "Your data stays yours", sub: "We never sell your data" },
                  { icon: "⚡", label: "Real people. Fast replies.", sub: "No bots, no runaround." },
                  { icon: "🛡️", label: "Secure by design", sub: "Access-controlled platform" },
                  { icon: "⚙️", label: "Every operation is unique", sub: "Solutions built around you" },
                ].map(t => (
                  <div key={t.label}>
                    <div style={{ fontSize: "1rem", marginBottom: "0.2rem" }}>{t.icon}</div>
                    <p style={{ ...BODY, fontSize: "0.72rem", fontWeight: 600, color: "#333",
                      margin: "0 0 0.12rem", lineHeight: 1.3 }}>{t.label}</p>
                    <p style={{ ...BODY, fontSize: "0.68rem", color: "#888", margin: 0,
                      lineHeight: 1.3 }}>{t.sub}</p>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
