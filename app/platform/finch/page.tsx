import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChartNoAxesCombined, MessagesSquare, ScanSearch } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Finch | Operations Assistant for OrderFlow";
const description =
  "See the private preview of Finch: an operations assistant designed to answer questions, read authorised OrderFlow data and prepare work for human review.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/platform/finch" },
  openGraph: {
    title,
    description,
    url: "/platform/finch",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const FAQS = [
  {
    question: "Is Finch available to every customer?",
    answer:
      "Not yet. Finch is currently in a private preview while its permissions, answers and human-review workflows are tested with controlled accounts.",
  },
  {
    question: "Can Finch send or finalise an invoice on its own?",
    answer:
      "No. The current design keeps consequential commercial actions under human control. Finch can read authorised data and prepare selected drafts, but a person reviews and confirms the work.",
  },
  {
    question: "What data can Finch see?",
    answer:
      "It only uses the modules, records and financial visibility available to the signed-in user and their organisation. Existing role and organisation boundaries still apply.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/platform/finch#webpage",
      url: "https://vyso.co.za/platform/finch",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      about: { "@id": "https://vyso.co.za/platform/finch#software" },
      breadcrumb: { "@id": "https://vyso.co.za/platform/finch#breadcrumb" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/platform/finch#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Platform", item: "https://vyso.co.za/platform" },
        { "@type": "ListItem", position: 3, name: "Finch", item: "https://vyso.co.za/platform/finch" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://vyso.co.za/platform/finch#software",
      name: "Finch",
      applicationCategory: "BusinessApplication",
      applicationSuite: "Vyso",
      operatingSystem: "Web browser",
      softwareVersion: "Private preview",
      countriesSupported: "ZA",
      description,
      provider: { "@id": "https://vyso.co.za/#organization" },
      featureList: [
        "Vyso product guidance",
        "Authorised OrderFlow business snapshots",
        "Recent invoice and order lookups",
        "Customer account lookups",
        "Draft order preparation with human review",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function FinchPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="finch-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Platform", href: "/platform" },
              { label: "Finch" },
            ]}
          />
          <span className={styles.statusPill}>Private preview · on track to launch</span>
          <h1 id="finch-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Ask the operation.</span>{" "}
            <span className={styles.blendAccent}>Get an answer grounded in your work.</span>
          </h1>
          <p className={styles.compactLead}>
            Finch is being built as an assistant inside the platform—not a separate
            chatbot. It understands the current module, follows the signed-in user&apos;s
            permissions and keeps people in control of consequential work.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/founding-client">
              Join the founding cohort <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform#orderflow">
              Explore OrderFlow
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ai-now-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>What works in preview</p>
              <h2 id="ai-now-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Useful before it tries to be clever.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              The preview is intentionally narrow. It is focused on reliable product
              guidance, authorised operational questions and carefully bounded draft
              preparation.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {[
              {
                icon: MessagesSquare,
                title: "Product guidance",
                copy: "Ask how a feature works and get the short click-path inside OrderFlow or Doc-U.",
              },
              {
                icon: ChartNoAxesCombined,
                title: "Live business questions",
                copy: "Ask about authorised revenue, outstanding balances, recent orders or invoices without searching every screen.",
              },
              {
                icon: ScanSearch,
                title: "Operational lookups",
                copy: "Find a customer, inspect a specific order or understand what remains unpaid using the current business record.",
              },
            ].map(({ icon: Icon, title: featureTitle, copy }) => (
              <article key={featureTitle} className={styles.glassCard}>
                <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                <h3 className={styles.cardTitle}>{featureTitle}</h3>
                <p className={styles.cardCopy}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="guardrails-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <article className={styles.glassCard}>
            <span className={styles.cardIcon}><Bot aria-hidden="true" size={20} /></span>
            <h2 className={styles.cardTitle}>Draft, then decide.</h2>
            <p className={styles.cardCopy}>
              The workflow tier can prepare a draft order from a user&apos;s request,
              match the customer and products, and open it for review. The user still
              corrects anything uncertain and confirms the order themselves.
            </p>
            <ul className={styles.tagList}>
              <li>Human confirmation</li>
              <li>Catalogue matching</li>
              <li>No automatic finalisation</li>
            </ul>
          </article>

          <div>
            <p className={styles.sectionKicker}>Designed with boundaries</p>
            <h2 id="guardrails-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Assistance should not outrun accountability.
            </h2>
            <ul className={styles.list}>
              <li>Organisation-level data boundaries remain in force.</li>
              <li>Financial visibility follows the user&apos;s existing role.</li>
              <li>Unsupported questions receive an honest limitation, not an invented answer.</li>
              <li>Commercial actions remain reviewable before they become records.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ai-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Before launch</p>
          <h2 id="ai-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Clear expectations for the preview.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {FAQS.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Shape the launch"
        title="Test Finch against real operational questions."
        copy="Founding clients help us test what is useful, what needs tighter guardrails and where an assistant genuinely saves time."
        secondaryLabel="Talk to us"
        secondaryHref="/contact"
      />
    </PublicPageShell>
  );
}
