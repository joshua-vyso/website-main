import { Card, CardContent } from "@/components/ui/card";
import ButtonLink from "@/components/ButtonLink";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Zap, Smartphone, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services — Vyso",
  description:
    "Three engagement tiers built for food businesses. Starter, Build, and Scale — each with a one-time setup fee and a monthly retainer.",
};

const tiers = [
  {
    name: "Starter",
    tagline: "Quick operational wins without disruption",
    price: "Starting from R[ ]",
    retainer: "R[ ] /month",
    best: "Clients not yet ready for a custom app, or who need quick wins before committing to a build. Low friction entry point.",
    description:
      "We come in, audit your operations, and set up automations using the tools you already have — WhatsApp, Google Sheets, email. No new app, no disruption to your team. You get immediate operational improvements with a 30-day support period so we can tune everything in.",
    includes: [
      "Operations audit and diagnosis session",
      "Workflow automation using existing tools (WhatsApp, Google Sheets, etc.)",
      "Reorder alerts when stock drops below threshold",
      "Wastage logging triggers",
      "Basic supplier contact and tracking setup",
      "30-day post-setup support period",
    ],
    featured: false,
  },
  {
    name: "Build",
    tagline: "Replace spreadsheets with a real system your team uses daily",
    price: "Starting from R[ ]",
    retainer: "R[ ] /month",
    best: "Clients ready to replace WhatsApp threads and scattered spreadsheets with a purpose-built app. This is where lock-in happens.",
    description:
      "Everything in Starter, plus a custom lightweight web or mobile app built around your specific operations. The app becomes your team's daily interface — stock updates, wastage logs, supplier comms, all in one place. Automations run inside the app, not around it.",
    includes: [
      "Everything in Starter",
      "Custom lightweight web or mobile app (your choice from our app portfolio)",
      "Automations integrated directly into the app",
      "Team onboarding session",
      "60-day support period post-launch",
      "One round of post-launch revisions included",
    ],
    featured: true,
  },
  {
    name: "Scale",
    tagline: "A full ops intelligence platform for growing teams",
    price: "Starting from R[ ]",
    retainer: "R[ ] /month",
    best: "Growing businesses with multiple staff, third-party systems, and a need for an ongoing ops partner — not just a once-off build.",
    description:
      "Everything in Build, plus integrations with your existing accounting software and POS system. Monthly ops reviews to identify new inefficiencies. Priority access to new features and automations as your business changes. A dedicated support line your team can reach when something needs attention.",
    includes: [
      "Everything in Build",
      "Third-party integrations (accounting software, POS systems)",
      "Monthly ops review and performance reporting",
      "Priority development for new features and automations",
      "Dedicated support line (WhatsApp or email)",
      "Quarterly ops strategy session",
    ],
    featured: false,
  },
];

const howItWorks = [
  {
    step: "01",
    icon: <Zap className="h-5 w-5 text-primary" />,
    title: "Discovery call",
    description:
      "A free 15-minute call where you tell us what's breaking down. We listen, ask questions, and figure out where the biggest leaks are.",
  },
  {
    step: "02",
    icon: <TrendingUp className="h-5 w-5 text-primary" />,
    title: "Ops audit and proposal",
    description:
      "We map your current workflows, identify the gaps, and send you a clear proposal — which tier makes sense, what we'll build, and what it costs.",
  },
  {
    step: "03",
    icon: <Smartphone className="h-5 w-5 text-primary" />,
    title: "Build and setup",
    description:
      "We set up the automations and, if you're on Build or Scale, build your custom app. You stay informed throughout — no surprises.",
  },
  {
    step: "04",
    icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
    title: "Onboarding and handover",
    description:
      "We train your team, run a live test, and hand over a system your staff can actually use. Then we stay on as your retainer partner.",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 pb-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <Badge variant="outline" className="border-primary/30 text-primary mb-4">
            Services
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 max-w-2xl">
            Three ways to work with Vyso
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Every engagement starts with a build fee and continues with a monthly
            retainer. The retainer is the core of the relationship — we stay your
            ops partner, not a once-off contractor.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-10">How an engagement works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step) => (
              <div key={step.step} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono text-primary font-bold">
                    {step.step}
                  </span>
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    {step.icon}
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers Detail */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`border ${
                tier.featured
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-border"
              } bg-card`}
            >
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: info */}
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        {tier.featured && (
                          <Badge className="bg-primary/20 text-primary border-0 text-xs mb-2">
                            Most Popular
                          </Badge>
                        )}
                        <h2 className="text-2xl font-bold">{tier.name}</h2>
                        <p className="text-primary text-sm font-medium mt-0.5">
                          {tier.tagline}
                        </p>
                      </div>
                    </div>

                    <p className="text-muted-foreground leading-relaxed mb-6 text-sm">
                      {tier.description}
                    </p>

                    <div>
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                        What&apos;s included
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tier.includes.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2.5 text-sm"
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right: pricing + CTA */}
                  <div className="flex flex-col justify-between gap-6 lg:border-l lg:border-border lg:pl-8">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Setup fee
                      </p>
                      <p className="text-3xl font-bold">{tier.price}</p>
                      <p className="text-sm text-muted-foreground mt-3">
                        + {tier.retainer} retainer
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scoped per engagement
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                        <span className="font-medium text-foreground">
                          Best for:
                        </span>{" "}
                        {tier.best}
                      </p>
                      <ButtonLink
                        href="/contact"
                        className={
                          tier.featured
                            ? "w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                            : "w-full"
                        }
                        variant={tier.featured ? "default" : "outline"}
                      >
                        Get a Quote <ArrowRight className="ml-2 h-4 w-4" />
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Revenue model note */}
      <section className="py-16 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-3">
              Why a retainer, not just a build fee?
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              A one-off build doesn&apos;t fix ops — it just gives you a new tool to
              manage. The retainer is how we stay accountable for the outcome. We
              monitor the automations, respond when something breaks, and keep
              improving the system as your business changes. You get a partner, not
              a project.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Not sure which tier is right?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Book a free 15-minute call. We&apos;ll ask a few questions and give you a
            straight answer.
          </p>
          <ButtonLink
            href="https://calendly.com/joshua-vyso/new-meeting"
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a Free Call <ArrowRight className="ml-2 h-4 w-4" />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
