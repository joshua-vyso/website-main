import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  FileCheck2,
  HandCoins,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  Sprout,
  Tags,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "South African Operations Software | Vyso OrderFlow";
const description =
  "Operations software for South African SMEs and SMMEs. Manage ZAR price lists, customer accounts, quotes, orders, VAT-aware invoices, delivery notes and payments in one workflow.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/south-africa" },
  openGraph: {
    title,
    description,
    url: "https://vyso.co.za/south-africa",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const LOCAL_CAPABILITIES = [
  {
    icon: BadgeDollarSign,
    title: "Rands at the centre",
    copy: "Keep customer pricing, quotes, invoices, payments and account balances in ZAR instead of translating a foreign-first workflow.",
  },
  {
    icon: FileCheck2,
    title: "VAT-aware documents",
    copy: "Capture seller and customer VAT details and apply standard, zero-rated or exempt treatment to tax invoices and credit notes.",
  },
  {
    icon: HandCoins,
    title: "Local payment reality",
    copy: "Record EFT, cash, card or other payments with references, then keep outstanding and overdue balances visible to the team.",
  },
  {
    icon: Tags,
    title: "Customer-specific trade",
    copy: "Manage price lists, rebates, customer purchase orders, account terms, credit limits and delivery details in the same commercial record.",
  },
  {
    icon: MessageSquareText,
    title: "Messy orders, cleaner intake",
    copy: "Upload WhatsApp screenshots, email captures, PDFs or photographed orders so the information can be extracted and reviewed before it moves forward.",
  },
  {
    icon: MapPinned,
    title: "Implemented with local context",
    copy: "Vyso combines the software with workflow mapping, data preparation, rollout and support for South African operating teams.",
  },
] as const;

const MIGRATION_STEPS = [
  {
    title: "Choose one operational problem",
    copy: "Start with the repeated admin that is costing the team the most time or creating the most uncertainty.",
  },
  {
    title: "Move only the data the workflow needs",
    copy: "Agree which customer, product and price-list records belong in the first rollout instead of attempting a risky big-bang migration.",
  },
  {
    title: "Run, learn and expand",
    copy: "Put the focused workflow into real use, refine it with the team and add another module only when the next need is clear.",
  },
] as const;

const FAQS = [
  {
    question: "Can OrderFlow create VAT-aware South African tax invoices?",
    answer:
      "Yes. OrderFlow supports seller and customer details, VAT numbers, document numbering, line items, VAT values and standard, zero-rated or exempt VAT treatment. Your accountant or tax practitioner remains responsible for confirming the correct tax treatment and statutory requirements for your business.",
  },
  {
    question: "Can OrderFlow create quotes and invoices in South African rand?",
    answer:
      "Yes. OrderFlow keeps customer pricing, document totals, payments and balances in ZAR, including customer-specific price lists and commercial terms.",
  },
  {
    question: "Can we track EFT, cash and card payments?",
    answer:
      "Yes. Teams can record EFT, cash, card and other payments, add a reference, and see what has been paid, what remains outstanding and what is overdue. This is payment recording and account visibility, not a claim that Vyso processes every payment method directly.",
  },
  {
    question: "Can customers keep sending orders through WhatsApp or email?",
    answer:
      "OrderFlow can accept uploaded WhatsApp screenshots, email captures, PDFs and photographed orders for extraction and review. A direct WhatsApp or email integration is a separate requirement and is confirmed during scoping.",
  },
  {
    question: "Does OrderFlow replace Sage, Pastel, Xero or QuickBooks?",
    answer:
      "OrderFlow can replace parts of the operating workflow, such as customer pricing, order capture and invoicing, but it is not presented as a full accounting ledger or tax-submission product. Any required accounting connection or migration boundary is agreed during implementation.",
  },
  {
    question: "Does using Vyso make a business POPIA compliant?",
    answer:
      "No software makes a business POPIA compliant by itself. Vyso can support more consistent records, organisation-scoped access and role-aware permissions, while compliance still depends on how your business collects, uses, retains, shares and protects personal information.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/south-africa#webpage",
      url: "https://vyso.co.za/south-africa",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": "https://vyso.co.za/south-africa#breadcrumb" },
      about: { "@id": "https://vyso.co.za/south-africa#service" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/south-africa#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "Vyso in South Africa",
          item: "https://vyso.co.za/south-africa",
        },
      ],
    },
    {
      "@type": "Service",
      "@id": "https://vyso.co.za/south-africa#service",
      name: "Vyso operations software for South African SMEs",
      serviceType: "Configurable operations software and implementation",
      description,
      provider: { "@id": "https://vyso.co.za/#organization" },
      areaServed: { "@type": "Country", name: "South Africa" },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "South African SMEs and SMMEs",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://vyso.co.za/south-africa#faq",
      mainEntity: FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function SouthAfricaPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="south-africa-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Vyso in South Africa" }]} />
          <p className={styles.eyebrow}>Vyso in South Africa</p>
          <h1 id="south-africa-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Local operations are specific.</span>{" "}
            <span className={styles.blendAccent}>Your software should be too.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso helps South African SMEs and SMMEs move customer accounts, price
            lists, quotes, orders, VAT-aware invoices, delivery notes and payments
            out of disconnected chats and spreadsheets and into one working flow.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Discuss your workflow <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform#orderflow">
              Explore OrderFlow
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="local-proof-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Local proof, not local wallpaper</p>
              <h2 id="local-proof-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Built around how South African B2B trade actually moves.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              “Built for South Africa” should mean more than showing a flag. It
              should appear in the currency, documents, payment methods, customer
              terms and imperfect order inputs your team handles every day.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {LOCAL_CAPABILITIES.map(({ icon: Icon, title: capabilityTitle, copy }) => (
              <article key={capabilityTitle} className={styles.moduleCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                </span>
                <h3 className={styles.cardTitle}>{capabilityTitle}</h3>
                <p className={styles.cardCopy}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="boundary-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>A clear operating boundary</p>
            <h2 id="boundary-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Operational control without pretending software is your accountant.
            </h2>
            <p className={styles.sectionCopy}>
              OrderFlow manages the commercial work before and around accounting:
              the customer request, agreed price, order, delivery document, invoice,
              payment and account history. It is not presented as a VAT return,
              statutory filing or full general-ledger product.
            </p>
            <div className={styles.actions}>
              <Link className={styles.textLink} href="/faq#south-africa">
                Read the South Africa FAQs <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <article className={styles.glassCard}>
            <span className={styles.cardIcon}>
              <ShieldCheck aria-hidden="true" size={20} strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardTitle}>Support for compliance work, not a magic badge.</h3>
            <p className={styles.cardCopy}>
              Consistent records, VAT-aware documents and controlled access can
              support better operating discipline. Your business and its advisers
              remain responsible for tax treatment, recordkeeping, privacy duties
              and other legal obligations.
            </p>
            <div className={styles.cardFoot}>
              <p className={styles.cardKicker}>Official guidance</p>
              <div className={styles.actions} style={{ marginTop: "0.8rem" }}>
                <a
                  className={styles.textLink}
                  href="https://www.sars.gov.za/types-of-tax/value-added-tax/"
                  target="_blank"
                  rel="noreferrer"
                >
                  SARS VAT guidance <span aria-hidden="true">↗</span>
                </a>
                <a
                  className={styles.textLink}
                  href="https://inforegulator.org.za/popia/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Information Regulator <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="migration-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>A lower-risk starting point</p>
              <h2 id="migration-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Improve one workflow before replacing everything.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              A local system is only useful if the team can put it into practice.
              Vyso starts with a defined operational problem and a controlled rollout,
              not an all-at-once software upheaval.
            </p>
          </div>

          <div className={styles.audienceGrid}>
            {MIGRATION_STEPS.map((step, index) => (
              <article key={step.title} className={styles.answerCard}>
                <p className={styles.cardKicker}>Step {index + 1}</p>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="south-africa-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Direct answers</p>
          <h2 id="south-africa-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            South African operations, without vague promises.
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

      <section className={styles.section} aria-labelledby="local-sectors-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Current operating focus</p>
              <h2 id="local-sectors-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Starting where the workflow is tangible.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Vyso can serve SMEs across sectors. Our current beachhead is food,
              where pricing, repeat orders, delivery documents, payments and margin
              pressure make connected operations especially valuable.
            </p>
          </div>
          <div className={styles.audienceGrid}>
            {[
              {
                icon: Truck,
                title: "Food suppliers",
                copy: "Customer-specific pricing, repeat orders, delivery and accounts.",
                href: "/industries/food-suppliers",
              },
              {
                icon: Sprout,
                title: "Farms & producers",
                copy: "Availability, wholesale buyers and order-to-cash visibility.",
                href: "/industries/farms",
              },
              {
                icon: UtensilsCrossed,
                title: "Restaurants",
                copy: "Purchasing, waste, staffing and margin routines.",
                href: "/industries/restaurants",
              },
            ].map(({ icon: Icon, title: sectorTitle, copy, href }) => (
              <article key={sectorTitle} className={styles.moduleCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                </span>
                <h3 className={styles.cardTitle}>{sectorTitle}</h3>
                <p className={styles.cardCopy}>{copy}</p>
                <div className={styles.cardFoot}>
                  <Link className={styles.textLink} href={href}>
                    Explore the workflow <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Start with the South African workflow you already have"
        title="Bring us the WhatsApp messages, spreadsheets and account admin."
        copy="We will map the current process, identify the highest-value starting point and show you what should move into Vyso first."
        primaryLabel="Discuss your workflow"
        secondaryLabel="View South African pricing"
        secondaryHref="/pricing"
      />
    </PublicPageShell>
  );
}
