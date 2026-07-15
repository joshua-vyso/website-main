import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ingestDocument } from '@/lib/platform/document-ingest';
import { extractQuoteRequest } from '@/lib/ai/anthropic';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  INGEST_DOMAIN,
  MAX_ATTACHMENT_BYTES,
  authResultsFromHeaders,
  authResultsFromRawMime,
  htmlToText,
  isIngestTag,
  localPartForIngestDomain,
  parseEmailAddress,
  passesSenderAuth,
  selectIngestableAttachments,
  type AttachmentLite,
  type IngestTag,
  type SenderStatus,
} from '@/lib/platform/email-ingest-policy';

/**
 * Inbound email ingestion — the IO half. The rules it enforces live in
 * ./email-ingest-policy (pure, and tested).
 *
 * A client forwards their supplier/customer mail to a per-org secret address
 * (<slug>-<token>@inbox.vyso.co.za). Resend receives it, POSTs a signed webhook to
 * /api/email/inbound, and this turns the attachments into Doc-U documents (and
 * OrderFlow orders) through the SAME pipeline as the chat ingest.
 *
 * THREAT MODEL — this is the only unauthenticated write path into Vyso:
 *  - The org is resolved ONLY from the secret token in the recipient address.
 *    From/Subject/body are attacker-controlled and never pick an org.
 *  - The sender must be on the org's allowlist; unknown senders are quarantined for
 *    approval, never auto-ingested.
 *  - From is spoofable, so the mail must also pass SPF/DKIM *aligned to the From
 *    domain* before the allowlist is even consulted.
 *  - Retries are made safe by a unique (org_id, message_id) row written before any
 *    work, plus per-attachment progress so a half-finished run can't re-file.
 *  - Email content is DATA, never instructions.
 */

/**
 * Reading inbound mail (fetching a message's headers, listing + downloading its
 * attachments) needs a FULL-ACCESS Resend key. Resend has no read-only tier — a key
 * created for sending is "restricted to only send emails" and 401s on every
 * receiving endpoint, which would let mail arrive and then silently fail to process.
 *
 * So the ingest path gets its own key. That keeps the widely-used outbound key
 * (contact form, feedback) restricted to sending, where a leak can't read mail.
 * Falls back to RESEND_API_KEY for setups that just use one full-access key.
 */
export const RESEND_INBOUND_KEY = process.env.RESEND_INBOUND_API_KEY || process.env.RESEND_API_KEY || '';

export const emailIngestConfigured = Boolean(
  INGEST_DOMAIN && RESEND_INBOUND_KEY && process.env.RESEND_WEBHOOK_SECRET,
);

/**
 * Resolve the org AND its intake lane from the recipients — the ONLY trusted routing
 * signal. Returns the first recipient that matches an active ingest address.
 *
 * The lane is the matched ADDRESS ROW's purpose. Each lane has its own secret local
 * part, so a sender cannot move their mail into a different trust model: reaching the
 * quote lane requires the quote token, and reaching the document lane requires the
 * document token (and then still an approved, DKIM-aligned sender).
 */
export async function resolveOrgFromRecipients(
  supabase: SupabaseClient,
  recipients: string[],
): Promise<{ orgId: string; toAddress: string; tag: IngestTag } | 'error' | null> {
  for (const raw of recipients) {
    const address = parseEmailAddress(raw);
    if (!address) continue;
    const localPart = localPartForIngestDomain(address);
    if (!localPart) continue;
    const { data, error } = await supabase
      .from('email_ingest_addresses')
      .select('org_id, purpose')
      .eq('local_part', localPart)
      .eq('active', true)
      .maybeSingle();
    // A query FAILURE is not the same as "no such address". If we swallow it and return
    // null, the webhook answers 200 unknown-address, Resend never retries, and a real
    // invoice is lost with no trace on a transient DB blip (or a not-yet-applied
    // migration). Surface it so the caller can 5xx and let Resend redeliver.
    if (error) return 'error';
    const row = data as { org_id: string; purpose: string | null } | null;
    if (!row?.org_id) continue;
    // An unrecognised purpose falls back to the document lane, which is the STRICTER
    // one. Failing toward "needs an approved sender" is the safe direction.
    return {
      orgId: row.org_id,
      toAddress: address,
      tag: isIngestTag(row.purpose) ? row.purpose : 'documents',
    };
  }
  return null;
}

