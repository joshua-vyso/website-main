import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { LiquidGlassFilter } from "@/components/ui/liquid-button";
import { CustomCursor }      from "@/components/ui/CustomCursor";
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

export const metadata: Metadata = {
  title: "Vyso — Operations & Automation for Food Businesses",
  description:
    "Vyso automates the day-to-day operations of food businesses. Stock tracking, wastage logging, supplier management, and custom apps — all in one place.",
  metadataBase: new URL("https://vyso.co.za"),
  openGraph: {
    title: "Vyso — Operations & Automation for Food Businesses",
    description:
      "Stop running your business on WhatsApp and spreadsheets. Vyso builds automation systems and simple custom apps for food businesses.",
    url:      "https://vyso.co.za",
    siteName: "Vyso",
    locale:   "en_ZA",
    type:     "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Global SVG filter for LiquidButton glass effect */}
        <LiquidGlassFilter />
        {/* Custom cursor — self-activates on hover-capable devices only */}
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
