-- PricePilot pricing targets — the MarginWise data PricePilot consumes today
-- (until MarginWise/marginview is built). One row per org. Org-scoped RLS.
-- Everything is nullable so PricePilot degrades gracefully when targets are unset.

create table if not exists pl_targets (
  org_id uuid primary key references organisations(id) on delete cascade,
  target_margin_pct numeric,              -- org target gross margin %  (drives "below target")
  monthly_revenue_target numeric,         -- monthly revenue goal
  monthly_gross_profit_target numeric,    -- monthly gross profit goal
  monthly_opex numeric,                   -- monthly operating costs (net profit = gross profit − opex)
  updated_at timestamptz not null default now()
);

-- Additive for orgs that ran an earlier version of this file.
alter table pl_targets add column if not exists monthly_opex numeric;

alter table pl_targets enable row level security;

drop policy if exists pl_targets_all on pl_targets;
create policy pl_targets_all on pl_targets for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
