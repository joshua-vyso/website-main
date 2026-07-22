import { Badge } from "@/components/ui/badge";
import ButtonLink from "@/components/ButtonLink";
import { ArrowRight, X, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Vyso",
  description:
    "Vyso is an AI-powered operations and automation company for food businesses in Africa. We're an ops partner, not a generic software agency.",
};

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 pb-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <Badge variant="outline" className="border-primary/30 text-primary mb-4">
            About
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl leading-tight">
            We build automation systems and simple custom apps for food businesses.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            So owners spend less time managing chaos — and more time running their
            business.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-bold mb-5">The problem we&apos;re solving</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed text-sm">
                <p>
                  Most small food businesses in Africa are operationally blind. Stock
                  levels are tracked on WhatsApp. Wastage goes unlogged. Supplier
                  orders are sent as voice notes. Staff hours are written on paper.
                </p>
                <p>
                  The result is predictable: stockouts, margin erosion, labour cost
                  overruns, and owners who spend more time firefighting than building
                  their business.
                </p>
                <p>
                  The tools to fix this exist — but they&apos;re either too complex, too
                  expensive, or not built for how these businesses actually work.
                  Vyso bridges that gap.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-5">What we actually deliver</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed text-sm">
                <p>
                  We diagnose operational problems, set up automations that handle
                  the repetitive work, and where needed, build a lightweight custom
                  app as the interface. Then we stay on as the client&apos;s ops
                  partner — not a once-off contractor.
                </p>
                <p>
                  The app creates natural lock-in: once a team uses it daily,
                  switching costs are high. But more importantly, the client&apos;s
                  business is genuinely better — more visible, less manual, and more
                  profitable.
                </p>
                <p>
                  We target food businesses first because the operational pain is
                  universal, the problems are solvable, and the market in Africa is
                  massively underserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What we are / are not */}
      <section className="py-20 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-10">What Vyso is — and isn&apos;t</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <p className="text-sm font-semibold text-primary mb-5 uppercase tracking-wider">
                What we are
              </p>
              <ul className="space-y-4">
                {[
                  "An operations partner for small food businesses",
                  "An automation and custom app builder with deep ops knowledge",
                  "A long-term relationship, not a project engagement",
                  "Specialists in food business operations in Africa",
                  "A team that makes technology simple enough for any staff member",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-5 uppercase tracking-wider">
                What we&apos;re not
              </p>
              <ul className="space-y-4">
                {[
                  "A generic software agency that builds anything for anyone",
                  "An accountant or financial advisor",
                  "A complex enterprise software vendor",
                  "A one-off build team who disappears after launch",
                  "A tool — we're a partner with skin in the outcome",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Target market */}
      <section className="py-20 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-5">Who we work with</h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-6">
              Our clients are small and medium food businesses — restaurants,
              takeaways, catering operations, food producers, and market vendors —
              primarily in South Africa, with broader Africa in mind as we grow.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm mb-6">
              The common thread: they&apos;re operationally chaotic, usually running
              things on WhatsApp and spreadsheets, and the owner is spending too much
              time doing manual work that a system should be handling.
            </p>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We start with a diagnosis. If there&apos;s a problem we can solve, we&apos;ll
              tell you what it is and how. If there&apos;s not, we&apos;ll tell you that too.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Want to work with us?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Start with a free 15-minute call. No pitch, no pressure — just an honest
            conversation about what&apos;s not working in your ops.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ButtonLink
              href="https://calendly.com/joshua-vyso/new-meeting"
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a Free Call <ArrowRight className="ml-2 h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="outline" className="border-border px-8">
              Send an Enquiry
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
