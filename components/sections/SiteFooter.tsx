"use client";
import Link from "next/link";

const NAV_GROUPS = [
  {
    label: "Platform",
    links: [
      { label: "Overview", href: "/platform" },
      { label: "OrderFlow", href: "/platform#orderflow" },
      { label: "Vyso AI", href: "/platform/vyso-ai" },
      { label: "Vyso for SMEs", href: "/platform/vyso-for-smes" },
    ],
  },
  {
    label: "For food businesses",
    links: [
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
      { label: "Farms & producers", href: "/industries/farms" },
      { label: "Turn 'n Slice story", href: "/case-studies/turn-n-slice" },
    ],
  },
  {
    label: "Work with Vyso",
    links: [
      { label: "Founding clients", href: "/founding-client" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

/* Inline Vyso wordmark — same paths as Navbar but via a tiny self-contained SVG */
function VysoMark() {
  return (
    <svg
      viewBox="175 455 900 350"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 80, height: "auto", display: "block" }}
      aria-label="Vyso"
    >
      <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z" fill="#0d0d0d"/>
      <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z" fill="#0d0d0d"/>
      <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z" fill="#0d0d0d"/>
      <path d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
        stroke="#0d0d0d" strokeWidth="33" strokeMiterlimit="10" strokeLinejoin="round"/>
      <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z" fill="#0d0d0d"/>
      <path d="M853 503.5V535.5" stroke="#0d0d0d"/>
      <path d="M580 692.5L578.5 660.5L559 692.5H580Z" fill="#0d0d0d"/>
      <path d="M938.5 696C991.243 696 1034 652.795 1034 599.5C1034 546.205 991.243 503 938.5 503C885.757 503 843 546.205 843 599.5C843 652.795 885.757 696 938.5 696Z" fill="#0d0d0d"/>
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer style={{
      borderTop:   "1px solid rgba(255,255,255,0.2)",
      background:  "transparent",
      padding:     "2.8rem 2rem",
    }}>
      <div style={{
        maxWidth:        1160,
        margin:          "0 auto",
        display:         "flex",
        alignItems:      "flex-start",
        justifyContent:  "space-between",
        flexWrap:        "wrap",
        gap:             "2rem",
      }}>

        {/* Left — logo + url */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Link href="/" aria-label="Vyso home" style={{ lineHeight: 0 }}>
            <VysoMark />
          </Link>
          <span style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize:   "0.75rem",
            color:      "#bbb",
            letterSpacing: "0.04em",
          }}>
            vyso.co.za
          </span>
        </div>

        {/* Center — crawlable product, audience and company links */}
        <nav aria-label="Footer navigation" style={{ flex: "1 1 620px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: "1.5rem 2.5rem",
          }}>
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p style={{
                  margin: "0 0 0.7rem",
                  color: "#0d0d0d",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  {group.label}
                </p>
                <ul style={{ listStyle: "none", display: "grid", gap: "0.42rem", padding: 0, margin: 0 }}>
                  {group.links.map(({ label, href }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        style={{
                          color: "#777",
                          fontFamily: "var(--font-body, var(--font-sans))",
                          fontSize: "0.82rem",
                          letterSpacing: "0.01em",
                          textDecoration: "none",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#0d0d0d")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#777")}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Bottom copyright line */}
      <div style={{
        maxWidth:   1160,
        margin:     "2rem auto 0",
        paddingTop: "1.5rem",
        borderTop:  "1px solid #f0f0f0",
        display:    "flex",
        justifyContent: "space-between",
        flexWrap:   "wrap",
        gap:        "0.5rem",
      }}>
        <span style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize:   "0.75rem",
          color:      "#ccc",
        }}>
          © {new Date().getFullYear()} Vyso. All rights reserved.
        </span>
        <span style={{
          fontFamily: "var(--font-body, var(--font-sans))",
          fontSize:   "0.75rem",
          color:      "#ccc",
        }}>
          South Africa
        </span>
      </div>
    </footer>
  );
}
