-- WasteWatch data model: waste categories, measuring devices, and waste events.
-- Org-scoped RLS, mirroring the existing of_*/pp_* tables. Columns mirror the
-- TS shapes in lib/platform/wastewatch.ts so the module can fetch 1:1.
-- Idempotent. Paste into the Supabase SQL editor.

-- Configurable waste categories (one row per category, each with a hex colour).
-- Mirrors WasteCategory + CategoryStat (cost / pct / trend) in the TS module.
create table if not exists ww_waste_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  -- hex colour used for charts/legends, e.g. '#0F6E56'
  color text not null,
  cost numeric not null default 0,
  pct numeric not null default 0,
  -- 7-point sparkline of recent cost contribution
  trend jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_waste_categories_org on ww_waste_categories (org_id, sort_order);

-- Measuring devices. Nested/array fields are jsonb (current_operator, current_recipe,
-- measurements, history) mirroring the Device interface.
create table if not exists ww_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  -- Bluetooth Scale | Bench Scale | Floor Scale | Kitchen Scale | IoT Sensor | Barcode Station | Camera Station | Custom Device
  type text not null,
  location text not null,
  -- online | offline | calibrating | attention
  status text not null default 'online',
  -- null for mains-powered devices (e.g. camera stations)
  battery int,
  last_sync text,
  firmware text,
  calibration text,
  events_today int not null default 0,
  -- DeviceAssignment { name, role, startedAt, shift } or null
  current_operator jsonb,
  -- DeviceRecipe { name, expected[], currentWaste? } or null
  current_recipe jsonb,
  -- DeviceMeasurement[] { time, item, qty, unit }
  measurements jsonb not null default '[]'::jsonb,
  -- DeviceHistoryEvent[] { kind, label, time }
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_devices_org on ww_devices (org_id, name);

-- Waste events. Mirrors WasteEvent: item/category/qty/unit/cost/reason plus
-- the employee/device/location context and ProcurePulse linkage placeholders.
create table if not exists ww_waste_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  event_date date not null,
  event_time text,
  item text not null,
  -- references ww_waste_categories.name (kept denormalised for 1:1 fetch)
  category text not null,
  qty numeric not null default 0,
  -- kg | units | crates | L
  unit text not null,
  cost numeric not null default 0,
  -- Spoiled | Expired | Wilted | Day-old | Over-portioned | Damaged | Trim | Prep error | Other
  reason text not null,
  recipe text,
  employee text not null,
  device text not null,
  location text not null,
  preventable boolean not null default false,
  notes text,
  -- ProcurePulse-integration placeholders
  ingredient text,
  supplier text,
  batch text,
  expected_qty numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_waste_events_org on ww_waste_events (org_id, event_date desc);

-- Row level security: each org only sees its own rows (same shape as of_*/pp_*).
alter table ww_waste_categories enable row level security;
alter table ww_devices          enable row level security;
alter table ww_waste_events      enable row level security;

drop policy if exists ww_waste_categories_all on ww_waste_categories;
drop policy if exists ww_devices_all          on ww_devices;
drop policy if exists ww_waste_events_all      on ww_waste_events;

create policy ww_waste_categories_all on ww_waste_categories for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ww_devices_all on ww_devices for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ww_waste_events_all on ww_waste_events for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
