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
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert
  with check (user_id = auth.uid());

drop policy if exists feedback_select_own on feedback;
create policy feedback_select_own on feedback for select
  using (user_id = auth.uid());
