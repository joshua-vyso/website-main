import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Bot,
  CircleDollarSign,
  FileText,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Vyso Platform | OrderFlow Operations Software";
const description =
  "Meet OrderFlow, Vyso's connected order-management platform for South African SMEs. Manage customers, quotes, orders, invoices, delivery notes, payments and price lists in one workflow.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/platform" },
  openGraph: {
    title,
    description,
    url: "/platform",
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

const FEATURES = [
  {
    icon: Users,
    title: "Customers",
    copy: "Keep customer details, VAT treatment, payment terms, rebates and account history together.",
    tags: ["Customer records", "Account terms"],
  },
  {
    icon: FileText,
    title: "Quotes",
    copy: "Turn an enquiry into a priced quote, keep its status visible and carry accepted work forward.",
    tags: ["Quote requests", "Approvals"],
  },
  {
    icon: ShoppingCart,
    title: "Orders",
    copy: "Create orders manually or review orders extracted from customer documents before confirming them.",
    tags: ["Order intake", "Human review"],
  },
  {
    icon: ReceiptText,
    title: "Invoices",
    copy: "Create tax invoices from a quote, an order or a clean slate, using the right customer pricing.",
    tags: ["VAT-ready", "Price resolution"],
  },
  {
    icon: PackageCheck,
    title: "Delivery documents",
    copy: "Keep delivery notes and credit notes connected to the commercial record that created them.",
    tags: ["Delivery notes", "Credit notes"],
  },
  {
    icon: CircleDollarSign,
    title: "Payments",
    copy: "Record money received, monitor outstanding balances and see which invoices have become overdue.",
    tags: ["Outstanding", "Overdue"],
  },
] as const;

const FAQS = [
  {
    question: "What is OrderFlow?",
    answer:
      "OrderFlow is Vyso's order-management and invoicing hub. It connects customer records, quotes, orders, invoices, delivery documents, payments and price lists so the same information does not need to be retyped at every step.",
  },
  {
    question: "Who is OrderFlow best suited to?",
    answer:
      "OrderFlow is best suited to growing South African SMEs that sell repeatedly to other businesses and currently manage orders through email, WhatsApp, spreadsheets or disconnected accounting documents.",
  },
  {
    question: "Does OrderFlow replace accounting software?",
    answer:
      "OrderFlow is designed around the operational workflow before and around accounting: taking the order, applying the right price, producing the commercial documents and tracking what remains unpaid. Required accounting integrations are confirmed during implementation.",
  },
  {
    question: "Can OrderFlow work with customer-specific pricing?",
    answer:
      "Yes. OrderFlow supports price lists and customer-level commercial rules so the correct price can be resolved when a quote, order or invoice is prepared.",
  },
] as const;

const ORDERFLOW_STEPS = [
  { icon: MessageSquareText, title: "Enquiry", copy: "Capture the customer request once." },
  { icon: FileText, title: "Quote", copy: "Apply the right customer pricing." },
  { icon: ShoppingCart, title: "Order", copy: "Carry accepted work forward." },
  { icon: PackageCheck, title: "Delivery", copy: "Keep fulfilment connected." },
  { icon: ReceiptText, title: "Invoice", copy: "Create the commercial record." },
  { icon: CircleDollarSign, title: "Payment", copy: "See what remains outstanding." },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/platform#webpage",
      url: "https://vyso.co.za/platform",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      about: { "@id": "https://vyso.co.za/platform#orderflow" },
      breadcrumb: { "@id": "https://vyso.co.za/platform#breadcrumb" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/platform#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://vyso.co.za/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Platform",
          item: "https://vyso.co.za/platform",
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://vyso.co.za/platform#orderflow",
      name: "OrderFlow",
      alternateName: "OrderFlow by Vyso",
      applicationCategory: "BusinessApplication",
      applicationSuite: "Vyso",
      operatingSystem: "Web browser",
      countriesSupported: "ZA",
      description:
        "A connected customer order, quote, invoice, delivery document, payment and price-list workflow for growing SMEs.",
      image: "https://vyso.co.za/assets/orderflow-dashboard.png",
      provider: { "@id": "https://vyso.co.za/#organization" },
      featureList: [
        "Customer records",
        "Quotes and quote requests",
        "Customer orders",
        "Invoices and credit notes",
        "Delivery notes",
        "Payment tracking",
        "Customer price lists",
        "Operational search and reporting",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://vyso.co.za/platform#faq",
      mainEntity: FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function PlatformPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.hero} aria-labelledby="platform-heading">
        <AbstractFlowBackdrop />
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>The Vyso platform</p>
            <h1 id="platform-heading" className={styles.displayTitle}>
              <span className={styles.blendPlain}>Orders in.</span>{" "}
              <span className={styles.blendAccent}>Cash collected.</span>{" "}
              <span className={styles.blendPlain}>Nothing lost between.</span>
            </h1>
            <p className={styles.heroLead}>
              OrderFlow connects the commercial work your team repeats every day:
              customers, quotes, orders, invoices, delivery documents, payments and
              price lists—inside one clear operating workflow.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} href="#orderflow">
                Explore OrderFlow <span aria-hidden="true">↓</span>
              </Link>
              <Link className={styles.glassButton} href="/founding-client">
                Become a founding client
              </Link>
            </div>
          </div>

          <div className={styles.productStage}>
            <div className={styles.productWindow}>
              <Image
                src="/assets/orderflow-dashboard.png"
                alt="OrderFlow dashboard showing customers, orders, invoices, outstanding balances and recent activity"
                width={1627}
                height={960}
                preload
                sizes="(max-width: 1020px) 92vw, 58vw"
              />
            </div>
            <div className={`${styles.floatChip} ${styles.floatChipOne}`}>
              Customer pricing applied
            </div>
            <div className={`${styles.floatChip} ${styles.floatChipTwo}`}>
              Six orders ready to invoice
            </div>
          </div>
        </div>
      </section>

      <section id="orderflow" className={styles.section} aria-labelledby="orderflow-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Meet OrderFlow</p>
              <h2 id="orderflow-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                One record from first request to final payment.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              OrderFlow is Vyso&apos;s flagship module for businesses that sell
              repeatedly to other businesses. It replaces duplicate capture and
              scattered status updates with a connected commercial record.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {FEATURES.map(({ icon: Icon, title: featureTitle, copy, tags }) => (
              <article key={featureTitle} className={styles.glassCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                </span>
                <h3 className={styles.cardTitle}>{featureTitle}</h3>
                <p className={styles.cardCopy}>{copy}</p>
                <ul className={`${styles.tagList} ${styles.cardFoot}`}>
                  {tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <ol className={styles.processLine} aria-label="OrderFlow workflow">
            {ORDERFLOW_STEPS.map(({ icon: Icon, title: stepTitle, copy }) => (
              <li key={stepTitle} className={styles.processStep}>
                <span className={styles.processMarker}>
                  <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                </span>
                <div className={styles.processText}>
                  <h3 className={styles.processTitle}>{stepTitle}</h3>
                  <p className={styles.processCopy}>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="intelligence-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Built-in intelligence</p>
            <h2 id="intelligence-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              The system remembers the context.
            </h2>
            <p className={styles.sectionCopy}>
              Search across operational records, reuse the right customer pricing
              and let connected modules pass clean information forward instead of
              starting again at every handover.
            </p>
            <ul className={styles.list}>
              <li>Search customers, quotes, orders and invoices from one place.</li>
              <li>Resolve prices from the customer&apos;s price list when work is prepared.</li>
              <li>Carry accepted work into the next document without retyping it.</li>
              <li>Keep a visible activity trail for the team.</li>
            </ul>
          </div>

          <article className={styles.glassCard}>
            <span className={styles.statusPill}>Private preview</span>
            <span className={styles.cardIcon} style={{ marginTop: "1.35rem" }}>
              <Bot aria-hidden="true" size={20} strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardTitle}>Vyso AI</h3>
            <p className={styles.cardCopy}>
              An operations assistant being built into Vyso. The current preview can
              answer product questions, read authorised OrderFlow data and prepare a
              draft order for human review. It never finalises commercial documents
              on its own.
            </p>
            <div className={styles.cardFoot}>
              <Link className={styles.textLink} href="/platform/vyso-ai">
                See what is on track to launch <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="modules-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Vyso for SMEs</p>
              <h2 id="modules-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Start with one problem. Add only what earns its place.
              </h2>
            </div>
            <div>
              <p className={styles.sectionCopy}>
                The platform is modular: document intake, procurement, pricing,
                planning, waste, staffing, suppliers, reporting and order management
                can share one operating foundation.
              </p>
              <Link className={styles.textLink} href="/platform/vyso-for-smes">
                Explore every module <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className={styles.audienceGrid}>
            {[
              {
                title: "Restaurants",
                copy: "Tighter routines around purchasing, waste, shifts and margin visibility.",
                href: "/industries/restaurants",
              },
              {
                title: "Food suppliers",
                copy: "A clearer route from customer request and price list to delivery and payment.",
                href: "/industries/food-suppliers",
              },
              {
                title: "Farms & producers",
                copy: "Repeat customer orders, variable availability and commercial documents in one flow.",
                href: "/industries/farms",
              },
            ].map((audience) => (
              <article key={audience.title} className={styles.moduleCard}>
                <p className={styles.cardKicker}>Built for</p>
                <h3 className={styles.cardTitle}>{audience.title}</h3>
                <p className={styles.cardCopy}>{audience.copy}</p>
                <div className={styles.cardFoot}>
                  <Link className={styles.textLink} href={audience.href}>
                    Explore the workflow <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="proof-heading">
        <div className={`${styles.shell} ${styles.proofGrid}`}>
          <article className={styles.quoteCard}>
            <p className={styles.quoteMark} aria-hidden="true">“</p>
            <h2 id="proof-heading" className={styles.quoteText}>
              Vyso is automating our entire invoicing operation. We can build price
              lists in seconds and manage every customer account from one central
              operational brain.
            </h2>
            <p className={styles.quoteByline}>
              Roberto · Turn &apos;n Slice · FMCG sector · Johannesburg
            </p>
            <div className={styles.actions} style={{ justifyContent: "center" }}>
              <Link className={styles.glassButton} href="/case-studies/turn-n-slice">
                Read the founding-customer story
              </Link>
            </div>
          </article>

          <div className={styles.logoCard}>
            <Image
              src="/turn-n-slice-logo-clean.png"
              alt="Turn n Slice"
              width={500}
              height={500}
              sizes="(max-width: 760px) 65vw, 300px"
            />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="platform-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Straight answers</p>
          <h2 id="platform-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            OrderFlow, without the fog.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {FAQS.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/faq">
              Read all Vyso FAQs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="A practical first step"
        title="Bring us the workflow that keeps breaking."
        copy="We will map the process, test whether Vyso fits and recommend the smallest useful starting point before a larger implementation begins."
        primaryLabel="Talk to Vyso"
        secondaryLabel="View pricing"
        secondaryHref="/pricing"
      />
    </PublicPageShell>
  );
}
