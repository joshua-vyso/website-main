import { NextResponse, after } from 'next/server';
import { Resend } from 'resend';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  QUOTE_REQUESTS_PER_DAY,
  RESEND_INBOUND_KEY,
  emailIngestConfigured,
  processEmailIngest,
  quoteCapExceeded,
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
 *   2. Resolve the org AND the intake lane from the recipient address — never from
 *      From/Subject/body, which the sender controls. Each lane has its OWN secret
 *      address (email_ingest_addresses.purpose); the lane is the matched row's purpose.
 *   3. Write the (org_id, message_id) row BEFORE any work. This is the idempotency
 *      guard: Resend retries webhooks, and a retry must not re-invoice an order.
 *   4. Apply the lane's sender policy — allowlist for documents, rate cap for quotes.
 *   5. Return 200 immediately and do the slow AI ingest in after().
 *
 * Returns 200 for mail we intentionally drop (unknown address, unapproved sender)
 * so Resend doesn't retry it, and 5xx only when we failed to record it — in which
 * case a retry is exactly what we want.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  if (!emailIngestConfigured || !webhookSecret) {
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

  // verify() throws on a bad, replayed or expired signature. This is local HMAC
  // against the webhook secret — it makes no API call, so the key is incidental.
  const resend = new Resend(RESEND_INBOUND_KEY);
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
  if (match === 'error') {
    // The address lookup itself failed (transient DB / not-yet-applied migration). 5xx
    // so Resend REDELIVERS — never a 200, which would drop a real invoice with no trace.
    return NextResponse.json({ error: 'Address lookup failed.' }, { status: 503 });
  }
  if (!match) {
    // Unknown address — 200 so Resend stops retrying, and we don't confirm to a
    // prober whether any given address exists.
    return NextResponse.json({ ok: true, ignored: 'unknown-address' });
  }
  const { orgId, toAddress, tag } = match;

  const fromEmail = parseEmailAddress(data.from);
  if (!fromEmail) {
    return NextResponse.json({ ok: true, ignored: 'unparseable-sender' });
  }

  // 4. Sender policy — and the two lanes deliberately differ here.
  //
  //    DOCUMENTS: the allowlist is the control. These attachments are extracted and
  //    parked in the Doc-U review queue (a human Saves before they touch stock/invoices),
  //    but an unapproved sender's mail shouldn't even reach that queue — so it's quarantined.
  //
  //    QUOTES: no allowlist. The enquiries come from a PUBLIC web form, so demanding
  //    that each stranger be pre-approved would defeat the feature — and an allowlist
  //    would be theatre anyway, since anyone can already type anything into that form.
  //    The real risk is someone flooding the org with junk leads, which is a VOLUME
  //    problem. The cap is applied AFTER the insert below, so it counts this email too
  //    and can't be raced by a burst that all read the same pre-insert total.
  let sender: Awaited<ReturnType<typeof senderStatus>> = 'approved';
  let status: string;
  let reason: string | null = null;

  if (tag === 'quotes') {
    status = 'queued';
  } else {
    sender = await senderStatus(supabase, orgId, fromEmail);
    status = sender === 'approved' ? 'queued' : sender === 'blocked' ? 'ignored' : 'quarantined';
    if (sender === 'blocked') reason = 'Sender is blocked.';
    if (sender === 'unknown' || sender === 'pending') reason = 'Sender is not approved yet.';
  }

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
      tag,
      attachments_total: Array.isArray(data.attachments) ? data.attachments.length : 0,
      ...(reason ? { error: reason } : {}),
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

  // Surface an unknown sender in Settings so it can be approved in one click. Only the
  // document lane has an allowlist, so only it can produce a sender to approve — the
  // quote lane must never ask you to vet every stranger who fills in your contact form.
  if (tag !== 'quotes' && sender === 'unknown') {
    await recordPendingSender(supabase, orgId, fromEmail).catch(() => {});
  }

  // 4b. The quote-lane rate cap, applied now that OUR row is committed and therefore
  //     counted. Checking before the insert was a time-of-check/time-of-use hole: a
  //     burst delivered in parallel would all read the same pre-insert total, all pass,
  //     and all be queued. Counting after means a flood sees itself.
  //
  //     Over the cap we record the email and stop. No AI call is made, so a flood costs
  //     nothing beyond a row.
  if (tag === 'quotes' && (await quoteCapExceeded(supabase, orgId))) {
    // Guard on status='queued' so this only lands on a row nobody has claimed — a cron
    // that grabbed it in the race window owns it, and we must not stomp an in-flight run.
    await supabase
      .from('email_ingests')
      .update({
        status: 'ignored',
        error: `Over the ${QUOTE_REQUESTS_PER_DAY}/day quote-request limit. Rotate the enquiry address in Settings if this is abuse — it is separate from the document address, so suppliers are unaffected.`,
        processed_at: new Date().toISOString(),
      })
      .eq('id', ingestId)
      .eq('status', 'queued');
    return NextResponse.json({ ok: true, id: ingestId, status: 'ignored', reason: 'rate-limited' });
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
