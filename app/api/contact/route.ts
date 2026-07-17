import { Resend } from "resend";
import { NextResponse } from "next/server";
import { rateLimitAllowed } from "@/lib/platform/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = "joshua@vyso.co.za";
const CALENDLY_LINK = "https://calendly.com/joshua-vyso/new-meeting";

/**
 * Public contact form. It sends mail from Vyso's own SPF/DKIM-aligned domain — an
 * internal notification AND an auto-reply to the submitter — so every input is hostile
 * until proven otherwise:
 *
 *  - Escape all interpolated fields. The auto-reply goes to a caller-supplied address, so
 *    unescaped markup would let anyone deliver phishing content FROM joshua@vyso.co.za to
 *    a victim of their choosing.
 *  - Validate the email is one well-formed address (no arrays, no CRLF header injection)
 *    and cap every field, so the form can't be turned into a mail relay.
 *  - Best-effort per-IP rate limit to blunt a flood. (In-memory, so it resets per
 *    instance — a real limiter needs a shared store; this is a stopgap, not the ceiling.)
 */

const MAX_LEN: Record<string, number> = { name: 120, business: 160, email: 254, challenge: 4000, tier: 60 };
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Max submissions per IP per 10-minute window (durable, fleet-wide — see rate-limit.ts).
const RATE_MAX = 5;
const RATE_WINDOW_SECONDS = 10 * 60;

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    if (!(await rateLimitAllowed(`contact:${ip}`, RATE_MAX, RATE_WINDOW_SECONDS))) {
      return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const field = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

    const name = field("name");
    const business = field("business");
    const email = field("email");
    const challenge = field("challenge");
    const tier = field("tier");

    if (!name || !business || !email || !challenge) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    for (const [k, v] of Object.entries({ name, business, email, challenge, tier })) {
      if (v.length > MAX_LEN[k]) {
        return NextResponse.json({ error: `${k} is too long.` }, { status: 400 });
      }
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // Header-safe versions for the subject line (strip CR/LF so nothing can smuggle a
    // header even if a provider ever passed the value through unencoded).
    const sName = name.replace(/[\r\n]+/g, " ");
    const sBusiness = business.replace(/[\r\n]+/g, " ");

    // Everything below is escaped: safe to interpolate into HTML.
    const eName = escapeHtml(name);
    const eBusiness = escapeHtml(business);
    const eEmail = escapeHtml(email);
    const eTier = escapeHtml(tier);
    const eChallenge = escapeHtml(challenge).replace(/\n/g, "<br>");
    const tierLine = tier && tier !== "Not sure" ? `<strong>Tier interest:</strong> ${eTier}<br>` : "";

    await Promise.all([
      // Notify Joshua
      resend.emails.send({
        from: "Vyso Website <noreply@vyso.co.za>",
        to: RECIPIENT,
        subject: `New enquiry from ${sName} — ${sBusiness}`.slice(0, 200),
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">New enquiry via vyso.co.za</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p><strong>Name:</strong> ${eName}</p>
            <p><strong>Business:</strong> ${eBusiness}</p>
            <p><strong>Email:</strong> <a href="mailto:${eEmail}">${eEmail}</a></p>
            ${tierLine}
            <p style="margin-top: 16px;"><strong>Operational challenge:</strong></p>
            <blockquote style="border-left: 3px solid #10b981; padding-left: 12px; color: #374151; margin: 8px 0;">
              ${eChallenge}
            </blockquote>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">Sent from the Vyso contact form.</p>
          </div>
        `,
      }),

      // Auto-reply to enquirer
      resend.emails.send({
        from: "Joshua at Vyso <joshua@vyso.co.za>",
        to: email,
        subject: "Got your message — here's how to book a call",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">Thanks, ${eName} — we've received your enquiry.</h2>
            <p style="color: #374151; line-height: 1.6;">
              I'll personally read through what you've shared and get back to you within 24 hours.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              In the meantime, if you'd like to jump straight in, you can book a free 15-minute
              call at a time that suits you:
            </p>
            <div style="margin: 24px 0;">
              <a
                href="${CALENDLY_LINK}"
                style="
                  display: inline-block;
                  background-color: #BE5D23;
                  color: #fff;
                  text-decoration: none;
                  padding: 12px 24px;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 15px;
                "
              >
                Book a 15-minute call →
              </a>
            </div>
            <p style="color: #374151; line-height: 1.6;">
              It's a no-pressure conversation — we'll listen to what's breaking down in your
              ops and tell you honestly how Vyso can help.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">
              Joshua Moreira<br>
              Vyso — AI-Powered Operations for SMEs<br>
              <a href="mailto:joshua@vyso.co.za" style="color: #BE5D23;">joshua@vyso.co.za</a>
              &nbsp;·&nbsp;
              <a href="https://vyso.co.za" style="color: #BE5D23;">vyso.co.za</a>
            </p>
          </div>
        `,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
