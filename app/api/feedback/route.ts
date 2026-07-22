import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerSupabase } from '@/lib/platform/supabase-server';

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = 'joshua@vyso.co.za';
const MAX_SCREENSHOTS = 4;
// Defensive cap on the whole JSON payload — 4 downscaled screenshots (~1.2MB
// each, base64 ~1.6MB) plus a message should sit well under this.
const MAX_PAYLOAD_CHARS = 9_000_000;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * In-app feedback (bug reports / feature requests) from the sidebar Feedback
 * button. Best-effort logs a `feedback` row (tolerates the table being missing)
 * and always emails Joshua a copy with the screenshots attached, so feedback is
 * never lost if the migration hasn't been run yet.
 *
 * Body: { category: 'bug'|'feature', message: string, pageUrl: string,
 *         screenshots: string[] /* base64 data URLs *\/ }
 */
export async function POST(req: Request) {
  let body: {
    category?: unknown;
    message?: unknown;
    pageUrl?: unknown;
    screenshots?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // ---- validate + normalise ----
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'A message is required.' }, { status: 400 });
  }

  const category = body.category === 'feature' ? 'feature' : 'bug';
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 2048) : '';

  const screenshots = (Array.isArray(body.screenshots) ? body.screenshots : [])
    .filter((s): s is string => typeof s === 'string' && /^data:[^;]+;base64,/.test(s))
    .slice(0, MAX_SCREENSHOTS);

  // Defensive size guard: reject an oversized payload rather than blow up email.
  const payloadSize = message.length + pageUrl.length + screenshots.reduce((n, s) => n + s.length, 0);
  if (payloadSize > MAX_PAYLOAD_CHARS) {
    return NextResponse.json(
      { error: 'Attachments are too large. Please remove some screenshots and try again.' },
      { status: 413 },
    );
  }

  // ---- auth ----
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Profile lookup for org scoping (best-effort — feedback still sends without it).
  let orgId: string | null = null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle<{ org_id: string | null }>();
    orgId = profile?.org_id ?? null;
  } catch (err) {
    console.warn('feedback: profile lookup failed', err);
  }

  const email = user.email ?? '';

  // ---- best-effort DB log (tolerate the table not existing yet) ----
  let rowInserted = false;
  try {
    const { error } = await supabase.from('feedback').insert({
      org_id: orgId,
      user_id: user.id,
      email,
      category,
      message,
      page_url: pageUrl || null,
      screenshots,
    });
    if (error) {
      console.warn('feedback: row insert failed (continuing to email)', error.message);
    } else {
      rowInserted = true;
    }
  } catch (err) {
    console.warn('feedback: row insert threw (continuing to email)', err);
  }

  // ---- email Joshua a copy (with screenshots attached) ----
  let emailSent = false;
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    await resend.emails.send({
      from: 'Vyso Feedback <noreply@vyso.co.za>',
      to: RECIPIENT,
      subject: `[Vyso ${category}] from ${email || user.id}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; color: #111;">
          <h2 style="margin-bottom: 4px;">New in-app ${category === 'feature' ? 'feature request' : 'bug report'}</h2>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>From:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email || '(unknown)')}</a></p>
          <p><strong>Org id:</strong> ${escapeHtml(orgId ?? '(none)')}</p>
          <p><strong>Page:</strong> ${pageUrl ? `<a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>` : '(none)'}</p>
          <p style="margin-top: 16px;"><strong>Message:</strong></p>
          <blockquote style="border-left: 3px solid #3E7BC4; padding-left: 12px; color: #374151; margin: 8px 0;">
            ${escapeHtml(message).replace(/\n/g, '<br>')}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 13px;">
            ${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'} attached${
              rowInserted ? '' : ' · row not logged (table missing?)'
            }.
          </p>
        </div>
      `,
      // Resend accepts base64 `content` (the data-URL prefix stripped).
      attachments: screenshots.map((dataUrl, i) => ({
        filename: `screenshot-${i + 1}.jpg`,
        content: dataUrl.replace(/^data:[^;]+;base64,/, ''),
      })),
    });
    emailSent = true;
  } catch (err) {
    console.error('feedback: email send failed', err);
  }

  // Success if we persisted the feedback either way (emailed OR logged the row).
  if (emailSent || rowInserted) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: 'Could not send your feedback right now. Please try again later.' },
    { status: 500 },
  );
}
