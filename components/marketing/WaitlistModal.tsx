"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

const INPUT: React.CSSProperties = {
  ...BODY,
  width:        "100%",
  padding:      "0.65rem 1rem",
  fontSize:     "0.9rem",
  color:        "#0d0d0d",
  background:   "rgba(255,255,255,0.7)",
  border:       "1px solid #e0ddd9",
  borderRadius: 12,
  outline:      "none",
  boxSizing:    "border-box" as const,
  transition:   "border-color 0.2s, box-shadow 0.2s",
};

const LABEL: React.CSSProperties = {
  ...BODY,
  fontSize:     "0.8rem",
  fontWeight:   600,
  color:        "#444",
  marginBottom: "0.4rem",
  display:      "block",
};

function focusRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px hsl(22 69% 44% / 0.12)";
}
function blurRing(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#e0ddd9";
  e.currentTarget.style.boxShadow   = "none";
}

/**
 * Marketing-site waitlist capture modal. Styled with the orange accent system
 * (see public-marketing.module.css) — NOT the platform blue system. Posts to
 * /api/waitlist with the page the visitor triggered it from as source_path.
 */
export function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus]   = useState<Status>("idle");
  const [errorMsg, setError]  = useState("");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [company, setCompany] = useState("");
  const pathname = usePathname();
  const nameRef = useRef<HTMLInputElement>(null);

  // No SSR "mounted" gate needed: WaitlistCtaButton only mounts this component
  // client-side, after a user click (`{open && <WaitlistModal .../>}`) — it
  // never renders during server rendering, so `document` is always available.

  // Escape closes; lock body scroll while open; focus the first field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setStatus("error");
      setError("Please enter your name and email.");
      return;
    }
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, company, sourcePath: pathname }),
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

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(13,13,13,0.45)",
          backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-modal-title"
        style={{
          position:     "relative",
          width:        "min(440px, 100%)",
          maxHeight:    "calc(100vh - 2.5rem)",
          overflowY:    "auto",
          background:   "#fff",
          border:       "1px solid rgba(0,0,0,0.06)",
          borderRadius: 20,
          boxShadow:    "0 28px 80px rgba(0,0,0,0.24)",
          padding:      "2rem",
          boxSizing:    "border-box",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: "1.1rem", right: "1.1rem",
            width: 32, height: 32, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid #eee", background: "rgba(255,255,255,0.8)",
            color: "#666", cursor: "pointer",
          }}
        >
          <X size={15} />
        </button>

        {status === "success" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "1.5rem 0 0.5rem", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "hsl(22 69% 44% / 0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "1.2rem",
            }}>
              <CheckCircle2 size={28} color="hsl(22,69%,44%)" />
            </div>
            <h2 id="waitlist-modal-title" style={{ fontFamily: "var(--font-sans)", fontSize: "1.4rem",
              fontWeight: 700, color: "#0d0d0d", margin: "0 0 0.6rem" }}>
              You&apos;re on the list
            </h2>
            <p style={{ ...BODY, fontSize: "0.92rem", color: "#666", lineHeight: 1.6,
              maxWidth: 320, margin: "0 0 0.5rem" }}>
              We&apos;ll be in touch as soon as a spot opens up. Thanks for your patience.
            </p>
          </div>
        ) : (
          <>
            <h2 id="waitlist-modal-title" style={{ fontFamily: "var(--font-sans)", fontSize: "1.5rem",
              fontWeight: 700, color: "#0d0d0d", margin: "0 0 0.4rem", paddingRight: "1.5rem" }}>
              Join the waitlist
            </h2>
            <p style={{ ...BODY, fontSize: "0.88rem", color: "#666", lineHeight: 1.55, margin: "0 0 1.4rem" }}>
              Leave your details and we&apos;ll reach out as we open up new spots.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div>
                <label htmlFor="waitlist-name" style={LABEL}>Your name</label>
                <input
                  ref={nameRef}
                  id="waitlist-name" name="name" type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  maxLength={120}
                  style={INPUT}
                  onFocus={focusRing}
                  onBlur={blurRing}
                />
              </div>

              <div>
                <label htmlFor="waitlist-email" style={LABEL}>Email address</label>
                <input
                  id="waitlist-email" name="email" type="email"
                  placeholder="you@yourbusiness.co.za"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  style={INPUT}
                  onFocus={focusRing}
                  onBlur={blurRing}
                />
              </div>

              <div>
                <label htmlFor="waitlist-company" style={LABEL}>Business name <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span></label>
                <input
                  id="waitlist-company" name="company" type="text"
                  placeholder="My Business"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  maxLength={160}
                  style={INPUT}
                  onFocus={focusRing}
                  onBlur={blurRing}
                />
              </div>

              {status === "error" && (
                <p style={{ ...BODY, fontSize: "0.85rem", color: "#c0392b", margin: 0 }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  ...BODY,
                  width:          "100%",
                  padding:        "0.85rem 1.5rem",
                  borderRadius:   50,
                  border:         "none",
                  background:     "hsl(22,69%,44%)",
                  color:          "#fff",
                  fontSize:       "0.92rem",
                  fontWeight:     600,
                  cursor:         status === "loading" ? "not-allowed" : "pointer",
                  opacity:        status === "loading" ? 0.7 : 1,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  gap:            "0.4rem",
                  transition:     "background 0.2s, opacity 0.2s",
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
                    Joining...
                  </>
                ) : (
                  <>
                    Join the waitlist <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default WaitlistModal;
