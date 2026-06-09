import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Mail, MessageCircle } from "lucide-react";
import ContactForm from "@/components/ContactForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Vyso",
  description:
    "Get in touch with Vyso. Send an enquiry or book a free 15-minute call to talk through your operational challenges.",
};

export default function ContactPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 pb-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <Badge variant="outline" className="border-primary/30 text-primary mb-4">
            Contact
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 max-w-xl">
            Let&apos;s talk about your ops
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
            Send us an enquiry and we&apos;ll get back to you within 24 hours — or
            book a free 15-minute call directly.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card className="bg-card border-border">
                <CardContent className="p-8">
                  <h2 className="text-xl font-bold mb-6">Send an enquiry</h2>
                  <ContactForm />
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Book a call directly</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Prefer to jump straight in? Book a free 15-minute info call at a
                    time that suits you.
                  </p>
                  <Link
                    href="https://calendly.com/joshua-vyso/new-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Schedule on Calendly →
                  </Link>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Email us directly</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    For anything that doesn&apos;t fit the form.
                  </p>
                  <a
                    href="mailto:joshua@vyso.co.za"
                    className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    joshua@vyso.co.za
                  </a>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">What to expect</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Reply within 24 hours</li>
                    <li>• No hard sell — just an honest conversation</li>
                    <li>• A Calendly link arrives in your inbox immediately</li>
                    <li>• Free discovery call, no commitment</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
