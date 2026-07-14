-- ============================================================================
-- Email ingestion — forward a supplier/customer email to a per-org address and
-- Vyso files the attachments into Doc-U (and invoices orders) automatically.
-- ----------------------------------------------------------------------------
-- Mail path: MX on a SUBDOMAIN (e.g. inbox.vyso.co.za) points at Resend, so the
-- Google Workspace mail on vyso.co.za itself is untouched. Resend receives mail
-- for ANY address at that subdomain and POSTs a signed webhook to
-- /api/email/inbound, which resolves the org from the address's secret token.
--
-- Three tables:
--   email_ingest_addresses — the org's secret inbound address (the ONLY thing we
--                            trust to resolve the org; never the From header).
--   email_ingest_senders   — who may send to it. Unknown senders are quarantined
--                            for one-click approval rather than silently ingested.
--   email_ingests          — idempotency key + queue + audit log. Resend RETRIES
--                            failed webhooks, so the unique (org_id, message_id)
--                            index is what stops a retry double-invoicing an order.
--
-- Org-scoped RLS for reading in the app. The webhook itself has no logged-in user
-- and runs on the service-role key (bypassing RLS) — it always filters by the
-- org resolved from the address token.
-- Idempotent. Paste in the Supabase SQL editor.
-- ============================================================================


-- ── The org's inbound address ───────────────────────────────────────────────
create table if not exists email_ingest_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- Local part of the address, e.g. 'morco-7f3k9d2a' → morco-7f3k9d2a@inbox.vyso.co.za
  -- The random suffix is the shared secret: knowing it is what lets mail in.
  local_part text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- The address is the routing key, so it must be globally unique (case-insensitive).
create unique index if not exists email_ingest_addresses_local_part_uidx
  on email_ingest_addresses (lower(local_part));
-- One active address per org (rotate by deactivating the old one).
create unique index if not exists email_ingest_addresses_org_active_uidx
  on email_ingest_addresses (org_id) where active;


-- ── Who may send to it ──────────────────────────────────────────────────────
create table if not exists email_ingest_senders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  email text not null,
  -- approved → auto-ingest | pending → quarantined, awaiting approval | blocked → dropped
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz
);
create unique index if not exists email_ingest_senders_org_email_uidx
  on email_ingest_senders (org_id, lower(email));


-- ── Received emails: idempotency + queue + audit ────────────────────────────
create table if not exists email_ingests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  resend_email_id text not null,
  message_id text not null,
  from_email text not null,
  to_address text,
  subject text,
  -- queued → to process | processing | done | failed | quarantined (sender not
  -- approved) | ignored (nothing ingestable attached)
  status text not null default 'queued',
  attachments_total int not null default 0,
  documents_created int not null default 0,
  attempts int not null default 0,
  -- Resend attachment ids already filed. A run that dies halfway (timeout) is
  -- retried, and without this it would re-file the attachments it already did —
  -- duplicate invoices. Email-level idempotency is not enough on its own.
  processed_attachment_ids text[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
-- Older deployments: add the column if the table already exists.
alter table email_ingests
  add column if not exists processed_attachment_ids text[] not null default '{}';
-- THE idempotency guard: Resend retries webhooks, and without this a retry would
-- ingest the same email twice (duplicate invoices/orders).
create unique index if not exists email_ingests_org_message_uidx
  on email_ingests (org_id, message_id);
-- The worker drains by status.
create index if not exists email_ingests_status_idx
  on email_ingests (status, created_at);


-- ── Trace each filed document back to the email it arrived on ───────────────
alter table documents
  add column if not exists email_ingest_id uuid references email_ingests(id) on delete set null;
create index if not exists documents_email_ingest_idx on documents (email_ingest_id);


-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table email_ingest_addresses enable row level security;
alter table email_ingest_senders   enable row level security;
alter table email_ingests          enable row level security;

-- Everyone in the org can SEE their address / senders / received mail.
drop policy if exists email_ingest_addresses_select on email_ingest_addresses;
create policy email_ingest_addresses_select on email_ingest_addresses for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists email_ingest_senders_select on email_ingest_senders;
create policy email_ingest_senders_select on email_ingest_senders for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists email_ingests_select on email_ingests;
create policy email_ingests_select on email_ingests for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- Only owner/admin may mint an address or approve/block a sender — these are the
-- controls that decide whose mail becomes invoices.
drop policy if exists email_ingest_addresses_write on email_ingest_addresses;
create policy email_ingest_addresses_write on email_ingest_addresses for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists email_ingest_senders_write on email_ingest_senders;
create policy email_ingest_senders_write on email_ingest_senders for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  );

-- NOTE: email_ingests has no user INSERT/UPDATE policy on purpose — only the
-- webhook/worker (service role) writes it. Retries go through /api/email/retry.
