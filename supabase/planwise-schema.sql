-- PlanWise data model: the strategic planning layer ("business GPS") for
-- budget lines, goals, the 12-month revenue forecast, and what-if scenarios.
-- Columns mirror the TS shapes in lib/platform/planwise.ts (BudgetRow,
-- GoalSummary, ForecastLine, Scenario) so the module can fetch them 1:1.
-- Org-scoped RLS, mirroring the existing of_*/pp_*/pl_* tables. Idempotent.
-- Paste into the Supabase SQL editor and run once.

-- Budget lines: one row per spend/revenue category (BudgetRow).
create table if not exists pw_budget_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  cat text not null,                       -- category label (Revenue, COGS, Labour, …)
  budgeted numeric not null default 0,     -- planned amount (ZAR / month)
  actual numeric not null default 0,       -- actual amount (ZAR / month)
  profit_impact numeric not null default 0,-- signed rand impact vs plan (under = +, over = −)
  suggested_action text,                   -- human-readable next step
  module text,                             -- VysoModuleKey that can act on this line ("Review →")
  color text,                              -- hex swatch for the UI
  sort_order int not null default 0,       -- display order
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_budget_lines_org on pw_budget_lines (org_id, sort_order);

-- Goals: target vs current for each strategic KPI (GoalSummary).
create table if not exists pw_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  goal_key text not null,                  -- stable id ('rev','margin','waste','labour',…)
  label text not null,
  target numeric not null,
  current numeric not null,
  unit text not null default 'R',          -- 'R' | '%'
  higher_is_better boolean not null default true,
  module text,                             -- VysoModuleKey responsible for closing the gap
  trend jsonb not null default '[]'::jsonb,-- number[] recent values for the sparkline
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_goals_org on pw_goals (org_id, sort_order);

-- Forecast: the headline forecast lines + the 12-month revenue series.
-- `series` holds the SPEC.revenueSeriesMillions split into actual + projected
-- as jsonb: [{ month, value, kind:'actual'|'projected' }].
create table if not exists pw_forecast (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  forecast_key text not null,              -- stable id ('rev','exp','profit','cash')
  label text not null,
  value numeric not null,                  -- point forecast (ZAR)
  target numeric not null,
  range_low numeric not null,
  range_high numeric not null,
  confidence int not null default 0,       -- 0–100
  trend text not null default 'flat',      -- 'up' | 'down' | 'flat'
  tone text not null default 'neutral',    -- 'positive' | 'warning' | 'critical' | 'neutral'
  data jsonb not null default '[]'::jsonb, -- number[] short trailing sparkline
  series jsonb not null default '[]'::jsonb,-- 12-month [{month,value,kind}] (revenue line only)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_forecast_org on pw_forecast (org_id, sort_order);

-- Scenarios: saved what-if builders (Scenario). `sliders` is the SliderValues
-- input set; `projected` is the cached ScenarioResult outcome.
create table if not exists pw_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  scenario_key text not null,              -- stable id ('A','B','C')
  title text not null,
  description text not null,
  assumption text not null,
  sliders jsonb not null default '{}'::jsonb,  -- { revenueGrowth, expenseReduction, marginImprovement, wasteReduction, invoiceRecovery }
  projected jsonb not null default '{}'::jsonb,-- { revenue, expenses, profit, cash, runwayMonths, diffVsCurrent }
  risk text not null default 'Medium',     -- 'Low' | 'Medium' | 'High'
  probability int not null default 50,     -- 0–100
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_scenarios_org on pw_scenarios (org_id, sort_order);

-- Row level security: each org only sees its own rows (same shape as of_*/pl_*).
alter table pw_budget_lines enable row level security;
alter table pw_goals        enable row level security;
alter table pw_forecast     enable row level security;
alter table pw_scenarios    enable row level security;

drop policy if exists pw_budget_lines_all on pw_budget_lines;
drop policy if exists pw_goals_all        on pw_goals;
drop policy if exists pw_forecast_all     on pw_forecast;
drop policy if exists pw_scenarios_all    on pw_scenarios;

create policy pw_budget_lines_all on pw_budget_lines for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_goals_all on pw_goals for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_forecast_all on pw_forecast for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_scenarios_all on pw_scenarios for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
