import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimitAllowed } from "@/lib/platform/rate-limit";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from "@/lib/platform/env";

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = "joshua@vyso.co.za";

/**
 * Marketing "Join Waitlist" capture. Mirrors app/api/contact/route.ts's hostile-input
 * posture (this is a public, unauthenticated endpoint): escape all interpolated fields,
 * validate + cap every input, rate-limit per IP.
 *
 * Writes go through the SECURITY DEFINER `waitlist_join` RPC (supabase/onboarding.sql) via
 * the anon key — no service-role key in the web app. The DB write and the notification
 * email are independent best-effort paths: if the migration hasn't been pasted yet (RPC
 * missing) or the DB call otherwise fails, we still send the notification email and tell
 * the visitor they're on the list, rather than surfacing a dead end. Only a total failure
 * of both paths is reported as an error.
 */

const MAX_LEN: Record<string, number> = { name: 120, email: 254, company: 160, sourcePath: 300 };
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RATE_MAX = 5;
const RATE_WINDOW_SECONDS = 60 * 60; // 5/hr/IP

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    if (!(await rateLimitAllowed(`waitlist:${ip}`, RATE_MAX, RATE_WINDOW_SECONDS))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const field = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

    const name = field("name");
    const email = field("email");
    const company = field("company");
    const sourcePath = field("sourcePath");

    if (!name || !email) {
      return NextResponse.json({ error: "Please enter your name and email." }, { status: 400 });
    }
    for (const [k, v] of Object.entries({ name, email, company, sourcePath })) {
      if (v.length > MAX_LEN[k]) {
        return NextResponse.json({ error: `${k} is too long.` }, { status: 400 });
      }
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // Best-effort DB write via the SECURITY DEFINER RPC. Missing table/RPC (migration not
    // yet pasted) or any other DB failure degrades silently — the notification email below
    // is the fallback record.
    let dbOk = false;
    if (supabaseConfigured) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
        const { error } = await supabase.rpc("waitlist_join", {
          p_name: name,
          p_email: email,
          p_company: company || null,
          p_source_path: sourcePath || null,
        });
        dbOk = !error;
        if (error) console.error("waitlist_join RPC error:", error.message);
      } catch (err) {
        console.error("waitlist_join RPC threw:", err);
      }
    }

    // Header-safe versions for the subject line.
    const sName = name.replace(/[\r\n]+/g, " ");
    const eName = escapeHtml(name);
    const eEmail = escapeHtml(email);
    const eCompany = escapeHtml(company);
    const eSourcePath = escapeHtml(sourcePath);

    let mailOk = false;
    try {
      await resend.emails.send({
        from: "Vyso Website <noreply@vyso.co.za>",
        to: RECIPIENT,
        subject: `Waitlist signup — ${sName}`.slice(0, 200),
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">New waitlist signup via vyso.co.za</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p><strong>Name:</strong> ${eName}</p>
            <p><strong>Email:</strong> <a href="mailto:${eEmail}">${eEmail}</a></p>
            ${eCompany ? `<p><strong>Business:</strong> ${eCompany}</p>` : ""}
            ${eSourcePath ? `<p><strong>From page:</strong> ${eSourcePath}</p>` : ""}
            ${dbOk ? "" : `<p style="color:#c0392b;"><strong>Note:</strong> the waitlist_signups DB write failed or the migration is not applied — this email is the only record.</p>`}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">Sent from the Vyso waitlist form.</p>
          </div>
        `,
      });
      mailOk = true;
    } catch (err) {
      console.error("Waitlist notification email error:", err);
    }

    // Never fail the visitor if either path (DB row or notification email) succeeded.
    if (!dbOk && !mailOk) {
      return NextResponse.json(
        { error: "Failed to join the waitlist. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist route error:", err);
    return NextResponse.json(
      { error: "Failed to join the waitlist. Please try again." },
      { status: 500 }
    );
  }
}
