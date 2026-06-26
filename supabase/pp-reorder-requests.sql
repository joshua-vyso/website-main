-- Manual reorder requests the user adds on the Reordering page, alongside the
-- auto-suggested draft PO built from low/out stock. Org-scoped RLS, mirroring the
-- pp_* / pl_* table pattern. Idempotent — paste into the Supabase SQL editor.

create table if not exists pp_reorder_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- Link to a catalogue item when known; set null (not cascade) so a manual
  -- request survives if its item is later removed by an unfeed.
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  product_name text not null,                  -- fallback label / off-catalogue item
  qty numeric not null default 0,
  unit text,                                   -- "boxes" | "kg" | "punnets" | …
  supplier text,                               -- supplier name / contact
  note text,                                   -- e.g. "event prep", "bulk buy"
  status text not null default 'open',         -- open | ordered | fulfilled | cancelled
  created_by uuid,                             -- profiles.id of the requester
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pp_reorder_requests_org
  on pp_reorder_requests (org_id, status, created_at desc);
create index if not exists idx_pp_reorder_requests_item
  on pp_reorder_requests (stock_item_id);

alter table pp_reorder_requests enable row level security;

drop policy if exists pp_reorder_requests_all on pp_reorder_requests;
create policy pp_reorder_requests_all on pp_reorder_requests for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
