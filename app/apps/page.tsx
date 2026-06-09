import { Card, CardContent } from "@/components/ui/card";
import ButtonLink from "@/components/ButtonLink";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Trash2,
  Truck,
  Users,
  ShoppingCart,
  TrendingUp,
  LayoutDashboard,
  ArrowRight,
  Smartphone,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apps — Vyso",
  description:
    "Purpose-built apps for food business operations. Stock management, wastage logging, supplier portals, and more — mobile-first and simple enough for any staff member.",
};

const apps = [
  {
    icon: <BarChart3 className="h-6 w-6 text-primary" />,
    name: "Stock Manager",
    tagline: "Never run out of key ingredients again",
    description:
      "Track inventory levels in real time. Set reorder thresholds per item and get automatic alerts — to you or directly to your supplier — when stock drops below the line. Simple enough for any team member to update from their phone.",
    solves: "Stockouts that no one saw coming because the spreadsheet wasn't updated.",
    tier: "Build & Scale",
  },
  {
    icon: <Trash2 className="h-6 w-6 text-primary" />,
    name: "Wastage Logger",
    tagline: "Find out exactly where your margins are bleeding",
    description:
      "Log food or product wastage with a reason code (expired, damaged, over-prep). Surface trends over time — by item, by day, by reason. Feeds directly into your margin visibility so you can see the real cost of waste.",
    solves:
      "Food getting thrown out daily with no record of what, how much, or why.",
    tier: "Build & Scale",
  },
  {
    icon: <Truck className="h-6 w-6 text-primary" />,
    name: "Supplier Portal",
    tagline: "Replace WhatsApp threads with a real supplier record",
    description:
      "Manage all supplier contacts in one place. Track every order placed, flag late deliveries, and keep a full history of what was ordered, from whom, and at what price. No more lost messages or missed follow-ups.",
    solves:
      "Supplier management scattered across WhatsApp, email, and handwritten notes.",
    tier: "Build & Scale",
  },
  {
    icon: <Users className="h-6 w-6 text-primary" />,
    name: "Shift Tracker",
    tagline: "See your labour cost per shift, not just per month",
    description:
      "Log staff hours, wages, and shifts in a simple daily check-in. Integrates with cost tracking to show labour cost per day or per shift — giving owners a clear picture of their biggest variable expense in real time.",
    solves:
      "Not knowing true labour cost until the payroll run — by which point it's too late to act.",
    tier: "Build & Scale",
  },
  {
    icon: <ShoppingCart className="h-6 w-6 text-primary" />,
    name: "Procurement Manager",
    tagline: "Build and send purchase orders without leaving the app",
    description:
      "Create POs from within the app, send them directly to suppliers, and keep a full record of every order — what was ordered, from whom, and at what price. Reorder flows trigger automatically where possible.",
    solves:
      "POs being sent as voice notes or WhatsApp texts with no paper trail.",
    tier: "Build & Scale",
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    name: "Margin Calculator",
    tagline: "Always know what's actually profitable on your menu",
    description:
      "Live view of margins per product or menu item. When input costs change — ingredient price goes up, portion size changes — margins recalculate automatically. Flags items that have slipped below your target margin.",
    solves:
      "Selling items for months without realising the margin has been eroded by cost increases.",
    tier: "Scale",
  },
  {
    icon: <LayoutDashboard className="h-6 w-6 text-primary" />,
    name: "Daily Ops Dashboard",
    tagline: "One screen with everything that matters — every morning",
    description:
      "A single summary view of the most important numbers for the day: stock levels, wastage logged, sales figures (if POS integrated), and staff on shift. The owner's first screen every morning before service starts.",
    solves:
      "Starting the day with no visibility — finding out about problems after it's too late to fix them.",
    tier: "Scale",
  },
];

export default function AppsPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 pb-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <Badge variant="outline" className="border-primary/30 text-primary mb-4">
            Apps
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 max-w-2xl">
            Purpose-built tools for food ops
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Apps are not sold standalone — they are always paired with automation
            setup and are part of the Build and Scale tiers. Each app is built once
            and customised per client.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="py-14 border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: <Smartphone className="h-4 w-4 text-primary" />,
                label: "Mobile-first",
                desc: "Built for phones, not desktops",
              },
              {
                icon: <Users className="h-4 w-4 text-primary" />,
                label: "Staff-ready",
                desc: "No training needed",
              },
              {
                icon: <BarChart3 className="h-4 w-4 text-primary" />,
                label: "Data-driven",
                desc: "Feeds clean data to the owner",
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-primary" />,
                label: "Customised",
                desc: "Built around your workflow",
              },
            ].map((p) => (
              <div key={p.label} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  {p.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps Grid */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apps.map((app) => (
              <Card key={app.name} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {app.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-foreground">{app.name}</h2>
                        <Badge
                          variant="outline"
                          className="text-xs border-primary/20 text-primary"
                        >
                          {app.tier}
                        </Badge>
                      </div>
                      <p className="text-sm text-primary mt-0.5">{app.tagline}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {app.description}
                  </p>

                  <div className="rounded-lg bg-secondary/50 border border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Solves: </span>
                      {app.solves}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Want a custom app for your business?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Apps are included in the Build and Scale tiers. Book a call and we&apos;ll
            tell you which app makes the most sense for your specific ops.
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
            <ButtonLink href="/services" size="lg" variant="outline" className="border-border px-8">
              See Pricing Tiers
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
