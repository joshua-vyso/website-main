import { NextResponse, after } from 'next/server';
import { Resend } from 'resend';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  emailIngestConfigured,
  processEmailIngest,
  recordPendingSender,
  resolveOrgFromRecipients,
  senderStatus,
} from '@/lib/platform/email-ingest';
import { parseEmailAddress } from '@/lib/platform/email-ingest-policy';

// after() runs the AI ingest post-response, inside this budget.
export const maxDuration = 300;

/**
 * Resend inbound webhook — a forwarded email arrives here.
 *
 * The flow, in the order that matters for safety:
 *   1. Verify the Resend signature. Nothing else runs on an unsigned request.
 *   2. Resolve the org from the SECRET TOKEN in the recipient address — never from
 *      From/Subject/body, which the sender controls.
 *   3. Write the (org_id, message_id) row BEFORE any work. This is the idempotency
 *      guard: Resend retries webhooks, and a retry must not re-invoice an order.
 *   4. Gate on the sender allowlist. Unknown senders are quarantined for approval.
 *   5. Return 200 immediately and do the slow AI ingest in after().
 *
 * Returns 200 for mail we intentionally drop (unknown address, unapproved sender)
 * so Resend doesn't retry it, and 5xx only when we failed to record it — in which
 * case a retry is exactly what we want.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  const apiKey = process.env.RESEND_API_KEY ?? '';
  if (!emailIngestConfigured || !webhookSecret || !apiKey) {
    return NextResponse.json({ error: 'Email ingestion is not configured.' }, { status: 503 });
  }

  const raw = await req.text();

  // 1. Signature. Resend signs with svix headers; a request missing any of them is
  //    unsigned by definition, so reject before verify() rather than passing ''.
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // verify() throws on a bad, replayed or expired signature.
  const resend = new Resend(apiKey);
  let event;
  try {
    event = resend.webhooks.verify({
      payload: raw,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Storage is not configured.' }, { status: 503 });
  }

  const data = event.data as {
    email_id: string;
    from: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    received_for?: string[];
    message_id: string;
    subject?: string;
    attachments?: unknown[];
  };

  // 2. Org comes from the recipient token ONLY. Check every envelope field the
  //    address could land in (a client may BCC the ingest address).
  const recipients = [
    ...(data.received_for ?? []),
    ...(data.to ?? []),
    ...(data.cc ?? []),
    ...(data.bcc ?? []),
  ];
  const match = await resolveOrgFromRecipients(supabase, recipients);
  if (!match) {
    // Unknown address — 200 so Resend stops retrying, and we don't confirm to a
    // prober whether any given address exists.
    return NextResponse.json({ ok: true, ignored: 'unknown-address' });
  }
  const { orgId, toAddress } = match;

  const fromEmail = parseEmailAddress(data.from);
  if (!fromEmail) {
    return NextResponse.json({ ok: true, ignored: 'unparseable-sender' });
  }

  // 4. Sender policy (decided before we insert, so the row records the outcome).
  const sender = await senderStatus(supabase, orgId, fromEmail);
  const status =
    sender === 'approved' ? 'queued' : sender === 'blocked' ? 'ignored' : 'quarantined';

  // 3. Record it BEFORE doing any work — unique (org_id, message_id) makes a
  //    Resend retry a no-op instead of a second set of invoices.
  //
  //    Message-ID is set by the SENDER and is therefore optional in practice. A null
  //    would defeat the unique index outright (Postgres treats NULLs as distinct), so
  //    every retry would insert a fresh row and re-ingest the mail. Fall back to
  //    Resend's own email_id, which is always present and unique per email.
  const messageId =
    typeof data.message_id === 'string' && data.message_id.trim() ? data.message_id.trim() : data.email_id;

  const { data: inserted, error: insErr } = await supabase
    .from('email_ingests')
    .insert({
      org_id: orgId,
      resend_email_id: data.email_id,
      message_id: messageId,
      from_email: fromEmail,
      to_address: toAddress,
      subject: typeof data.subject === 'string' ? data.subject.slice(0, 500) : null,
      status,
      attachments_total: Array.isArray(data.attachments) ? data.attachments.length : 0,
      ...(sender === 'blocked' ? { error: 'Sender is blocked.' } : {}),
      ...(status === 'quarantined' ? { error: 'Sender is not approved yet.' } : {}),
    })
    .select('id')
    .single();

  if (insErr) {
    // Already recorded → this is a retry of an email we've seen. Nothing to do.
    if (isUniqueViolation(insErr)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // We failed to record it — let Resend retry.
    return NextResponse.json({ error: 'Could not record the email.' }, { status: 500 });
  }

  const ingestId = (inserted as { id: string }).id;

  // Surface an unknown sender in Settings so it can be approved in one click.
  if (sender === 'unknown') {
    await recordPendingSender(supabase, orgId, fromEmail).catch(() => {});
  }

  // 5. Approved mail: respond now, ingest after the response.
  if (status === 'queued') {
    after(async () => {
      const client = createServiceSupabase();
      if (client) await processEmailIngest(client, ingestId);
    });
  }

  return NextResponse.json({ ok: true, id: ingestId, status });
}
