-- ProcurePulse activity events — the dashboard "Stock activity" feed. Append-only
-- stock-intelligence events (document sync, adjustments, counts, orders, recipe
-- batches, price updates). NO wastage events. Org-scoped RLS. Idempotent.

create table if not exists procurepulse_activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- document_sync | manual_adjustment | count_adjustment | order_received |
  -- recipe_reserved | recipe_consumed | transfer | price_update
  type text not null,
  title text not null,
  body text,
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  ref_id uuid,                                   -- document / order / count id
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_pp_activity_events_org
  on procurepulse_activity_events (org_id, occurred_at desc);

alter table procurepulse_activity_events enable row level security;

drop policy if exists pp_activity_events_all on procurepulse_activity_events;
create policy pp_activity_events_all on procurepulse_activity_events for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
