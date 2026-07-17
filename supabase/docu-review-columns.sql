-- Doc-U review-queue + document-lifecycle columns.
--
-- The review-queue feature (email documents that wait for a human Save/Discard) and
-- the star / AI-summary / archive actions all shipped as CODE that reads and writes
-- these columns, but the migration adding them to `documents` was never written. The
-- result was schema drift: the review query filters on `approved_at`, which did not
-- exist, so every load errored with 42703 and the page silently rendered
-- "Nothing to review" — while Save, Discard, and AI-summary writes failed the same way.
--
-- All idempotent (`add column if not exists`), so this is safe to run on any deployment,
-- and safe to re-run.

-- The review-queue claim/lock: a Save stamps approved_at (while still 'extracted') to
-- claim the row, then flips status to 'approved'. approved_by records who did it.
alter table documents
  add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table documents
  add column if not exists approved_at timestamptz;

-- Discard: status → 'rejected', stamped with who/when.
alter table documents
  add column if not exists reviewed_by uuid references profiles(id) on delete set null;
alter table documents
  add column if not exists reviewed_at timestamptz;

-- Archive action (soft-hide from the active lists).
alter table documents
  add column if not exists archived_at timestamptz;

-- Cached AI operational summary (Doc-U "summary" feature).
alter table documents
  add column if not exists ai_summary jsonb;

-- Star toggle in the inbox.
alter table documents
  add column if not exists starred boolean not null default false;
