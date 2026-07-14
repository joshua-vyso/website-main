import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ingestDocument } from '@/lib/platform/document-ingest';
import {
  INGEST_DOMAIN,
  MAX_ATTACHMENT_BYTES,
  localPartForIngestDomain,
  parseEmailAddress,
  passesSenderAuth,
  selectIngestableAttachments,
  type AttachmentLite,
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

export const emailIngestConfigured = Boolean(
  INGEST_DOMAIN && process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET,
);

/**
 * Resolve the org from the recipients — the ONLY trusted routing signal. Returns
 * the first recipient that matches an active ingest address.
 */
export async function resolveOrgFromRecipients(
  supabase: SupabaseClient,
  recipients: string[],
): Promise<{ orgId: string; toAddress: string } | null> {
  for (const raw of recipients) {
    const address = parseEmailAddress(raw);
    if (!address) continue;
    const localPart = localPartForIngestDomain(address);
    if (!localPart) continue;
    const { data } = await supabase
      .from('email_ingest_addresses')
      .select('org_id')
      .eq('local_part', localPart)
      .eq('active', true)
      .maybeSingle();
    const orgId = (data as { org_id: string } | null)?.org_id;
    if (orgId) return { orgId, toAddress: address };
  }
  return null;
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
 * Process one queued email: fetch it from Resend, verify the sender is authentic,
 * turn each ingestable attachment into a document, and close the row out.
 *
 * Safe to run twice. It claims the row with a compare-and-swap (so the webhook's
 * after() and the cron can't both work it), and records each attachment as it lands
 * (so a timeout partway through doesn't re-file what already succeeded).
 */
export async function processEmailIngest(supabase: SupabaseClient, ingestId: string): Promise<void> {
  const { data: row } = await supabase
    .from('email_ingests')
    .select('id, org_id, resend_email_id, status, attempts, documents_created, processed_attachment_ids')
    .eq('id', ingestId)
    .maybeSingle();
  const ingest = row as
    | {
        id: string;
        org_id: string;
        resend_email_id: string;
        status: string;
        attempts: number;
        documents_created: number;
        processed_attachment_ids: string[] | null;
      }
    | null;
  if (!ingest) return;
  if (ingest.status !== 'queued' && ingest.status !== 'processing') return;

  const orgId = ingest.org_id;

  // CLAIM it: only the caller that flips the row off the exact values we just read
  // gets to run. Otherwise the webhook's after() and the cron can both grab the same
  // email and ingest it twice.
  const { data: claimed } = await supabase
    .from('email_ingests')
    .update({ status: 'processing', attempts: (ingest.attempts ?? 0) + 1 })
    .eq('id', ingest.id)
    .eq('status', ingest.status)
    .eq('attempts', ingest.attempts ?? 0)
    .select('id')
    .maybeSingle();
  if (!claimed) return; // someone else is already on it

  const fail = async (error: string, status: 'failed' | 'quarantined' | 'ignored' = 'failed') => {
    await supabase
      .from('email_ingests')
      .update({ status, error: error.slice(0, 500), processed_at: new Date().toISOString() })
      .eq('id', ingest.id);
  };

  // Attachments already filed on an earlier attempt — re-filing them would duplicate
  // invoices, and the AI step is slow enough that a run really can die halfway.
  const alreadyDone = new Set(ingest.processed_attachment_ids ?? []);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Full message — gives us the headers (SPF/DKIM) and the subject.
    const { data: email, error: getErr } = await resend.emails.receiving.get(ingest.resend_email_id);
    if (getErr || !email) {
      await fail(getErr?.message ?? 'Could not fetch the email from Resend.');
      return;
    }

    // From: is spoofable — the allowlist only means something if the mail is
    // authentic AND the domain that passed matches who it claims to be from.
    const fromEmail = parseEmailAddress(email.from) ?? '';
    if (!passesSenderAuth(email.headers, fromEmail)) {
      await fail('Rejected: the email did not pass SPF/DKIM for the sender it claims to be from.', 'quarantined');
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
  } catch (err) {
    await fail(err instanceof Error ? err.message : 'Processing failed.');
  }
}
