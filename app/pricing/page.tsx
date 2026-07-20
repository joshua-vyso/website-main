import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { WebGLShaderBackground } from "@/components/WebGLShaderBackground";
import { PricingSection } from "@/components/sections/PricingSection";
import { SiteFooter } from "@/components/sections/SiteFooter";

const title = "Vyso Pricing | Audit, Start, Create & Scale";
const description =
  "View Vyso pricing: a one-week operations audit for R2,000, plus Start, Create and Scale plans with hands-on implementation and ongoing support.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title,
    description,
    url: "/pricing",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

const pricingSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/pricing#webpage",
      url: "https://vyso.co.za/pricing",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      mainEntity: { "@id": "https://vyso.co.za/pricing#service" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "Service",
      "@id": "https://vyso.co.za/pricing#service",
      name: "Vyso operations platform implementation and support",
      description,
      provider: { "@id": "https://vyso.co.za/#organization" },
      areaServed: { "@type": "Country", name: "South Africa" },
      offers: [
        { "@type": "Offer", name: "One-week operations audit", price: 2000, priceCurrency: "ZAR" },
        {
          "@type": "Offer",
          name: "Start",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", name: "Once-off setup", price: 5000, priceCurrency: "ZAR" },
            { "@type": "UnitPriceSpecification", name: "Monthly retainer", price: 3000, priceCurrency: "ZAR", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "month" } },
          ],
        },
        {
          "@type": "Offer",
          name: "Create",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", name: "Once-off setup", price: 20000, priceCurrency: "ZAR" },
            { "@type": "UnitPriceSpecification", name: "Monthly retainer", price: 6000, priceCurrency: "ZAR", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "month" } },
          ],
        },
        {
          "@type": "Offer",
          name: "Scale",
          priceSpecification: [
            { "@type": "UnitPriceSpecification", name: "Once-off setup", price: 30000, priceCurrency: "ZAR" },
            { "@type": "UnitPriceSpecification", name: "Monthly retainer", price: 8000, priceCurrency: "ZAR", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "month" } },
          ],
        },
        {
          "@type": "Offer",
          name: "Additional module",
          price: 3000,
          priceCurrency: "ZAR",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: 3000,
            priceCurrency: "ZAR",
            referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "month" },
          },
        },
      ],
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pricingSchema).replace(/</g, "\\u003c"),
        }}
      />
      <WebGLShaderBackground global />
      <Navbar visible />

      <main style={{ paddingTop: 64 }}>
        <PricingSection headingLevel="h1" />
      </main>

      <SiteFooter />
    </>
  );
}