/**
 * The quote lane deliberately has no sender allowlist — a public contact form is
 * strangers by definition, and authenticating the mail would prove nothing the form
 * itself doesn't already permit. That makes abuse a VOLUME problem, so volume is what
 * we cap.
 */
export const QUOTE_REQUESTS_PER_DAY = 100;

/**
 * Has this org taken more quote-lane mail than the cap allows in the last 24h?
 *
 * Counted AFTER the row for the current email is inserted, so the count includes it.
 * Checking before inserting was a time-of-check/time-of-use hole: Resend delivers in
 * parallel and the webhook scales out, so a burst of emails could all read the same
 * pre-insert count, all pass, and all be queued — the cap would be enforced against a
 * number that was already stale.
 *
 * Fails CLOSED. If the count query itself errors — which is exactly what happens when
 * the database is under the load the cap exists to shed — the previous version
 * returned 0 and silently disabled the limit. A rate limiter that turns itself off
 * under pressure is not a rate limiter.
 */
export async function quoteCapExceeded(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Excludes 'ignored'. Over-cap mail is recorded as 'ignored' and consumes no AI call,
  // so counting it would let a slow junk drip (≈101/day) pin the count over the cap
  // forever and wedge the lane — every genuine enquiry thereafter dropped, with the
  // table never draining. Counting only mail that actually got queued/processed bounds
  // AI spend to ~cap per window AND lets the lane self-heal 24h after a burst.
  //
  // A bounded existence check, not an exact COUNT: stop at cap+1 rows so the query cost
  // can't grow with the size of a flood (an exact count over an unbounded window is
  // O(N) per email → O(N²) under attack, on the same DB the document lane shares).
  const { data, error } = await supabase
    .from('email_ingests')
    .select('id')
    .eq('org_id', orgId)
    .eq('tag', 'quotes')
    .neq('status', 'ignored')
    .gte('created_at', since)
    .limit(QUOTE_REQUESTS_PER_DAY + 1);

  // Fails CLOSED: a query error — exactly what happens when the DB is under the load the
  // cap exists to shed — must not silently disable the limit.
  if (error || !data) return true;
  return data.length > QUOTE_REQUESTS_PER_DAY;
}

/**
 * Where this sender stands with the org.
 *
 * Matched with eq(), NOT ilike(): `%` and `_` are legal in an email local part and
 * are wildcards to ilike, so a From of `%@client.com` would otherwise wildcard-match
 * a genuinely approved sender and let itself in. Addresses are stored lowercased.
 */
export async function senderStatus(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
): Promise<SenderStatus> {
  const { data } = await supabase
    .from('email_ingest_senders')
    .select('status')
    .eq('org_id', orgId)
    .eq('email', email)
    .maybeSingle();
  const status = (data as { status: string } | null)?.status;
  if (status === 'approved' || status === 'pending' || status === 'blocked') return status;
  return 'unknown';
}

/**
 * Record an unknown sender as pending so it surfaces in Settings for one-click
 * approval. Best-effort: a race just means the row already exists.
 */
export async function recordPendingSender(supabase: SupabaseClient, orgId: string, email: string): Promise<void> {
  await supabase.from('email_ingest_senders').insert({ org_id: orgId, email, status: 'pending' });
}

/**
 * A 'processing' row is considered abandoned after this long, and only then may another
 * worker re-claim it.
 *
 * This MUST stay larger than every route's maxDuration (all 300s / 5min). A worker that
 * is still alive holds a claimed_at younger than this, so it can never be re-claimed out
 * from under itself; a row older than this is one whose worker was actually killed, so
 * re-claiming it is safe and there is no live writer left to clobber the winner. Keep
 * this invariant if either number ever changes.
 */
export const STALE_PROCESSING_MS = 10 * 60 * 1000;

interface IngestRow {
  id: string;
  org_id: string;
  resend_email_id: string;
  status: string;
  attempts: number;
  documents_created: number;
  processed_attachment_ids: string[] | null;
  tag: string | null;
  created_at: string;
}

type FailFn = (error: string, status?: 'failed' | 'quarantined' | 'ignored') => Promise<void>;

/** What Resend's GET /emails/receiving/:id gives us back. */
type ReceivedEmail = Awaited<ReturnType<Resend['emails']['receiving']['get']>>['data'];

/**
 * Find the Authentication-Results the receiving MTA stamped on this email.
 *
 * Resend's header map is a curated subset and in practice omits Authentication-Results,
 * so this falls back to the RAW message, which is where it actually lives.
 */
