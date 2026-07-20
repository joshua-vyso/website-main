"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const INITIAL_STATE = { name: "", business: "", email: "", challenge: "", tier: "" };

const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

const INPUT: React.CSSProperties = {
  ...BODY,
  width:           "100%",
  padding:         "0.65rem 1rem",
  fontSize:        "0.9rem",
  color:           "#0d0d0d",
  background:      "rgba(255,255,255,0.7)",
  border:          "1px solid #e0ddd9",
  borderRadius:    12,
  outline:         "none",
  boxSizing:       "border-box" as const,
  transition:      "border-color 0.2s, box-shadow 0.2s",
};

const LABEL: React.CSSProperties = {
  ...BODY,
  fontSize:     "0.8rem",
  fontWeight:   600,
  color:        "#444",
  marginBottom: "0.4rem",
  display:      "block",
};

export default function ContactForm() {
  const [status, setStatus]   = useState<Status>("idle");
  const [errorMsg, setError]  = useState("");
  const [fields, setFields]   = useState(INITIAL_STATE);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const data = fields;

    try {
      const res = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "4rem 1rem", textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "hsl(22 69% 44% / 0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "1.2rem",
        }}>
          <CheckCircle2 size={28} color="hsl(22,69%,44%)" />
        </div>
        <h2 style={{ fontFamily: "var(--font-sans)", fontSize: "1.6rem", fontWeight: 700,
          color: "#0d0d0d", margin: "0 0 0.75rem" }}>Message received</h2>
        <p style={{ ...BODY, fontSize: "0.95rem", color: "#666", lineHeight: 1.65,
          maxWidth: 340, margin: "0 0 1.5rem" }}>
          We&apos;ve sent a confirmation to your email with a link to book a 15-minute
          call at a time that suits you.
        </p>
        <button
          onClick={() => { setStatus("idle"); setFields(INITIAL_STATE); setError(""); }}
          style={{
            ...BODY,
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.75rem 1.8rem", borderRadius: 50,
            background: "hsl(22,69%,44%)", color: "#fff",
            fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer",
          }}
        >
          Send in another enquiry <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {/* Name + Business */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
        className="form-name-row">
        <div>
          <label htmlFor="name" style={LABEL}>Your name</label>
          <input
            id="name" name="name" type="text"
            placeholder="John Smith"
            value={fields.name}
            onChange={handleChange}
            required
            style={INPUT}
            onFocus={e => {
              e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
              e.currentTarget.style.boxShadow   = "0 0 0 3px hsl(22 69% 44% / 0.12)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "#e0ddd9";
              e.currentTarget.style.boxShadow   = "none";
            }}
          />
        </div>
        <div>
          <label htmlFor="business" style={LABEL}>Business name</label>
          <input
            id="business" name="business" type="text"
            placeholder="My Business"
            value={fields.business}
            onChange={handleChange}
            required
            style={INPUT}
            onFocus={e => {
              e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
              e.currentTarget.style.boxShadow   = "0 0 0 3px hsl(22 69% 44% / 0.12)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "#e0ddd9";
              e.currentTarget.style.boxShadow   = "none";
            }}
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" style={LABEL}>Email address</label>
        <input
          id="email" name="email" type="email"
          placeholder="you@yourbusiness.co.za"
          value={fields.email}
          onChange={handleChange}
          required
          style={INPUT}
          onFocus={e => {
            e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px hsl(22 69% 44% / 0.12)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "#e0ddd9";
            e.currentTarget.style.boxShadow   = "none";
          }}
        />
      </div>

      {/* Tier */}
      <div>
        <label htmlFor="tier" style={LABEL}>What are you interested in?</label>
        <select
          id="tier" name="tier"
          value={fields.tier}
          onChange={handleChange}
          style={{ ...INPUT, cursor: "pointer", appearance: "none" as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 1rem center",
            paddingRight: "2.5rem",
          }}
        >
          <option value="" disabled>Select a tier (optional)</option>
          <option value="Audit">One-week audit — R2,000 once-off</option>
          <option value="Start">Start — R5,000 setup + R3,000/month</option>
          <option value="Create">Create — R20,000 setup + R6,000/month</option>
          <option value="Scale">Scale — R30,000 setup + R8,000/month</option>
          <option value="Not sure">Not sure yet</option>
        </select>
      </div>

      {/* Challenge */}
      <div>
        <label htmlFor="challenge" style={LABEL}>What&apos;s your biggest operational challenge?</label>
        <textarea
          id="challenge" name="challenge"
          placeholder="Describe what's breaking down in your ops — stock management, wastage, supplier chaos, no visibility into margins..."
          value={fields.challenge}
          onChange={handleChange}
          rows={5}
          required
          style={{ ...INPUT, resize: "none" as const, lineHeight: 1.6 }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px hsl(22 69% 44% / 0.12)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "#e0ddd9";
            e.currentTarget.style.boxShadow   = "none";
          }}
        />
      </div>

      {status === "error" && (
        <p style={{ ...BODY, fontSize: "0.85rem", color: "#c0392b" }}>{errorMsg}</p>
      )}

      {/* Submit — pill shape */}
      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          ...BODY,
          width:           "100%",
          padding:         "0.9rem 1.5rem",
          borderRadius:    50,
          border:          "none",
          background:      "hsl(22,69%,44%)",
          color:           "#fff",
          fontSize:        "0.95rem",
          fontWeight:      600,
          cursor:          status === "loading" ? "not-allowed" : "pointer",
          opacity:         status === "loading" ? 0.7 : 1,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          gap:             "0.4rem",
          transition:      "background 0.2s, opacity 0.2s",
        }}
        onMouseEnter={e => {
          if (status !== "loading") (e.currentTarget as HTMLButtonElement).style.background = "hsl(22,72%,38%)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "hsl(22,69%,44%)";
        }}
      >
        {status === "loading" ? (
          <>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Sending...
          </>
        ) : (
          <>
            Send Enquiry <ArrowRight size={16} />
          </>
        )}
      </button>

      <p style={{ ...BODY, fontSize: "0.75rem", color: "#999", textAlign: "center", margin: 0 }}>
        We&apos;ll respond within 24 hours. You&apos;ll also receive a link to book a free
        15-minute call straight away.
      </p>
    </form>
  );
}
