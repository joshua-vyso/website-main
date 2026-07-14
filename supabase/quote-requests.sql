-- ============================================================================
-- QUOTE REQUESTS — enquiries that arrive from a public website contact form.
--
-- Run this whole file in the Supabase SQL editor. Idempotent.
--
-- These are LEADS, not quotes, and the distinction is load-bearing:
--
--   * A quote is a priced document YOU issue, and it burns a QTE- number.
--     A request is a stranger typing into an open form on the internet. If a
--     request were an of_quotes row, ten spam submissions would punch ten holes
--     in your quote numbering, on documents you never sent anyone.
--
--   * EVERY text field below is attacker-controlled. Anyone can type
--     "Woolworths" into a public contact form. So a request records what the
--     sender CLAIMED and links to nothing: customer_id stays null until a human
--     sets it, and quote_id stays null until a human drafts the quote (which is
--     when the number is finally allocated).
-- ============================================================================


-- ── A SECOND, INDEPENDENT ingest address ────────────────────────────────────
--
-- The org now has two inbound addresses with two different trust models, and they
-- MUST be two different secrets:
--
--   purpose='documents' — invoices and delivery notes. You hand this address to
--     every supplier who forwards you mail, so it is "secret" by convention only.
--     Protected by an allowlist + SPF/DKIM alignment, because these attachments
--     become financial records with no human in the loop.
--
--   purpose='quotes' — website enquiries. This one gets pasted into a third-party
--     form vendor's config and rides in the To: header of every enquiry, so it
--     leaks by design. It has NO allowlist (a public form is strangers by
--     definition) and is protected by a rate cap; it can only ever produce a
--     triage row a human must action.
--
-- They must be independently leakable and independently rotatable. Deriving one
-- from the other (e.g. <token>+quotes@) would mean that leaking the enquiry
-- address hands out the invoice address, and that rotating one silently
-- blackholes the other.
alter table email_ingest_addresses
  add column if not exists purpose text not null default 'documents';

-- Was: one active address per org. Now: one active address per org PER PURPOSE.
drop index if exists email_ingest_addresses_org_active_uidx;
create unique index if not exists email_ingest_addresses_org_purpose_active_uidx
  on email_ingest_addresses (org_id, purpose) where active;


-- ── Which lane an inbound email arrived on ──────────────────────────────────
-- Copied from the matched address's purpose at receive time. NULL on rows that
-- predate this migration, which correctly read as the document lane.
alter table email_ingests add column if not exists tag text;

-- The rate cap counts this org's quote-lane mail over a rolling 24h, on every
-- inbound enquiry. Without this it is a sequential scan of the whole table.
create index if not exists email_ingests_org_tag_created_idx
  on email_ingests (org_id, tag, created_at desc);


-- ── The lead inbox ──────────────────────────────────────────────────────────
create table if not exists of_quote_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,

  -- Provenance --------------------------------------------------------------
  source text not null default 'email',
  email_ingest_id uuid references email_ingests(id) on delete set null,
  -- Who sent the MAIL (the website's mailer), not who filled in the form.
  from_email text,

  -- What the enquirer CLAIMED — untrusted free text, never auto-linked --------
  contact_name text,
  contact_email text,
  contact_phone text,
  business_name text,
  message text,
  -- [{ description, quantity, unit }]
  requested_items jsonb not null default '[]'::jsonb,

  -- Triage -------------------------------------------------------------------
  status text not null default 'new',              -- new | quoted | dismissed
  quote_id uuid references of_quotes(id) on delete set null,
  customer_id uuid references of_customers(id) on delete set null,  -- set BY A HUMAN

  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists of_quote_requests_org_status_idx
  on of_quote_requests (org_id, status, received_at desc);

-- One request per ingested email. Resend retries webhooks, the cron re-drives
-- stalled rows and Settings has a Retry button, so without this a single enquiry
-- could become three identical leads.
create unique index if not exists of_quote_requests_ingest_uidx
  on of_quote_requests (email_ingest_id)
  where email_ingest_id is not null;

alter table of_quote_requests enable row level security;

drop policy if exists of_quote_requests_all on of_quote_requests;
create policy of_quote_requests_all on of_quote_requests for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ── Stale-claim detection ───────────────────────────────────────────────────
-- The cron re-drives a 'processing' row it believes was abandoned. It was
-- measuring that against created_at — when the EMAIL ARRIVED — so a row re-queued
-- by the Retry button (which leaves created_at days old) looked stale the instant
-- a worker claimed it, and a second worker could claim it too. In the document
-- lane that means two workers filing the same attachments: duplicate invoices.
-- Staleness must be measured from when the claim was taken.
alter table email_ingests add column if not exists claimed_at timestamptz;

-- Backfill any row already sitting in 'processing' at migration time. Without a
-- claimed_at it would be neither re-driven (the cron's `claimed_at < x` is NULL-not-true
-- for NULLs) nor failed out (attempts never reaches the give-up threshold) — stranded
-- forever. The cron query also treats NULL as stale as a belt-and-braces, but seed a
-- real value so ordering and future writers behave.
update email_ingests
  set claimed_at = coalesce(processed_at, created_at)
  where status = 'processing' and claimed_at is null;
