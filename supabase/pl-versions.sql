-- PricePilot price-list version history (draft / publish / rollback / compare).
-- Each row is a published snapshot of a price list's default margin + overrides.
-- The "live" state lives in pl_price_lists + pl_overrides; publishing snapshots it.

create table if not exists pl_price_list_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  price_list_id uuid not null references pl_price_lists(id) on delete cascade,
  version_no int not null,
  default_margin_pct numeric not null,
  overrides jsonb not null default '[]'::jsonb,   -- [{ stock_item_id, margin_pct }]
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (price_list_id, version_no)
);

alter table pl_price_list_versions enable row level security;

drop policy if exists pl_versions_all on pl_price_list_versions;
create policy pl_versions_all on pl_price_list_versions for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- Atomic rollback: restore a version's default margin + overrides in ONE transaction,
-- so a partial failure can never leave the price list with its overrides wiped.
-- security invoker → the caller's RLS still applies (org-scoped). Functions run
-- in a single transaction, so the delete + insert are all-or-nothing.
create or replace function pl_rollback_version(p_list_id uuid, p_version_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v pl_price_list_versions%rowtype;
begin
  select * into v from pl_price_list_versions where id = p_version_id and price_list_id = p_list_id;
  if not found then
    raise exception 'version % not found for list %', p_version_id, p_list_id;
  end if;

  update pl_price_lists set default_margin_pct = v.default_margin_pct where id = p_list_id;
  delete from pl_overrides where price_list_id = p_list_id;
  insert into pl_overrides (org_id, price_list_id, stock_item_id, margin_pct)
    select v.org_id, p_list_id, (o->>'stock_item_id')::uuid, (o->>'margin_pct')::numeric
    from jsonb_array_elements(v.overrides) o;
end;
$$;

grant execute on function pl_rollback_version(uuid, uuid) to authenticated;
