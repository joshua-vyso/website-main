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

/**
 * The two intake lanes.
 *
 *   'documents' — invoices, delivery notes, statements. Becomes financial records
 *                 with no human in the loop, so the sender must be allowlisted AND
 *                 pass SPF/DKIM aligned to their From domain.
 *   'quotes'    — website enquiries. No allowlist (a public form is strangers by
 *                 definition); rate-capped, and only ever produces a triage row.
 *
 * Each lane has its OWN secret local part, stored with its purpose. The lane is then
 * whatever the matched address row says it is — never anything from the mail itself,
 * since From/Subject/body are all attacker-controlled and a sender must not be able to
 * choose which trust model they're judged under.
 *
 * The lanes are two separate secrets on purpose. They leak differently: the document
 * address is handed to every supplier who forwards mail, and the quotes address is
 * pasted into a website form vendor's config and rides in the To: header of every
 * enquiry. Deriving one from the other (a "+quotes" tag on the same token, say) would
 * mean leaking either one hands over both, and rotating either one silently blackholes
 * the other.
 */
export type IngestTag = 'documents' | 'quotes';

export function isIngestTag(value: unknown): value is IngestTag {
  return value === 'documents' || value === 'quotes';
}

/**
 * The local part to look up for an address on our ingest domain, or null if the address
 * isn't ours.
 *
 * A `+tag` suffix is stripped before the lookup — mail clients and forwarding rules add
 * them freely, and an invoice sent to `token+jan@…` must still find the mailbox. It has
 * NO routing meaning: the lane comes from the address row we find, not from the tag.
 */
export function localPartForIngestDomain(address: string): string | null {
  if (!INGEST_DOMAIN) return null;
  const [local, domain] = address.split('@');
  if (!local || !domain) return null;
  if (domain.toLowerCase() !== INGEST_DOMAIN) return null;

  const lower = local.toLowerCase();
  const plus = lower.indexOf('+');
  const base = plus === -1 ? lower : lower.slice(0, plus);
  return base || null;
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
 * Pull Authentication-Results out of the header map Resend returns.
 *
 * Resend's GET /emails/receiving/:id returns a CURATED SUBSET of headers (from,
 * return-path, mime-version, ...) and in practice does not include
 * Authentication-Results — which is why the auth check must also be able to read the
 * raw MIME. Returns null when it isn't there.
 */
export function authResultsFromHeaders(headers: Record<string, string> | null): string | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'authentication-results');
  return key ? (headers[key] ?? null) : null;
}

/**
 * Pull Authentication-Results out of a raw RFC-5322 message.
 *
 * ONLY THE TOPMOST ONE. Headers are prepended, so the first Authentication-Results
 * is the one our receiving MTA stamped; any below it came in with the message and a
 * sender can forge those at will. Trusting all of them would let an attacker ship
 * their own "dkim=pass header.d=yourdomain" and have it counted as evidence.
 */
export function authResultsFromRawMime(raw: string): string | null {
  if (!raw) return null;
  // Headers end at the first blank line. Split on either line ending.
  const end = raw.search(/\r?\n\r?\n/);
  const headerBlock = end === -1 ? raw : raw.slice(0, end);
  // Unfold: a header value continued on the next line starts with whitespace.
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, ' ');
  const line = unfolded.split(/\r?\n/).find((l) => /^authentication-results\s*:/i.test(l));
  return line ? line.replace(/^[^:]*:\s*/, '') : null;
}

/** Methods an Authentication-Results header can report on (RFC 8601). */
const AUTH_METHODS = new Set(['spf', 'dkim', 'dmarc', 'arc', 'iprev', 'auth', 'sender-id', 'dkim-adsp']);

interface AuthResult {
  method: string;
  result: string;
  props: Record<string, string>;
}

/**
 * Parse an Authentication-Results header into its method results.
 *
 * Written as a real parser rather than a regex because the header's layout varies by
 * provider and regexes get it wrong in ways that fail *open* or *closed* silently:
 *
 *   Gmail:  dkim=pass header.d=vyso.co.za; spf=pass smtp.mailfrom=vyso.co.za
 *   SES:    spf=pass (spfCheck: ...) client-ip=1.2.3.4; envelope-from=a@vyso.co.za;
 *           helo=mail.google.com; dkim=pass header.i=@vyso.co.za
 *
 * Note SES splits one result's properties across several ';' segments and identifies
 * the DKIM domain with `header.i=@domain` rather than `header.d=`. So we walk tokens,
 * start a new result whenever we see a known method, and attach any later properties
 * to it — regardless of which segment they landed in.
 */
