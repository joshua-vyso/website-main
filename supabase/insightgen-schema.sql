-- InsightGen data model: the cross-module AI insight / reporting brain.
-- ig_insights  = AI-generated findings drawn from every other module
-- ig_reports   = saved report definitions (which modules, schedule, last run)
-- Org-scoped RLS, mirroring the existing of_* / pp_* tables. Idempotent.
-- Paste into the Supabase SQL editor.

create table if not exists ig_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- source module: docu | procurepulse | pricepilot | planwise | wastewatch |
  -- shiftboard | supplysync | orderflow
  source_module text not null,
  -- info | warning | critical | positive  (maps to the UI Tone)
  severity text not null default 'info',
  text text not null,
  -- headline metric for this insight, e.g. 'Waste cost' / '+12% wk/wk'
  metric_label text,
  metric_value text,
  -- true once the insight has been surfaced as an anomaly card
  is_anomaly boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ig_insights_org on ig_insights (org_id, created_at desc);

create table if not exists ig_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  scope text,
  -- modules covered, e.g. ["pricepilot","orderflow"] or ["all"]
  modules jsonb not null default '[]'::jsonb,
  -- daily | weekly | monthly | manual
  schedule text not null default 'weekly',
  -- draft | ready | scheduled
  status text not null default 'ready',
  owner text,
  last_run timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ig_reports_org on ig_reports (org_id, last_run desc);

-- Row level security: each org only sees its own rows (same shape as of_* / pp_*).
alter table ig_insights enable row level security;
alter table ig_reports  enable row level security;

drop policy if exists ig_insights_all on ig_insights;
drop policy if exists ig_reports_all  on ig_reports;

create policy ig_insights_all on ig_insights for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ig_reports_all on ig_reports for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