async function resolveSenderAuth(
  email: NonNullable<ReceivedEmail>,
): Promise<{ authResults: string | null; source: string }> {
  const fromHeaders = authResultsFromHeaders(email.headers);
  if (fromHeaders) return { authResults: fromHeaders, source: 'headers' };

  if (email.raw?.download_url) {
    try {
      const res = await fetch(email.raw.download_url);
      if (res.ok) {
        const authResults = authResultsFromRawMime(await res.text());
        if (authResults) return { authResults, source: 'raw' };
      }
    } catch {
      /* fall through — the caller reports what we found (or didn't) */
    }
  }
  return { authResults: null, source: 'none' };
}

/**
 * Process one queued email. Two lanes, chosen by the PURPOSE of the address it arrived
 * at (recorded on the row as `tag`), never by its content:
 *
 *   'documents' — invoices and delivery notes. The sender must be on the allowlist AND
 *                 pass SPF/DKIM aligned to their From domain, because these become
 *                 financial records with no human in the loop.
 *   'quotes'    — a website enquiry. No allowlist, no auth gate (see the note on
 *                 QUOTE_REQUESTS_PER_DAY), and it produces a triage row that a human
 *                 must action before anything is priced or linked.
 *
 * Safe to run twice either way. It claims the row with a compare-and-swap (so the
 * webhook's after() and the cron can't both work it) and records progress as it goes.
 */
