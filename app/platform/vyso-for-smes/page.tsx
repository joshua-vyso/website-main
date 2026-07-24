import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  Boxes,
  CalendarDays,
  FileStack,
  HandCoins,
  ReceiptText,
  ShoppingBasket,
  UsersRound,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Operations Software for South African SMEs | Vyso";
const description =
  "Explore Vyso's connected operations modules for South African SMEs: OrderFlow, Doc-U, ProcurePulse, PricePilot, PlanWise, WasteWatch, ShiftBoard, SupplySync and InsightGen.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/platform/vyso-for-smes" },
  openGraph: {
    title,
    description,
    url: "/platform/vyso-for-smes",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const MODULES = [
  {
    icon: ReceiptText,
    name: "OrderFlow",
    role: "Orders, invoicing & customer operations",
    copy: "Connect customers, quotes, orders, invoices, delivery documents, payments and price lists.",
    href: "/platform#orderflow",
  },
  {
    icon: FileStack,
    name: "Doc-U",
    role: "Document intake & extraction",
    copy: "Capture operational documents and turn their important fields and line items into reviewable data.",
  },
  {
    icon: ShoppingBasket,
    name: "ProcurePulse",
    role: "Procurement & stock intelligence",
    copy: "Plan purchasing, understand stock movement and make buying decisions from a cleaner operational record.",
  },
  {
    icon: HandCoins,
    name: "PricePilot",
    role: "Pricing & margin recommendations",
    copy: "Keep selling prices connected to current cost information and make margin decisions with better context.",
  },
  {
    icon: BarChart3,
    name: "PlanWise",
    role: "Budgeting & forecasting",
    copy: "Set operating targets and compare real performance with the plan the business is working toward.",
  },
  {
    icon: Boxes,
    name: "WasteWatch",
    role: "Waste & shrinkage",
    copy: "Record losses consistently, identify patterns and make preventable waste visible to the people who can act.",
  },
  {
    icon: CalendarDays,
    name: "ShiftBoard",
    role: "Labour & scheduling",
    copy: "Plan shifts, manage availability and keep labour deployment visible alongside the rest of the operation.",
  },
  {
    icon: UsersRound,
    name: "SupplySync",
    role: "Supplier relationships",
    copy: "Keep supplier contacts, history, quality conversations and operational risk in one searchable record.",
  },
  {
    icon: Bot,
    name: "InsightGen",
    role: "Reporting & operational insight",
    copy: "Turn connected module data into reports, alerts and practical cross-workflow insight.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/platform/vyso-for-smes#webpage",
      url: "https://vyso.co.za/platform/vyso-for-smes",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": "https://vyso.co.za/platform/vyso-for-smes#breadcrumb" },
      mainEntity: { "@id": "https://vyso.co.za/platform/vyso-for-smes#service" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/platform/vyso-for-smes#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Platform", item: "https://vyso.co.za/platform" },
        { "@type": "ListItem", position: 3, name: "Vyso for SMEs", item: "https://vyso.co.za/platform/vyso-for-smes" },
      ],
    },
    {
      "@type": "Service",
      "@id": "https://vyso.co.za/platform/vyso-for-smes#service",
      name: "Vyso operations platform for SMEs",
      serviceType: "Configurable operations software and implementation",
      description,
      provider: { "@id": "https://vyso.co.za/#organization" },
      areaServed: { "@type": "Country", name: "South Africa" },
      audience: { "@type": "BusinessAudience", audienceType: "Small and medium businesses" },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Vyso modules",
        itemListElement: MODULES.map((module, index) => ({
          "@type": "OfferCatalog",
          position: index + 1,
          name: module.name,
          description: module.copy,
        })),
      },
    },
    {
      "@type": "ItemList",
      name: "Vyso operations modules",
      itemListElement: MODULES.map((module, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: module.name,
        description: module.copy,
      })),
    },
  ],
};

export default function VysoForSmesPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="smes-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Platform", href: "/platform" },
              { label: "Vyso for SMEs" },
            ]}
          />
          <p className={styles.eyebrow}>Vyso for SMEs</p>
          <h1 id="smes-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>One operating foundation.</span>{" "}
            <span className={styles.blendAccent}>Focused modules where they matter.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso is a configurable operations platform for growing South African
            businesses. Start with the workflow causing the most friction, then add
            modules only when the next operational need is clear.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Discuss your workflow <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/pricing">View pricing</Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="module-list-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>The module set</p>
              <h2 id="module-list-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Each module has one clear operational job.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Modules share customer, product, supplier and document context where
              the workflow requires it. That lets the system grow without turning
              every addition into another disconnected tool.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {MODULES.map(({ icon: Icon, name, role, copy, ...module }) => (
              <article key={name} className={styles.moduleCard}>
                <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardKicker}>{role}</p>
                <p className={styles.cardCopy} style={{ marginTop: "0.75rem" }}>{copy}</p>
                {"href" in module && module.href ? (
                  <div className={styles.cardFoot}>
                    <Link className={styles.textLink} href={module.href}>
                      Explore {name} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="modular-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Configured, not dumped on you</p>
            <h2 id="modular-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Software and implementation belong together.
            </h2>
            <p className={styles.sectionCopy}>
              We map the current workflow, configure the agreed modules, move the
              right data across, help the relevant people adopt the new process and
              support it after launch.
            </p>
          </div>
          <article className={styles.glassCard}>
            <p className={styles.cardKicker}>How expansion works</p>
            <h3 className={styles.cardTitle}>Add a module for a defined reason.</h3>
            <p className={styles.cardCopy}>
              Each additional module is R3,000 per month. We recommend an addition
              only when it solves a named operational problem and has a clear place
              in the surrounding workflow.
            </p>
            <div className={styles.cardFoot}>
              <Link className={styles.textLink} href="/pricing">
                See Start, Create and Scale <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sme-audiences-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>South Africa first</p>
          <h2 id="sme-audiences-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Built around operations, then shaped to the sector.
          </h2>
          <div className={styles.audienceGrid} style={{ marginTop: "2.5rem" }}>
            {[
              ["Restaurants", "Purchasing, waste, shifts and margin routines.", "/industries/restaurants"],
              ["Food suppliers", "Customer orders, price lists, delivery and payment.", "/industries/food-suppliers"],
              ["Farms & producers", "Availability, repeat buyers and order-to-cash workflows.", "/industries/farms"],
            ].map(([label, copy, href]) => (
              <article key={label} className={styles.answerCard}>
                <h3>{label}</h3>
                <p>{copy}</p>
                <div className={styles.actions}>
                  <Link className={styles.textLink} href={href}>Explore <span aria-hidden="true">→</span></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Choose the first problem"
        title="You do not need to implement everything at once."
        copy="Start with the one-week audit, define the highest-value workflow and build outward only when the operation is ready."
        secondaryLabel="Become a founding client"
        secondaryHref="/founding-client"
      />
    </PublicPageShell>
  );
}