export function parseAuthResults(header: string): AuthResult[] {
  // Comments are free text and can contain '=' and ':'; drop them before tokenising.
  const cleaned = header.replace(/\([^)]*\)/g, ' ');
  const out: AuthResult[] = [];
  let current: AuthResult | null = null;

  for (const token of cleaned.split(/[;\s]+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue; // authserv-id, version, or noise
    const key = token.slice(0, eq).toLowerCase();
    const value = token.slice(eq + 1).toLowerCase().replace(/^"|"$/g, '');
    if (!value) continue;
    if (AUTH_METHODS.has(key)) {
      current = { method: key, result: value, props: {} };
      out.push(current);
    } else if (current) {
      current.props[key] = value;
    }
  }
  return out;
}

/** "joshua@vyso.co.za" / "@vyso.co.za" / "vyso.co.za" → "vyso.co.za". */
function domainOf(value: string): string {
  const at = value.lastIndexOf('@');
  return (at === -1 ? value : value.slice(at + 1)).replace(/^\.+|\.+$/g, '').toLowerCase();
}

/**
 * Do these Authentication-Results actually prove the mail came from who it claims to?
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
 * Fails CLOSED: no results, no trust.
 */
export function passesSenderAuth(authResults: string | null, fromEmail: string): boolean {
  if (!authResults) return false;

  const fromDomain = fromEmail.split('@')[1]?.trim().toLowerCase() ?? '';
  if (!fromDomain) return false;

  for (const r of parseAuthResults(authResults)) {
    if (r.result !== 'pass') continue;

    // DMARC pass is the strongest signal there is: it already means "authenticated
    // AND aligned to the From domain", which is exactly the question we're asking.
    if (r.method === 'dmarc') {
      const d = r.props['header.from'];
      if (d && domainsAlign(domainOf(d), fromDomain)) return true;
    }

    // DKIM survives forwarding, so it's the one that usually carries a forwarded
    // invoice. Gmail reports header.d=, SES reports header.i=@domain.
    if (r.method === 'dkim') {
      const d = r.props['header.d'] ?? r.props['header.i'];
      if (d && domainsAlign(domainOf(d), fromDomain)) return true;
    }

    // SPF authenticates the envelope sender, which forwarding often rewrites — but
    // when it does align, it's proof.
    if (r.method === 'spf') {
      const d = r.props['smtp.mailfrom'] ?? r.props['envelope-from'];
      if (d && domainsAlign(domainOf(d), fromDomain)) return true;
    }
  }
  return false;
}

/**
 * Best-effort HTML → text, for contact-form mail that has no plain-text part.
 *
 * This is NOT a sanitiser and its output is never rendered as HTML — it exists only
 * to give the extractor readable prose instead of markup. Script and style bodies are
 * dropped outright rather than flattened, because their contents are not text the
 * enquirer wrote and would otherwise land in the extracted message.
 */
export function htmlToText(html: string): string {
  return html
    // Match to the closing tag OR to end-of-input: an unterminated <script>/<style>
    // would otherwise fall through to the generic tag-stripper and dump its body into the
    // "message" as if the enquirer had typed it. Safe here because that body is never
    // prose the enquirer wrote.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    // <title> is chrome, not the enquiry — drop it (with the end-of-input fallback, since
    // its content is never the message either).
    .replace(/<title\b[^>]*>[\s\S]*?(?:<\/title\s*>|$)/gi, ' ')
    // <head> WITHOUT an end-of-input fallback: a mangled, unterminated <head> must not eat
    // the whole body and drop the enquiry. A missing </head> degrades to "body survives".
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, ' ')
    // Hidden preheader blocks (display:none / visibility:hidden / zero-size) are standard
    // in HTML email and their text is invisible to a human reading the source — dropping
    // the whole subtree keeps attacker text that appears ONLY in Vyso out of the lead.
    .replace(
      /<(\w+)\b[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|(?:max-)?height\s*:\s*0|font-size\s*:\s*0|opacity\s*:\s*0)[^"']*["'][^>]*>[\s\S]*?<\/\1\s*>/gi,
      ' ',
    )
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
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
