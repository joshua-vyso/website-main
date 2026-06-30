-- ShiftBoard data model: people-operations command centre for Vyso.
-- Mirrors lib/platform/shiftboard.ts: Department, Employee, RosterRow/Shift,
-- AttendanceRecord, LeaveRequest. Org-scoped RLS, mirroring the existing
-- of_*/pp_* tables. Idempotent. Paste into the Supabase SQL editor.
--
-- Device/recipe/task columns on sb_employees are the WasteWatch foundation:
-- a scale needs to know who is using it, in which department, on which recipe.

-- ---------------------------------------------------------------------------
-- Departments — the 7 from SPEC.departments, with target headcount + hex colour.
-- ---------------------------------------------------------------------------
create table if not exists sb_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  required int not null default 0,   -- target headcount "right now"
  color text not null,               -- hex, e.g. #0C447C
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_departments_org on sb_departments (org_id, name);

-- ---------------------------------------------------------------------------
-- Employees — mirrors the Employee interface. skills jsonb is keyed by the 7
-- SKILL_NAMES (rating 0–5). available_days / unavailable_days / devices are
-- jsonb arrays. Live-ops device columns populated only when Working.
-- ---------------------------------------------------------------------------
create table if not exists sb_employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  role text not null,
  department text not null,                    -- FK-by-name to sb_departments.name
  status text not null default 'Scheduled',    -- Working|On break|Scheduled|Off|On leave|Absent
  next_shift text,
  shift_time text,                             -- current/next window e.g. '08:00–16:00'
  hours_this_week numeric not null default 0,
  contracted_hours numeric not null default 0,
  rate numeric not null default 0,             -- ZAR / hour
  attendance_score int not null default 0,     -- 0–100 (seeded 70–99)
  leave_balance numeric not null default 0,    -- days
  skills jsonb not null default '{}'::jsonb,    -- { "Receiving": 0..5, ... } for the 7 SKILL_NAMES
  available_days jsonb not null default '[]'::jsonb,
  unavailable_days jsonb not null default '[]'::jsonb,
  preferred_shifts text,
  devices jsonb not null default '[]'::jsonb,   -- recent assigned device names (drawer)
  -- Live-ops / WasteWatch device foundation (populated when Working on a device):
  current_department text,
  current_task text,
  current_recipe text,
  assigned_device text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_employees_org on sb_employees (org_id, name);

-- ---------------------------------------------------------------------------
-- Roster — one row per employee, a 7-day weekly pattern as a jsonb `days` array
-- of cells { time, department, status, conflict? }. open_shifts holds the
-- week's unfilled shifts (jsonb array), repeated per row so a single fetch of
-- one row yields the RosterWeek. label is the week heading.
-- ---------------------------------------------------------------------------
create table if not exists sb_roster_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  role text not null,
  department text not null,
  label text not null default '',              -- e.g. 'Week of 30 Jun'
  days jsonb not null default '[]'::jsonb,      -- 7 cells: {time,department,status,conflict?}
  open_shifts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_roster_shifts_org on sb_roster_shifts (org_id, name);

-- ---------------------------------------------------------------------------
-- Attendance — one row per employee rostered today (clock in/out, hours, status,
-- overtime). Mirrors AttendanceRecord.
-- ---------------------------------------------------------------------------
create table if not exists sb_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  department text not null,
  scheduled text not null,                     -- '08:00–16:00'
  clock_in text,                               -- null = not clocked in
  clock_out text,                              -- null = still on shift
  hours_worked numeric not null default 0,
  status text not null default 'On time',      -- On time|Late|Absent|Early leave|Overtime|Manual review
  overtime numeric not null default 0,         -- hours
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_attendance_org on sb_attendance (org_id, department);

-- ---------------------------------------------------------------------------
-- Leave requests — mirrors LeaveRequest with coverage_impact + coverage_risk.
-- ---------------------------------------------------------------------------
create table if not exists sb_leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  department text not null,
  type text not null,                          -- Annual leave|Sick leave|Family responsibility|Unpaid
  start_label text not null,                   -- '3 Jul', 'Fri 4 Jul'
  end_label text not null,
  start_date date,                             -- natural sort key
  days numeric not null default 0,
  coverage_impact text,
  coverage_risk text not null default 'none',  -- none|low|high
  status text not null default 'Pending',      -- Pending|Approved|Declined
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_leave_requests_org on sb_leave_requests (org_id, start_date);

-- ---------------------------------------------------------------------------
-- Row level security: each org only sees its own rows (same shape as of_*/pp_*).
-- ---------------------------------------------------------------------------
alter table sb_departments    enable row level security;
alter table sb_employees      enable row level security;
alter table sb_roster_shifts  enable row level security;
alter table sb_attendance     enable row level security;
alter table sb_leave_requests enable row level security;

drop policy if exists sb_departments_all    on sb_departments;
drop policy if exists sb_employees_all       on sb_employees;
drop policy if exists sb_roster_shifts_all   on sb_roster_shifts;
drop policy if exists sb_attendance_all       on sb_attendance;
drop policy if exists sb_leave_requests_all   on sb_leave_requests;

create policy sb_departments_all on sb_departments for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_employees_all on sb_employees for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_roster_shifts_all on sb_roster_shifts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_attendance_all on sb_attendance for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_leave_requests_all on sb_leave_requests for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
