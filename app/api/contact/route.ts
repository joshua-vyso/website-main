import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = "joshua@vyso.co.za";
const CALENDLY_LINK = "https://calendly.com/joshua-vyso/new-meeting";

export async function POST(req: Request) {
  try {
    const { name, business, email, challenge, tier } = await req.json();

    if (!name || !business || !email || !challenge) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const tierLine = tier && tier !== "Not sure" ? `<strong>Tier interest:</strong> ${tier}<br>` : "";

    await Promise.all([
      // Notify Joshua
      resend.emails.send({
        from: "Vyso Website <noreply@vyso.co.za>",
        to: RECIPIENT,
        subject: `New enquiry from ${name} — ${business}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">New enquiry via vyso.co.za</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Business:</strong> ${business}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${tierLine}
            <p style="margin-top: 16px;"><strong>Operational challenge:</strong></p>
            <blockquote style="border-left: 3px solid #10b981; padding-left: 12px; color: #374151; margin: 8px 0;">
              ${challenge.replace(/\n/g, "<br>")}
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
            <h2 style="margin-bottom: 4px;">Thanks, ${name} — we've received your enquiry.</h2>
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
              Vyso — Operations & Automation for Food Businesses<br>
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
