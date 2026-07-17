-- ============================================================================
-- In-app feedback (bug reports / feature requests)
-- ----------------------------------------------------------------------------
-- Submitted from the Feedback button in the sidebar. Each row is a durable log;
-- Joshua also gets an emailed copy (with screenshots attached) via
-- /api/feedback. Org-scoped RLS. Idempotent. Paste in the Supabase SQL editor.
-- ============================================================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  email text,
  -- bug | feature
  category text not null default 'bug',
  message text not null,
  -- the page the user was on when they submitted
  page_url text,
  -- screenshots as base64 data URLs (bounded + downscaled client-side)
  screenshots text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_created on feedback (created_at desc);

alter table feedback enable row level security;

-- Any authenticated user submits feedback as themselves; they can read back
-- their own submissions. (Review happens via the emailed copy for now.)
--
-- org_id must ALSO be the caller's own org, not just a client-supplied value — otherwise
-- a Data-API caller could stamp another org's UUID onto a feedback row. `is not distinct
-- from` (not `=`) is deliberate: the API route inserts org_id = null when the profile
-- lookup fails, and `=` would reject that legitimate null path.
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert
  with check (
    user_id = auth.uid()
    and org_id is not distinct from (select p.org_id from profiles p where p.id = auth.uid())
  );

drop policy if exists feedback_select_own on feedback;
create policy feedback_select_own on feedback for select
  using (user_id = auth.uid());
