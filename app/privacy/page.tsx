import type { Metadata } from "next";

import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { WebGLShaderBackground } from "@/components/WebGLShaderBackground";

export const metadata: Metadata = {
  title: "Privacy Policy | Vyso",
  description:
    "How Vyso collects, uses, protects and processes personal information under the Protection of Personal Information Act.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "22 July 2026";
const CONTACT_EMAIL = "joshua@vyso.co.za";

const sectionStyle: React.CSSProperties = {
  padding: "1.75rem 0",
  borderTop: "1px solid #e7e4e0",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "clamp(1.25rem, 2vw, 1.55rem)",
  fontWeight: 650,
  letterSpacing: "-0.02em",
  color: "#151515",
  margin: "0 0 0.7rem",
};

const copyStyle: React.CSSProperties = {
  fontFamily: "var(--font-body, var(--font-sans))",
  fontSize: "1rem",
  lineHeight: 1.75,
  color: "#4f4b47",
  margin: 0,
};

const listStyle: React.CSSProperties = {
  ...copyStyle,
  display: "grid",
  gap: "0.5rem",
  paddingLeft: "1.25rem",
  margin: "0.85rem 0 0",
};

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ position: "relative", isolation: "isolate" }}>
      <WebGLShaderBackground global />
      <Navbar visible />

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "9.5rem clamp(1.25rem, 5vw, 3rem) 6rem",
        }}
      >
        <header style={{ marginBottom: "3rem" }}>
          <p
            style={{
              fontFamily: "var(--font-body, var(--font-sans))",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "hsl(22, 69%, 44%)",
              margin: "0 0 0.85rem",
            }}
          >
            Legal
          </p>
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(3rem, 7vw, 5.25rem)",
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: "-0.045em",
              color: "#111",
              margin: 0,
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ ...copyStyle, marginTop: "1.25rem" }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </header>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 12px 45px rgba(0,0,0,0.06)",
            borderRadius: 20,
            padding: "clamp(1.4rem, 3vw, 2.5rem)",
            backdropFilter: "blur(16px)",
          }}
        >
          <Section title="1. Who we are">
            <p style={copyStyle}>
              Vyso is an operations software and implementation business operated by Joshua Moreira as a sole proprietor in South Africa. In this policy, “Vyso”, “we”, “us” and “our” mean that business. We are committed to processing personal information lawfully and in accordance with the Protection of Personal Information Act 4 of 2013 (“POPIA”).
            </p>
            <p style={{ ...copyStyle, marginTop: "0.85rem" }}>
              For privacy questions or requests, contact us at {" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#a74c1b", fontWeight: 650 }}>
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section title="2. When this policy applies">
            <p style={copyStyle}>
              This policy applies to personal information processed through vyso.co.za, the Vyso platform, enquiries and implementation or support services. It explains how we handle information about website visitors, prospective customers, Vyso users and people whose information is included in a customer’s account or records.
            </p>
          </Section>

          <Section title="3. Information we process">
            <p style={copyStyle}>Depending on how you use Vyso, we may process:</p>
            <ul style={listStyle}>
              <li>contact and identity information, such as a name, business name, email address, telephone number and job role;</li>
              <li>account and organisational information, including authorised-user details and access roles;</li>
              <li>business-operational information entered into the platform, such as customer and supplier contacts, delivery addresses, quotes, orders, invoices, payments, stock and related records;</li>
              <li>documents, email messages and attachments submitted, forwarded or connected by a customer for processing, including information contained in those materials;</li>
              <li>communications, support requests, feedback and website enquiry information; and</li>
              <li>limited technical and security information needed to operate and protect our services, such as IP address and request data used for abuse prevention.</li>
            </ul>
            <p style={{ ...copyStyle, marginTop: "0.85rem" }}>
              Please do not provide special personal information—such as health, biometric, religious, political, trade-union or criminal-record information—unless it is necessary for an agreed service and you are authorised to provide it.
            </p>
          </Section>

          <Section title="4. How we collect information">
            <p style={copyStyle}>
              We collect information directly from you when you contact us, create or use an account, request support or provide records for implementation. We also receive information from a Vyso customer when that customer adds authorised users or business contacts to its workspace, or enables an agreed integration such as email ingestion or a connected Gmail inbox.
            </p>
          </Section>

          <Section title="5. Why we use information">
            <p style={copyStyle}>We process personal information to:</p>
            <ul style={listStyle}>
              <li>respond to enquiries, arrange meetings and provide requested information;</li>
              <li>set up, operate, support, secure and improve the Vyso service;</li>
              <li>process documents, emails and business records when a customer has enabled those features;</li>
              <li>communicate about an account, service changes, support and billing;</li>
              <li>prevent fraud, misuse and security incidents; and</li>
              <li>meet legal, tax, accounting and record-keeping obligations that apply to us.</li>
            </ul>
            <p style={{ ...copyStyle, marginTop: "0.85rem" }}>
              We rely on the grounds allowed by POPIA, including consent where required, performance of an agreement, our legitimate interests in operating and securing Vyso, and compliance with legal obligations. We do not sell personal information or use a customer’s contacts, documents or inbox content for Vyso’s own marketing.
            </p>
          </Section>

          <Section title="6. Our role and our customers’ role">
            <p style={copyStyle}>
              For information we collect for our own website, sales, accounts and service operations, Vyso is generally the responsible party under POPIA. Where a customer uses Vyso to store or process its own employees’, customers’, suppliers’ or other contacts’ information, that customer generally determines the purpose and means of processing and is the responsible party. Vyso generally acts as its operator and processes that information only to provide and support the agreed service, or as otherwise required by law.
            </p>
          </Section>

          <Section title="7. Service providers and international processing">
            <p style={copyStyle}>
              We use carefully selected service providers to run Vyso. Depending on the features used, this may include Supabase for authentication, database and file storage; Resend for email delivery and inbound email handling; Google for a customer-authorised Gmail connection; and Anthropic for AI-assisted extraction, categorisation and summaries. We may also use professional advisers and hosting or infrastructure providers where needed to operate the service.
            </p>
            <p style={{ ...copyStyle, marginTop: "0.85rem" }}>
              Some providers may process information outside South Africa. Where this occurs, we take reasonable steps to ensure the transfer is permitted by POPIA and that appropriate contractual, technical or organisational safeguards apply.
            </p>
          </Section>

          <Section title="8. Security">
            <p style={copyStyle}>
              We use reasonable technical and organisational safeguards appropriate to the nature of the information and service. These include access controls, organisation-level separation of platform data, authentication, restricted administrative access, protected service credentials, and measures intended to prevent unauthorised access, loss, destruction or disclosure. No online service can guarantee absolute security; please use strong, unique credentials and notify us promptly if you suspect unauthorised account access.
            </p>
          </Section>

          <Section title="9. Retention and deletion">
            <p style={copyStyle}>
              We retain personal information only for as long as it is reasonably necessary for the purpose for which it was collected, to provide the service, resolve disputes, enforce agreements or meet legal obligations. Customer workspace data is retained for the duration of the customer relationship and then returned or deleted in accordance with the applicable agreement or documented instructions, unless we must retain it by law. We may retain de-identified information that no longer identifies a person.
            </p>
          </Section>

          <Section title="10. Your rights and choices">
            <p style={copyStyle}>
              Subject to POPIA and applicable law, you may ask us to confirm whether we hold your personal information, request access to it, ask for correction or deletion of inaccurate or unnecessary information, object to certain processing, or withdraw consent where processing relies on consent. You may also opt out of direct marketing at any time.
            </p>
            <p style={{ ...copyStyle, marginTop: "0.85rem" }}>
              Send requests to {" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#a74c1b", fontWeight: 650 }}>
                {CONTACT_EMAIL}
              </a>. If your information is in a customer’s Vyso workspace, please contact that customer first; we will assist the customer to respond where appropriate. You may also lodge a complaint with the South African Information Regulator.
            </p>
          </Section>

          <Section title="11. Direct marketing">
            <p style={copyStyle}>
              We will only send direct marketing where permitted by law. Every marketing message will identify Vyso and provide a practical way to opt out. Service messages about an existing account, security or a requested service are not marketing messages.
            </p>
          </Section>

          <Section title="12. Children">
            <p style={copyStyle}>
              Vyso is intended for business users and is not directed to children. We do not knowingly collect personal information from children for our own purposes. If you believe a child’s information has been provided to us in error, please contact us so that we can assess and address it.
            </p>
          </Section>

          <Section title="13. Changes to this policy">
            <p style={copyStyle}>
              We may update this policy as Vyso or the law changes. We will publish the updated version here and change the effective date. Where a material change affects an existing customer’s use of the service, we will provide additional notice where appropriate.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