export async function processEmailIngest(supabase: SupabaseClient, ingestId: string): Promise<void> {
  const { data: row } = await supabase
    .from('email_ingests')
    .select('id, org_id, resend_email_id, status, attempts, documents_created, processed_attachment_ids, tag, created_at')
    .eq('id', ingestId)
    .maybeSingle();
  const ingest = row as IngestRow | null;
  if (!ingest) return;
  if (ingest.status !== 'queued' && ingest.status !== 'processing') return;

  // CLAIM it atomically. The claim's WHERE clause — not the value we happened to read —
  // is the concurrency guard: the UPDATE only lands on a row that is still 'queued', or
  // one that is 'processing' but whose claim has gone STALE. Postgres re-checks that
  // predicate under the row lock, so of two racing workers exactly one matches.
  //
  // The old CAS matched on (status, attempts) read a moment earlier, which let a second
  // caller that read the row AFTER the first worker claimed it (both see processing,
  // attempts=N) match and claim it too — two workers on one email: a doubled AI call, or
  // in the document lane, the same attachments filed twice. Because maxDuration (5min) <
  // STALE_PROCESSING_MS (10min), a still-running worker's row is never stale, so this
  // predicate can't steal a live claim — and a row that IS stale has a dead worker, so
  // there's no one left to clobber.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('email_ingests')
    .update({
      status: 'processing',
      attempts: (ingest.attempts ?? 0) + 1,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', ingest.id)
    .or(`status.eq.queued,and(status.eq.processing,claimed_at.lt.${staleBefore})`)
    .select('id')
    .maybeSingle();

  // A broken UPDATE (e.g. a missing column before the migration is applied) is NOT the
  // same as losing the race: surface it as a retryable failure instead of a silent
  // no-op that would strand every email in the queue with no trace.
  if (claimErr) {
    await supabase
      .from('email_ingests')
      .update({ status: 'failed', error: `Could not claim the email: ${claimErr.message}`.slice(0, 500) })
      .eq('id', ingest.id);
    return;
  }
  if (!claimed) return; // someone else holds a live claim

  const fail: FailFn = async (error, status = 'failed') => {
    await supabase
      .from('email_ingests')
      .update({ status, error: error.slice(0, 500), processed_at: new Date().toISOString() })
      .eq('id', ingest.id);
  };

  try {
    if (ingest.tag === 'quotes') {
      await runQuoteRequest(supabase, ingest, fail);
    } else {
      await runDocumentIngest(supabase, ingest, fail);
    }
  } catch (err) {
    await fail(err instanceof Error ? err.message : 'Processing failed.');
  }
}

/** The document lane — attachments become Doc-U documents (and OrderFlow orders). */
async function runDocumentIngest(supabase: SupabaseClient, ingest: IngestRow, fail: FailFn): Promise<void> {
  const orgId = ingest.org_id;

  // Attachments already filed on an earlier attempt — re-filing them would duplicate
  // invoices, and the AI step is slow enough that a run really can die halfway.
  const alreadyDone = new Set(ingest.processed_attachment_ids ?? []);

  {
    const resend = new Resend(RESEND_INBOUND_KEY);

    // Full message — gives us the headers (SPF/DKIM) and the subject.
    const { data: email, error: getErr } = await resend.emails.receiving.get(ingest.resend_email_id);
    if (getErr || !email) {
      await fail(getErr?.message ?? 'Could not fetch the email from Resend.');
      return;
    }

    // From: is spoofable — the allowlist only means something if the mail is
    // authentic AND the domain that passed matches who it claims to be from.
    const fromEmail = parseEmailAddress(email.from) ?? '';
    const { authResults, source: authSource } = await resolveSenderAuth(email);

    if (!passesSenderAuth(authResults, fromEmail)) {
      // Say precisely WHY, so a rejection is diagnosable instead of a dead end:
      // either we never found the results, or we found them and they didn't align.
      const seen = Object.keys(email.headers ?? {}).join(',') || 'none';
      const detail = authResults
        ? `SPF/DKIM did not pass for ${fromEmail || 'the sender'} (source: ${authSource}): ${authResults.slice(0, 400)}`
        : `no Authentication-Results found (headers seen: ${seen}; raw available: ${Boolean(email.raw?.download_url)})`;
      await fail(`Rejected: ${detail}`, 'quarantined');
      return;
    }

    const { data: attachmentList, error: attErr } = await resend.emails.receiving.attachments.list({
      emailId: ingest.resend_email_id,
    });
    if (attErr) {
      await fail(attErr.message ?? 'Could not list the attachments.');
      return;
    }

    const usable = selectIngestableAttachments((attachmentList?.data ?? []) as AttachmentLite[]);
    if (usable.length === 0) {
      await fail('No PDF or image attachments to ingest.', 'ignored');
      return;
    }

    // The subject is a hint for the order reader — data, never instructions.
    const note = typeof email.subject === 'string' ? email.subject.slice(0, 500) : undefined;

    let created = ingest.documents_created ?? 0;
    const errors: string[] = [];
    for (const att of usable) {
      if (alreadyDone.has(att.id)) continue; // filed on a previous attempt
      try {
        const res = await fetch(att.download_url);
        if (!res.ok) {
          errors.push(`${att.filename ?? 'attachment'}: download failed (${res.status})`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
          errors.push(`${att.filename ?? 'attachment'}: too large`);
          continue;
        }
        const result = await ingestDocument({
          supabase,
          orgId,
          userId: null, // arrived by email — no uploading user
          base64: buf.toString('base64'),
          mediaType: att.content_type,
          filename: (att.filename ?? 'document').slice(0, 200),
          note,
          emailIngestId: ingest.id,
        });
        if (result.ok) {
          created += 1;
          alreadyDone.add(att.id);
          // Record progress per attachment, so a timeout on the NEXT one can't make a
          // retry re-file this one.
          await supabase
            .from('email_ingests')
            .update({ documents_created: created, processed_attachment_ids: [...alreadyDone] })
            .eq('id', ingest.id);
        } else {
          errors.push(`${att.filename ?? 'attachment'}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${att.filename ?? 'attachment'}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    await supabase
      .from('email_ingests')
      .update({
        status: created > 0 ? 'done' : 'failed',
        documents_created: created,
        processed_attachment_ids: [...alreadyDone],
        error: errors.length ? errors.join('; ').slice(0, 500) : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', ingest.id);
  }
}

/**
 * The quote lane — a website contact-form email becomes ONE triage row.
 *
 * Everything the extractor returns here was typed by an anonymous stranger into a
 * public form, so the row records what they CLAIMED and links to nothing. In
 * particular it never resolves to an of_customers row: "Woolworths" in a contact form
 * is a claim, not an identity, and auto-linking it would let anyone on the internet
 * attach themselves to a real customer's record.
 */
async function runQuoteRequest(supabase: SupabaseClient, ingest: IngestRow, fail: FailFn): Promise<void> {
  const done = async () => {
    await supabase
      .from('email_ingests')
      .update({ status: 'done', documents_created: 1, error: null, processed_at: new Date().toISOString() })
      .eq('id', ingest.id);
  };

  // Put the row back in the queue for the daily cron to retry, bounded by the cron's
  // give-up sweep (attempts >= MAX_ATTEMPTS). Used for transient faults where 'failed'
  // would be a dead end — the cron only re-drives 'queued'/stale-'processing', never
  // 'failed'. attempts was already bumped by the claim.
  const requeue = async (why: string) => {
    await supabase
      .from('email_ingests')
      .update({ status: 'queued', error: why.slice(0, 500) })
      .eq('id', ingest.id);
  };

  // Already turned into a lead on an earlier attempt. Check BEFORE doing any work: the
  // unique index on email_ingest_id keeps a retry from duplicating the lead, but it only
  // does so at insert time — by then the Resend fetch and the AI call have already been
  // paid for. The cron re-drives any row that died before its final status write, so
  // this path is hit in normal operation, not just when someone clicks Retry.
  const { data: existing, error: existingErr } = await supabase
    .from('of_quote_requests')
    .select('id')
    .eq('email_ingest_id', ingest.id)
    .maybeSingle();
  // Fail CLOSED: if we can't tell whether a lead already exists, don't barrel into the
  // paid Resend + AI path. The whole point of this check is to NOT re-pay on a retry.
  if (existingErr) {
    await requeue(`Could not check for an existing lead: ${existingErr.message}`);
    return;
  }
  if (existing) {
    await done();
    return;
  }

  const resend = new Resend(RESEND_INBOUND_KEY);

  const { data: email, error: getErr } = await resend.emails.receiving.get(ingest.resend_email_id);
  if (getErr || !email) {
    await fail(getErr?.message ?? 'Could not fetch the email from Resend.');
    return;
  }

  // NOTE: no sender-auth check here, and deliberately not even a display-only one. The
  // raw-MIME fetch it needs is an unbounded download of attacker-controlled bytes, and
  // in this lane the attacker is any stranger — a real cost for a value that could tell
  // us nothing anyway. A passing signature would only prove the WEBSITE's mailer sent
  // the mail; it says nothing about who filled the form in, which is the only question
  // that matters here.
  const fromEmail = parseEmailAddress(email.from) ?? '';
  const subject = typeof email.subject === 'string' ? email.subject : '';

  const body = (email.text?.trim() || (email.html ? htmlToText(email.html) : '')).trim();

  // Read the body if there is one, but NEVER gate on the result. Every quote-lane email
  // becomes a reviewable row and a human decides — the AI's "is this a real enquiry?"
  // judgement is recorded as a spam FLAG, not used to silently drop mail. A blank email
  // still surfaces (flagged), so nothing vanishes without a person seeing it.
  let extraction: Awaited<ReturnType<typeof extractQuoteRequest>> | null = null;
  if (body) {
    extraction = await extractQuoteRequest({ from: email.from ?? '', subject, body });
    // A malformed/truncated response is a transient FAULT, not a verdict — re-queue for
    // the cron rather than guessing. (A terminal status would never be re-driven; the
    // give-up sweep still stops a persistent fault after MAX_ATTEMPTS.)
    if (!extraction.parsed_ok) {
      await requeue('Could not read the enquiry yet (the extractor returned no usable JSON). Will retry.');
      return;
    }
  }

  const { error: insErr } = await supabase.from('of_quote_requests').insert({
    org_id: ingest.org_id,
    source: 'email',
    email_ingest_id: ingest.id,
    from_email: fromEmail || null,
    contact_name: extraction?.contact_name ?? null,
    contact_email: extraction?.contact_email ?? null,
    contact_phone: extraction?.contact_phone ?? null,
    business_name: extraction?.business_name ?? null,
    // Fall back to the subject so a lead is never completely blank in the list.
    message: extraction?.message ?? (subject ? subject.slice(0, 1500) : null),
    requested_items: extraction?.items ?? [],
    // The AI's guess becomes a hint for the human, not a gate: flag a no-body email or
    // one the model judged not-an-enquiry, but keep it in the inbox either way.
    flagged_spam: extraction ? !extraction.is_enquiry : true,
    status: 'new',
    // When the enquiry ARRIVED, not when it was materialised — a cron re-drive can
    // insert the lead days later, and the inbox sorts on this, so the default now()
    // would file an old enquiry above genuinely newer ones.
    received_at: ingest.created_at,
  });

  // Lost a race with a concurrent worker — it recorded the lead, so we're done.
  if (insErr && !isUniqueViolation(insErr)) {
    await fail(insErr.message ?? 'Could not record the enquiry.');
    return;
  }

  await done();
}
