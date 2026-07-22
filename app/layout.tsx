import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, Inter, Instrument_Sans, Space_Grotesk } from "next/font/google";
import { LiquidGlassFilter }  from "@/components/ui/liquid-button";
import { GlobalPixelTrail }   from "@/components/GlobalPixelTrail";
import "./globals.css";

/* ── Heading font: Barlow Condensed ──────────────────────────────────────── */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-sans",    // kept as --font-sans for existing component compat
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700", "900"],
  display:  "swap",
});

/* ── Body font: DM Sans ───────────────────────────────────────────────────── */
const dmSans = DM_Sans({
  variable: "--font-body",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

/* ── Platform font: Inter (scoped to /login and /app via --font-inter) ─────── */
const inter = Inter({
  variable: "--font-inter",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

/* ── OrderFlow font pair: Instrument Sans (UI) + Space Grotesk (numerals) ──── */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

export const metadata: Metadata = {
  title: "Vyso | Operations Software & Automation for SMEs",
  description:
    "Replace WhatsApp threads and spreadsheets with a configurable operations platform. Vyso audits, automates and implements practical systems for growing SMEs.",
  metadataBase: new URL("https://vyso.co.za"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vyso | Operations Software & Automation for SMEs",
    description:
      "Replace WhatsApp threads and spreadsheets with a configurable operations platform. Vyso audits, automates and implements practical systems for growing SMEs.",
    url:      "https://vyso.co.za",
    siteName: "Vyso",
    locale:   "en_ZA",
    type:     "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Vyso — Operations, connected.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vyso | Operations Software & Automation for SMEs",
    description:
      "Replace WhatsApp threads and spreadsheets with a configurable operations platform. Vyso audits, automates and implements practical systems for growing SMEs.",
    images: ["/og.png"],
  },
};

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://vyso.co.za/#organization",
      name: "Vyso",
      url: "https://vyso.co.za",
      logo: "https://vyso.co.za/icon.svg",
      email: "joshua@vyso.co.za",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "joshua@vyso.co.za",
        url: "https://vyso.co.za/contact",
        areaServed: "ZA",
        availableLanguage: "en-ZA",
      },
      areaServed: {
        "@type": "Country",
        name: "South Africa",
      },
      description:
        "A configurable operations platform for SMEs, implemented with hands-on support.",
    },
    {
      "@type": "WebSite",
      "@id": "https://vyso.co.za/#website",
      url: "https://vyso.co.za",
      name: "Vyso",
      inLanguage: "en-ZA",
      publisher: {
        "@id": "https://vyso.co.za/#organization",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZA"
      data-scroll-behavior="smooth"
      className={`${barlowCondensed.variable} ${dmSans.variable} ${inter.variable} ${instrumentSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteSchema).replace(/</g, "\\u003c"),
          }}
        />
        {/* Global SVG filter for LiquidButton glass effect */}
        <LiquidGlassFilter />
        {/* Orange pixel trail — follows the cursor across every page */}
        <GlobalPixelTrail />
        {children}
      </body>
    </html>
  );
}
