import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Rocket, ShieldCheck, Wrench } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Become a Vyso Founding Client | South Africa";
const description =
  "Join Vyso's small founding-client cohort in South Africa. Implement a real operational workflow, work directly with the team and help shape the platform through structured feedback.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/founding-client" },
  openGraph: {
    title,
    description,
    url: "/founding-client",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const FAQS = [
  {
    question: "Is a founding-client engagement free?",
    answer:
      "No. Founding clients are commercial customers. The agreed scope and fees are confirmed upfront, with the founding relationship focused on closer access, structured testing and direct feedback—not free software.",
  },
  {
    question: "Does becoming a founding client mean replacing every current system?",
    answer:
      "No. We start with one operational workflow and preserve tools that are already doing their job. The audit establishes the smallest useful boundary before implementation begins.",
  },
  {
    question: "Will our business be used publicly as a case study?",
    answer:
      "Only with explicit approval. Product feedback can remain private, and any public logo, quote, result or case study is agreed separately before publication.",
  },
] as const;

const FOUNDING_STEPS = [
  { icon: Wrench, title: "Audit the workflow", copy: "Map the real process, friction and blind spots." },
  { icon: ShieldCheck, title: "Agree the scope", copy: "Choose the smallest useful first implementation." },
  { icon: Rocket, title: "Configure & launch", copy: "Test the workflow and put it into daily use." },
  { icon: MessagesSquare, title: "Review real use", copy: "Refine from evidence and specific team feedback." },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/founding-client#webpage",
      url: "https://vyso.co.za/founding-client",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": "https://vyso.co.za/founding-client#breadcrumb" },
      mainEntity: { "@id": "https://vyso.co.za/founding-client#service" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/founding-client#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Founding client", item: "https://vyso.co.za/founding-client" },
      ],
    },
    {
      "@type": "Service",
      "@id": "https://vyso.co.za/founding-client#service",
      name: "Vyso founding-client programme",
      serviceType: "Operations software implementation and structured product partnership",
      description,
      provider: { "@id": "https://vyso.co.za/#organization" },
      areaServed: { "@type": "Country", name: "South Africa" },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Growing South African SMEs with a defined operational workflow problem",
      },
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

export default function FoundingClientPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="founding-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Founding client" }]} />
          <p className={styles.eyebrow}>A small founding cohort</p>
          <h1 id="founding-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Use the platform.</span>{" "}
            <span className={styles.blendAccent}>Help shape what comes next.</span>
          </h1>
          <p className={styles.compactLead}>
            We are building Vyso with a focused group of up to five founding
            customers. Each business gets a real implementation and a direct line
            into the decisions that make the platform more useful in practice.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Apply to become a founding client <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform">Explore the platform</Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="founding-receive-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>What founding clients receive</p>
              <h2 id="founding-receive-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                A working system, plus a closer feedback loop.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              This is not a waitlist or a speculative beta. The engagement starts
              with a defined operational problem and produces a system your team can
              use in the day-to-day business.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {[
              {
                icon: Wrench,
                title: "Hands-on implementation",
                copy: "We map the workflow, configure the agreed system and help the relevant people adopt it.",
              },
              {
                icon: MessagesSquare,
                title: "Direct product access",
                copy: "Your operational feedback reaches the people making product and implementation decisions.",
              },
              {
                icon: Rocket,
                title: "Early capability access",
                copy: "Where it is appropriate and safe, founding clients can test selected platform and Vyso AI preview capabilities.",
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

      <section className={styles.section} aria-labelledby="founding-fit-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>A good founding fit</p>
            <h2 id="founding-fit-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              The problem is real, repeated and owned by someone.
            </h2>
            <ul className={styles.list}>
              <li>The business is already operating and the workflow happens repeatedly.</li>
              <li>WhatsApp, spreadsheets, paper or disconnected tools are creating visible friction.</li>
              <li>One person can own the rollout and coordinate the relevant team.</li>
              <li>The business is willing to test the agreed process and give specific feedback.</li>
            </ul>
          </div>

          <article className={styles.glassCard}>
            <span className={styles.cardIcon}><ShieldCheck aria-hidden="true" size={20} /></span>
            <h3 className={styles.cardTitle}>Commercial, not experimental.</h3>
            <p className={styles.cardCopy}>
              Founding status does not mean your operation becomes an open-ended test.
              Scope, responsibilities, fees and support are agreed upfront. Public
              references, logos and case studies require separate approval.
            </p>
            <div className={styles.cardFoot}>
              <Link className={styles.textLink} href="/pricing">
                Review the standard pricing structure <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="founding-process-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>How it works</p>
          <h2 id="founding-process-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Four steps from messy workflow to structured learning.
          </h2>
          <ol className={`${styles.processLine} ${styles.processLineFour}`}>
            {FOUNDING_STEPS.map(({ icon: Icon, title: stepTitle, copy }) => (
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

      <section className={styles.section} aria-labelledby="founding-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Before you apply</p>
          <h2 id="founding-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            The important terms, stated plainly.
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
        eyebrow="Founding client applications"
        title="Bring us one operational problem worth fixing properly."
        copy="Tell us what the team repeats, where information gets lost and what the owner cannot see soon enough. We will test whether Vyso is the right fit."
        primaryLabel="Start the conversation"
        primaryHref="/contact"
        secondaryLabel="Read the Turn ’n Slice story"
        secondaryHref="/case-studies/turn-n-slice"
      />
    </PublicPageShell>
  );
}
