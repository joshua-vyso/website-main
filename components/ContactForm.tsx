"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ButtonLink from "@/components/ButtonLink";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      business: (form.elements.namedItem("business") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      challenge: (form.elements.namedItem("challenge") as HTMLTextAreaElement).value,
      tier: (form.elements.namedItem("tier") as HTMLSelectElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Message received</h2>
        <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
          We&apos;ve sent a confirmation to your email with a link to book a 15-minute
          call at a time that suits you.
        </p>
        <ButtonLink
          href="https://calendly.com/joshua-vyso/new-meeting"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          target="_blank"
          rel="noopener noreferrer"
        >
          Book Your Call Now <ArrowRight className="ml-2 h-4 w-4" />
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Joshua Moreira"
            required
            className="bg-secondary border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business">Business name</Label>
          <Input
            id="business"
            name="business"
            placeholder="My Restaurant"
            required
            className="bg-secondary border-border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@yourbusiness.co.za"
          required
          className="bg-secondary border-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tier">Which tier are you interested in?</Label>
        <select
          id="tier"
          name="tier"
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue=""
        >
          <option value="" disabled>
            Select a tier (optional)
          </option>
          <option value="Starter">Starter — Quick wins with existing tools</option>
          <option value="Build">Build — Custom app + automations</option>
          <option value="Scale">Scale — Full ops platform</option>
          <option value="Not sure">Not sure yet</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="challenge">What&apos;s your biggest operational challenge?</Label>
        <Textarea
          id="challenge"
          name="challenge"
          placeholder="Describe what's breaking down in your ops — stock management, wastage, supplier chaos, no visibility into margins..."
          rows={5}
          required
          className="bg-secondary border-border resize-none"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={status === "loading"}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            Send Enquiry <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        We&apos;ll respond within 24 hours. You&apos;ll also receive a link to book a free
        15-minute call straight away.
      </p>
    </form>
  );
}
