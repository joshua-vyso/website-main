import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FileCheck2, ListChecks, RefreshCw, UsersRound } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Turn 'n Slice Invoicing Case Study | Vyso OrderFlow";
const description =
  "See how Turn 'n Slice is using Vyso OrderFlow to replace QuickBooks as its invoicing system, automate invoicing, create price lists in seconds and manage customer accounts centrally.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/case-studies/turn-n-slice" },
  openGraph: {
    title,
    description,
    url: "/case-studies/turn-n-slice",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "article",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/case-studies/turn-n-slice#webpage",
      url: "https://vyso.co.za/case-studies/turn-n-slice",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": "https://vyso.co.za/case-studies/turn-n-slice#breadcrumb" },
      mainEntity: { "@id": "https://vyso.co.za/case-studies/turn-n-slice#article" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/case-studies/turn-n-slice#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Food suppliers", item: "https://vyso.co.za/industries/food-suppliers" },
        { "@type": "ListItem", position: 3, name: "Turn 'n Slice", item: "https://vyso.co.za/case-studies/turn-n-slice" },
      ],
    },
    {
      "@type": "Article",
      "@id": "https://vyso.co.za/case-studies/turn-n-slice#article",
      headline: "How OrderFlow is replacing QuickBooks for Turn 'n Slice invoicing",
      description,
      genre: "Case study",
      image: "https://vyso.co.za/turn-n-slice-logo-clean.png",
      author: { "@id": "https://vyso.co.za/#organization" },
      publisher: { "@id": "https://vyso.co.za/#organization" },
      about: {
        "@type": "Organization",
        name: "Turn 'n Slice",
        industry: "FMCG food preparation and supply",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Johannesburg",
          addressCountry: "ZA",
        },
      },
    },
  ],
};

export default function TurnNSliceCaseStudyPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="case-study-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Food suppliers", href: "/industries/food-suppliers" },
              { label: "Turn 'n Slice" },
            ]}
          />
          <p className={styles.eyebrow}>Founding-customer story</p>
          <h1 id="case-study-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Replacing invoicing admin</span>{" "}
            <span className={styles.blendAccent}>with one operational brain.</span>
          </h1>
          <p className={styles.compactLead}>
            Turn &apos;n Slice is a Johannesburg food business and Vyso&apos;s first
            founding customer. OrderFlow is already replacing QuickBooks as its
            invoicing system, bringing price lists, customer accounts, quotes, orders,
            invoices and payments into one connected operation.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/founding-client">
              Become a founding client <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform">Explore the platform</Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="case-facts-heading">
        <div className={styles.shell}>
          <h2 id="case-facts-heading" className="sr-only">Turn n Slice case-study facts</h2>
          <div className={`${styles.proofGrid} ${styles.caseFactsGrid}`}>
            <div className={styles.logoCard}>
              <Image
                src="/turn-n-slice-logo-clean.png"
                alt="Turn n Slice"
                width={500}
                height={500}
                preload
                sizes="(max-width: 760px) 70vw, 420px"
              />
            </div>
            <div className={`${styles.statGrid} ${styles.statGridTwo}`}>
              {[
                ["Johannesburg", "South African operation"],
                ["FMCG food", "Sector"],
                ["Founding", "Customer relationship"],
                ["OrderFlow", "Invoicing platform"],
              ].map(([value, label]) => (
                <article key={label} className={styles.statCard}>
                  <p className={styles.statValue}>{value}</p>
                  <p className={styles.statLabel}>{label}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="case-challenge-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>The invoicing transition</p>
            <h2 id="case-challenge-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              From QuickBooks and manual pricing to one connected operation.
            </h2>
            <p className={styles.sectionCopy}>
              Invoicing is more than producing a document. It depends on current prices,
              the right customer terms, an accurate quote and order trail, and a clear
              view of what has been paid. Turn &apos;n Slice is moving that day-to-day
              work into OrderFlow, with one system carrying the context from pricing to
              payment.
            </p>
          </div>
          <div className={styles.answerGrid}>
            {[
              { icon: ListChecks, title: "Price lists in seconds", copy: "Create and maintain customer-ready price lists without rebuilding them manually." },
              { icon: UsersRound, title: "Central customer accounts", copy: "Keep each customer, their pricing and their commercial history together in one operational record." },
              { icon: FileCheck2, title: "Connected invoicing", copy: "Carry the same information from quote and order through to invoice and payment tracking." },
              { icon: RefreshCw, title: "Repeat work automated", copy: "Reduce recurring invoicing administration while keeping people in control of commercial decisions." },
            ].map(({ icon: Icon, title: cardTitle, copy }) => (
              <article key={cardTitle} className={styles.answerCard}>
                <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                <h3 style={{ marginTop: "1rem" }}>{cardTitle}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="case-result-heading">
        <div className={styles.shell}>
          <article className={styles.quoteCard}>
            <p className={styles.quoteMark} aria-hidden="true">“</p>
            <h2 id="case-result-heading" className={styles.quoteText}>
              Vyso is automating our entire invoicing operation. We can build price
              lists in seconds and manage every customer account from one central
              operational brain.
            </h2>
            <p className={styles.quoteByline}>
              Roberto · Turn &apos;n Slice · Johannesburg, South Africa
            </p>
            <p className={styles.statLabel} style={{ maxWidth: 620, margin: "1rem auto 0" }}>
              Founding-customer statement about the current OrderFlow implementation.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="case-learning-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>What the work reinforces</p>
            <h2 id="case-learning-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Invoicing works better when it is part of the operation.
            </h2>
          </div>
          <ul className={styles.list}>
            <li>Customer accounts are more useful when pricing, quotes, orders, invoices and payments share the same context.</li>
            <li>Price-list creation should be a routine operational task, not a slow manual rebuild.</li>
            <li>Replacing QuickBooks as the invoicing system means giving the operating team a workflow built around how orders actually move.</li>
            <li>Automation is strongest when it removes repeat administration while leaving important commercial decisions visible.</li>
          </ul>
        </div>
      </section>

      <MarketingCta
        eyebrow="Replace the invoicing patchwork"
        title="Build one invoicing operation around the way your business actually works."
        copy="Bring us the pricing, customer-account and invoicing workflow you use today. We will map it, connect the right steps and identify what OrderFlow can automate."
        primaryLabel="Discuss your invoicing workflow"
        secondaryLabel="Vyso for food suppliers"
        secondaryHref="/industries/food-suppliers"
      />
    </PublicPageShell>
  );
}
