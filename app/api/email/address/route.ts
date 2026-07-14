import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import { INGEST_DOMAIN, addressFor, generateLocalPart, isIngestTag } from '@/lib/platform/email-ingest-policy';

/**
 * Mint (or rotate) one of the org's inbound-email addresses — owner/admin only.
 *
 * The random suffix in the local part IS the shared secret that lets mail in, so
 * rotating deactivates the old address rather than editing it. The org always comes
 * from the caller's verified profiles row.
 *
 * There are two addresses, and they are INDEPENDENT secrets:
 *
 *   'documents' — handed to every supplier who forwards invoices. Widely distributed
 *                 in practice, and gated by an allowlist + SPF/DKIM alignment.
 *   'quotes'    — pasted into a website form vendor's config and carried in the To:
 *                 header of every enquiry, so it leaks by design. No allowlist.
 *
 * They must be separate local parts. Deriving one from the other would mean that
 * publishing the enquiry address hands out the invoice address, and that rotating
 * either one silently blackholes the other — suppliers would keep mailing a dead
 * token and their invoices would vanish with no error anywhere.
 *
 * Body: { purpose?: 'documents' | 'quotes', rotate?: boolean }.
 */
export async function POST(req: Request) {
  if (!INGEST_DOMAIN) {
    return NextResponse.json({ error: 'EMAIL_INGEST_DOMAIN is not set.' }, { status: 503 });
  }

  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string }>();
  if (!profile?.org_id || (profile.role !== 'owner' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Only an owner or admin can do this.' }, { status: 403 });
  }
  const orgId = profile.org_id;

  const body = (await req.json().catch(() => ({}))) as { rotate?: unknown; purpose?: unknown };
  const rotate = body.rotate === true;

  // Absent purpose defaults to 'documents' (older clients post { rotate: true }); a
  // PRESENT but invalid purpose is a 400, not a silent coercion — otherwise a typo'd
  // rotate ({ purpose: 'quote', rotate: true }) would destructively rotate the DOCUMENT
  // address and blackhole every supplier still mailing the old one.
  if (body.purpose !== undefined && !isIngestTag(body.purpose)) {
    return NextResponse.json({ error: 'Invalid purpose.' }, { status: 400 });
  }
  const purpose = isIngestTag(body.purpose) ? body.purpose : 'documents';

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const { data: current } = await supabase
    .from('email_ingest_addresses')
    .select('local_part')
    .eq('org_id', orgId)
    .eq('purpose', purpose)
    .eq('active', true)
    .maybeSingle();

  if (current && !rotate) {
    const localPart = (current as { local_part: string }).local_part;
    return NextResponse.json({ ok: true, purpose, address: addressFor(localPart) });
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .maybeSingle();
  const slug = (org as { slug: string | null } | null)?.slug ?? 'org';

  // Retire the old address for THIS purpose only — the unique index allows one active
  // per (org, purpose), and rotating the enquiry address must not touch the one your
  // suppliers are emailing invoices to.
  if (current) {
    await supabase
      .from('email_ingest_addresses')
      .update({ active: false })
      .eq('org_id', orgId)
      .eq('purpose', purpose)
      .eq('active', true);
  }

  // The local part must be globally unique; a collision is astronomically unlikely
  // but retry rather than hand back an error.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const localPart = generateLocalPart(purpose === 'quotes' ? `${slug}-enq` : slug);
    const { error } = await supabase
      .from('email_ingest_addresses')
      .insert({ org_id: orgId, local_part: localPart, purpose, active: true });
    if (!error) {
      return NextResponse.json({
        ok: true,
        purpose,
        address: addressFor(localPart),
        rotated: Boolean(current),
      });
    }
    if (!isUniqueViolation(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // A unique violation is not necessarily the (astronomically rare) local_part
    // collision this loop retries for — it's far more likely the (org_id, purpose)
    // where-active index, meaning a concurrent request already created the address. Don't
    // spin five times and 500; hand back the row that now exists.
    const { data: won } = await supabase
      .from('email_ingest_addresses')
      .select('local_part')
      .eq('org_id', orgId)
      .eq('purpose', purpose)
      .eq('active', true)
      .maybeSingle();
    if (won) {
      return NextResponse.json({ ok: true, purpose, address: addressFor((won as { local_part: string }).local_part) });
    }
  }

  return NextResponse.json({ error: 'Could not generate an address.' }, { status: 500 });
}
