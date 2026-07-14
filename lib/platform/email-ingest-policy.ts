/**
 * Inbound-email POLICY — the rules that decide whether a forwarded email is
 * allowed to become documents, and which of its parts we touch.
 *
 * Deliberately pure and IO-free (no Supabase, no Resend, no `server-only`) so the
 * security-critical decisions here can be exercised directly in tests. The plumbing
 * that acts on these decisions lives in ./email-ingest.
 */

/**
 * Normalise EMAIL_INGEST_DOMAIN to a bare domain.
 *
 * Resend displays its receiving address as a PLACEHOLDER — `anything@abc.resend.app`
 * (sometimes `<anything>@...`) — meaning "any local part works here". It's very easy
 * to paste that whole string into the env var, and we then build addresses as
 * `${localPart}@${INGEST_DOMAIN}` and emit `org-token@<anything>@abc.resend.app`,
 * which every mail client rejects as malformed. Keep only the part after the last
 * '@' and strip the angle brackets, so a pasted placeholder still yields a working
 * domain instead of a silently broken address.
 */
function normaliseIngestDomain(raw: string): string {
  let domain = (raw ?? '').trim().toLowerCase().replace(/[<>\s]/g, '');
  const at = domain.lastIndexOf('@');
  if (at !== -1) domain = domain.slice(at + 1);
  return domain.replace(/^\.+/, '').replace(/[./]+$/, '');
}

/** The subdomain whose MX points at Resend, e.g. "inbox.vyso.co.za". */
export const INGEST_DOMAIN = normaliseIngestDomain(process.env.EMAIL_INGEST_DOMAIN ?? '');

/** Only these become documents. Anything else in the email is ignored. */
const ALLOWED_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|gif|heic|bmp))$/i;
/** ~13MB decoded — matches the chat ingest ceiling. */
export const MAX_ATTACHMENT_BYTES = 13 * 1024 * 1024;
/** Don't let one email fan out into an unbounded number of AI calls. */
const MAX_ATTACHMENTS_PER_EMAIL = 10;

export type SenderStatus = 'approved' | 'pending' | 'blocked' | 'unknown';

/** Pull the bare address out of `"Name" <a@b.com>` / `a@b.com`. Lowercased. */
export function parseEmailAddress(raw: string): string | null {
  if (!raw) return null;
  const angled = raw.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

/** The address's local part, if it belongs to our ingest domain. */
export function localPartForIngestDomain(address: string): string | null {
  if (!INGEST_DOMAIN) return null;
  const [local, domain] = address.split('@');
  if (!local || !domain) return null;
  return domain.toLowerCase() === INGEST_DOMAIN ? local.toLowerCase() : null;
}

/** A fresh secret local part for an org, e.g. "morco-3f9a2c7b41d8". */
export function generateLocalPart(slug: string): string {
  const base =
    (slug || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'org';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${base}-${token}`;
}

/** Full address for a stored local part. */
export function addressFor(localPart: string): string {
  return `${localPart}@${INGEST_DOMAIN}`;
}

/** "mail.acme.co.za" and "acme.co.za" are the same organisation; "evil.com" is not. */
function domainsAlign(authDomain: string, fromDomain: string): boolean {
  if (!authDomain || !fromDomain) return false;
  if (authDomain === fromDomain) return true;
  return authDomain.endsWith(`.${fromDomain}`) || fromDomain.endsWith(`.${authDomain}`);
}

/**
 * Did the mail actually come from who it claims to?
 *
 * From: is trivially spoofable, so the sender allowlist only means something if we
 * check it against an AUTHENTICATED identity. We require SPF or DKIM to pass AND the
 * domain that passed to ALIGN with the From domain.
 *
 * Alignment is the whole point. "Did anything pass?" is not a check: an attacker can
 * always obtain dkim=pass for a domain they own, so they would sign as evil.com,
 * forge `From: finance@client.com`, and walk straight through the allowlist. We
 * compare the passing header.d= / smtp.mailfrom= domain against the From domain.
 *
 * Either signal suffices because forwarding routinely breaks SPF while leaving DKIM
 * intact — and forwarding is precisely what this feature is built on.
 *
 * Fails CLOSED: no Authentication-Results header, no trust.
 */
export function passesSenderAuth(headers: Record<string, string> | null, fromEmail: string): boolean {
  if (!headers) return false;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'authentication-results');
  if (!key) return false;
  const results = (headers[key] ?? '').toLowerCase();

  const fromDomain = fromEmail.split('@')[1]?.trim().toLowerCase() ?? '';
  if (!fromDomain) return false;

  // dkim=pass ... header.d=acme.co.za
  for (const m of results.matchAll(/dkim=pass[^;]*?header\.d=([a-z0-9.-]+)/g)) {
    if (domainsAlign(m[1], fromDomain)) return true;
  }
  // spf=pass ... smtp.mailfrom=user@acme.co.za (or envelope-from, or a bare domain)
  for (const m of results.matchAll(
    /spf=pass[^;]*?(?:smtp\.mailfrom|envelope-from)=(?:[^@\s;]*@)?([a-z0-9.-]+)/g,
  )) {
    if (domainsAlign(m[1], fromDomain)) return true;
  }
  return false;
}

export interface AttachmentLite {
  id: string;
  filename?: string;
  size: number;
  content_type: string;
  content_disposition: 'inline' | 'attachment';
  download_url: string;
}

/** Keep real document attachments; drop inline signature logos and oversized files. */
export function selectIngestableAttachments(attachments: AttachmentLite[]): AttachmentLite[] {
  return attachments
    .filter((a) => ALLOWED_TYPES.test(a.content_type ?? ''))
    // Inline images are almost always the sender's logo/signature. A PDF is never
    // decorative, so keep inline PDFs.
    .filter((a) => a.content_disposition !== 'inline' || /pdf/i.test(a.content_type))
    .filter((a) => a.size > 0 && a.size <= MAX_ATTACHMENT_BYTES)
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);
}
